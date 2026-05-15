import type { Staff, Task, TimeLog, PublicHoliday, LeaveDay } from "./types";
import { ACTIVE_STATUSES } from "./types";
import { eachDayOfInterval, ymd, dayOfWeek } from "./dates";

const DAILY_HOURS = (s: Staff) =>
  s.working_days.length > 0 ? s.weekly_target_hours / s.working_days.length : 0;

export function workingDaysInRange(
  staff: Staff,
  start: Date,
  end: Date,
  holidays: PublicHoliday[],
  leave: LeaveDay[],
): { date: Date; hours: number; isLeave: boolean; isHoliday: boolean }[] {
  const holidaySet = new Set(holidays.map((h) => h.holiday_date));
  const leaveSet = new Set(
    leave.filter((l) => l.staff_id === staff.id).map((l) => l.leave_date),
  );
  const daily = DAILY_HOURS(staff);

  return eachDayOfInterval({ start, end }).map((d) => {
    const isWorkingDay = staff.working_days.includes(dayOfWeek(d));
    const key = ymd(d);
    const isHoliday = holidaySet.has(key);
    const isLeave = leaveSet.has(key);
    const hours = isWorkingDay && !isHoliday && !isLeave ? daily : 0;
    return { date: d, hours, isLeave, isHoliday };
  });
}

export function plannedHours(
  staff: Staff,
  start: Date,
  end: Date,
  holidays: PublicHoliday[],
  leave: LeaveDay[],
): number {
  return workingDaysInRange(staff, start, end, holidays, leave).reduce(
    (sum, d) => sum + d.hours,
    0,
  );
}

export function loggedHoursForStaff(
  staffId: string,
  logs: TimeLog[],
  start: Date,
  end: Date,
): number {
  const s = ymd(start);
  const e = ymd(end);
  return logs
    .filter((l) => l.staff_id === staffId && l.log_date >= s && l.log_date <= e)
    .reduce((sum, l) => sum + Number(l.hours), 0);
}

export function loggedHoursForTask(taskId: string, logs: TimeLog[]): number {
  return logs
    .filter((l) => l.task_id === taskId)
    .reduce((sum, l) => sum + Number(l.hours), 0);
}

/**
 * Committed hours = remaining estimate for active tasks, spread evenly across
 * the task's working days (start_date → due_date) and counted only for the
 * working days that fall within [rangeStart, rangeEnd].
 *
 * Example: a 4h task spanning Mon–Fri spreads to 0.8h/day. Committed for a
 * week that covers Wed–Fri = 2.4h. Tasks without a planned span fall back to
 * their full remaining estimate so they aren't lost from the projection.
 */
export function committedHours(
  tasks: Task[],
  logs: TimeLog[],
  staffId: string,
  staff?: Staff,
  rangeStart?: Date,
  rangeEnd?: Date,
  holidays: PublicHoliday[] = [],
  leave: LeaveDay[] = [],
): number {
  const staffTasks = tasks.filter(
    (t) => t.staff_id === staffId && ACTIVE_STATUSES.includes(t.status),
  );
  const rs = rangeStart ? ymd(rangeStart) : null;
  const re = rangeEnd ? ymd(rangeEnd) : null;

  return staffTasks.reduce((sum, t) => {
    const logged = loggedHoursForTask(t.id, logs);
    const remaining = Math.max(Number(t.estimated_hours) - logged, 0);
    if (remaining <= 0) return sum;

    if (staff && rs && re && t.start_date && t.due_date) {
      // Spread the full estimate across working days, then sum only the
      // portion that falls in the requested range. This makes a multi-week
      // task contribute proportionally to each week.
      const spread = spreadTaskHours(t, staff, holidays, leave);
      let inRange = 0;
      for (const [k, h] of spread) {
        if (k >= rs && k <= re) inRange += h;
      }
      // Scale by remaining/estimate so already-logged hours don't double-count.
      const est = Number(t.estimated_hours) || 0;
      const scale = est > 0 ? remaining / est : 1;
      return sum + inRange * scale;
    }
    return sum + remaining;
  }, 0);
}

export function utilColor(pct: number): "good" | "warn" | "over" {
  if (pct > 100) return "over";
  if (pct > 85) return "warn";
  return "good";
}

export function overrunLevel(estimate: number, logged: number): "none" | "warn" | "over" {
  if (estimate <= 0) return "none";
  const ratio = logged / estimate;
  if (ratio > 1.25) return "over";
  if (ratio > 1.0) return "warn";
  return "none";
}

export function pct(num: number, den: number): number {
  if (den <= 0) return 0;
  return Math.round((num / den) * 100);
}

/**
 * Spread a task's estimated hours evenly across the staff's working days
 * between start_date and due_date, capped at the staff's daily target.
 * Skips weekends, public holidays, and the staff member's leave days.
 *
 * Returns a Map keyed by yyyy-MM-dd → hours scheduled for that day.
 */
export function spreadTaskHours(
  task: Task,
  staff: Staff,
  holidays: PublicHoliday[],
  leave: LeaveDay[],
): Map<string, number> {
  const out = new Map<string, number>();
  if (!task.start_date || !task.due_date) return out;
  const startD = new Date(task.start_date);
  const endD = new Date(task.due_date);
  if (endD < startD) return out;

  const days = workingDaysInRange(staff, startD, endD, holidays, leave).filter(
    (d) => d.hours > 0,
  );
  if (days.length === 0) return out;

  const dailyCap =
    staff.working_days.length > 0
      ? staff.weekly_target_hours / staff.working_days.length
      : 0;

  let remaining = Number(task.estimated_hours) || 0;
  const even = remaining / days.length;
  const perDay = Math.min(even, dailyCap);

  for (const d of days) {
    if (remaining <= 0) break;
    const hrs = Math.min(perDay, remaining);
    out.set(ymd(d.date), hrs);
    remaining -= hrs;
  }

  // If estimate exceeded capacity, distribute leftover (still capped) day by day.
  if (remaining > 0) {
    for (const d of days) {
      if (remaining <= 0) break;
      const k = ymd(d.date);
      const cur = out.get(k) ?? 0;
      const room = Math.max(dailyCap - cur, 0);
      const add = Math.min(room, remaining);
      if (add > 0) {
        out.set(k, cur + add);
        remaining -= add;
      }
    }
  }

  return out;
}

/**
 * Validate a task boundary date for a given staff member.
 * Returns an error message, or null if valid.
 */
export function validateTaskBoundary(
  date: string,
  staff: Staff,
  holidays: PublicHoliday[],
  leave: LeaveDay[],
): string | null {
  const d = new Date(date);
  const dow = d.getDay();
  if (!staff.working_days.includes(dow)) {
    return "That date is not a working day for this staff member.";
  }
  if (holidays.some((h) => h.holiday_date === date)) {
    return "That date is a public holiday.";
  }
  if (leave.some((l) => l.staff_id === staff.id && l.leave_date === date)) {
    return "That date is a leave day for this staff member.";
  }
  return null;
}
