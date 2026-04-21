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
 * Committed hours = remaining estimate for active tasks.
 * "Remaining" = max(estimate - already logged, 0).
 * Only Not started + In progress tasks count.
 */
export function committedHours(
  tasks: Task[],
  logs: TimeLog[],
  staffId: string,
): number {
  const staffTasks = tasks.filter(
    (t) => t.staff_id === staffId && ACTIVE_STATUSES.includes(t.status),
  );
  return staffTasks.reduce((sum, t) => {
    const logged = loggedHoursForTask(t.id, logs);
    const remaining = Math.max(Number(t.estimated_hours) - logged, 0);
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
