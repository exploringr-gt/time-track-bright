import {
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  format,
  parseISO,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  isSameDay,
} from "date-fns";

// ISO week: Monday start
export const WEEK_OPTS = { weekStartsOn: 1 as const };

export function weekRange(d: Date) {
  return {
    start: startOfWeek(d, WEEK_OPTS),
    end: endOfWeek(d, WEEK_OPTS),
  };
}

export function shiftWeek(d: Date, n: number) {
  return addWeeks(d, n);
}

export function daysInWeek(d: Date) {
  const { start, end } = weekRange(d);
  return eachDayOfInterval({ start, end });
}

export function monthRange(d: Date) {
  return { start: startOfMonth(d), end: endOfMonth(d) };
}

export function ymd(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function fromYmd(s: string) {
  return parseISO(s);
}

export function fmt(d: Date, p = "MMM d") {
  return format(d, p);
}

export function dayOfWeek(d: Date): number {
  // 0=Sun..6=Sat
  return d.getDay();
}

export { addDays, isSameDay, eachDayOfInterval, format };
