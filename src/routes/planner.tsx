import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  startOfMonth,
} from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";

import { api, qk } from "@/lib/queries";
import { committedHours, plannedHours, pct } from "@/lib/calc";
import { daysInWeek, fmt, weekRange, ymd } from "@/lib/dates";
import { useUserRole, useSelectedStaff } from "@/lib/staffStore";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WeekSelector } from "@/components/WeekSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/planner")({
  head: () => ({ meta: [{ title: "Planner — Tempo" }] }),
  component: Planner,
});

function Planner() {
  const staffQ = useQuery({ queryKey: qk.staff, queryFn: api.listStaff });
  const staff = staffQ.data ?? [];
  const [role] = useUserRole();
  const [selfId] = useSelectedStaff();
  const readOnly = role === "viewer";
  const selfName = staff.find((s) => s.id === selfId)?.name;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Planner</h1>
        <p className="text-sm text-muted-foreground">
          Capacity, leave, and holidays.
        </p>
      </div>

      {readOnly && (
        <div className="mb-4 rounded-md border border-border bg-accent/40 px-3 py-2 text-xs text-muted-foreground">
          Viewing as <strong>PwC NL/AL</strong> — read-only. You can browse
          capacity, leave, and holidays but cannot mark or remove leave.
        </div>
      )}

      {!readOnly && selfName && (
        <div className="mb-4 rounded-md border border-border bg-accent/40 px-3 py-2 text-xs text-muted-foreground">
          Signed in as <strong>{selfName}</strong> — you can only mark or remove
          leave for yourself.
        </div>
      )}

      <Tabs defaultValue="week">
        <TabsList>
          <TabsTrigger value="week">Weekly grid</TabsTrigger>
          <TabsTrigger value="month">Monthly leave & holidays</TabsTrigger>
        </TabsList>
        <TabsContent value="week" className="mt-4">
          <WeeklyGrid staff={staff} readOnly={readOnly} selfId={selfId} />
        </TabsContent>
        <TabsContent value="month" className="mt-4">
          <MonthlyView staff={staff} readOnly={readOnly} selfId={selfId} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function WeeklyGrid({ staff, readOnly = false, selfId }: { staff: import("@/lib/types").Staff[]; readOnly?: boolean; selfId: string | null }) {
  const [weekDate, setWeekDate] = useState(new Date());
  const tasksQ = useQuery({ queryKey: qk.tasks, queryFn: api.listTasks });
  const logsQ = useQuery({ queryKey: qk.timeLogs, queryFn: api.listTimeLogs });
  const holidaysQ = useQuery({ queryKey: qk.holidays, queryFn: api.listHolidays });
  const leaveQ = useQuery({ queryKey: qk.leave, queryFn: api.listLeave });

  const days = daysInWeek(weekDate);
  const { start, end } = weekRange(weekDate);
  const holidays = holidaysQ.data ?? [];
  const leave = leaveQ.data ?? [];
  const logs = logsQ.data ?? [];
  const tasks = tasksQ.data ?? [];

  const holidayMap = new Map(holidays.map((h) => [h.holiday_date, h]));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <WeekSelector value={weekDate} onChange={setWeekDate} />
        {!readOnly && <AddLeaveDialog staff={staff} selfId={selfId} />}
      </div>

      <Card className="overflow-x-auto">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-[180px_repeat(7,1fr)] border-b border-border bg-muted/30">
            <div className="p-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Staff / day
            </div>
            {days.map((d) => {
              const hol = holidayMap.get(ymd(d));
              return (
                <div key={d.toISOString()} className="border-l border-border p-3">
                  <p className="text-xs font-semibold">{fmt(d, "EEE d")}</p>
                  {hol && (
                    <p className="text-[10px] font-medium text-status-on-hold">
                      {hol.name}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {staff.map((s) => {
            const dailyHours =
              s.working_days.length > 0 ? s.weekly_target_hours / s.working_days.length : 0;
            const wkPlanned = plannedHours(s, start, end, holidays, leave);
            const wkCommitted = committedHours(tasks, logs, s.id);

            return (
              <div
                key={s.id}
                className="grid grid-cols-[180px_repeat(7,1fr)] border-b border-border last:border-b-0"
              >
                <div className="p-3">
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {wkPlanned.toFixed(1)}h planned · {wkCommitted.toFixed(1)}h committed
                  </p>
                </div>
                {days.map((d) => {
                  const k = ymd(d);
                  const isWork = s.working_days.includes(d.getDay());
                  const isHol = holidayMap.has(k);
                  const leaveRow = leave.find(
                    (l) => l.staff_id === s.id && l.leave_date === k,
                  );
                  const planned = isWork && !isHol && !leaveRow ? dailyHours : 0;
                  const dayLogged = logs
                    .filter((l) => l.staff_id === s.id && l.log_date === k)
                    .reduce((sum, l) => sum + Number(l.hours), 0);
                  const utilPct = pct(dayLogged, planned);

                  return (
                    <PlannerCell
                      key={k}
                      staffId={s.id}
                      date={d}
                      planned={planned}
                      logged={dayLogged}
                      utilPct={utilPct}
                      isHoliday={isHol}
                      isLeave={!!leaveRow}
                      leaveId={leaveRow?.id}
                      isWork={isWork}
                      readOnly={readOnly || (selfId !== null && s.id !== selfId)}
                      isOther={!readOnly && selfId !== null && s.id !== selfId}
                    />
                  );
                })}
              </div>
            );
          })}
          {staff.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No staff yet.
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

function PlannerCell({
  staffId,
  date,
  planned,
  logged,
  utilPct,
  isHoliday,
  isLeave,
  leaveId,
  isWork,
  readOnly = false,
  isOther = false,
}: {
  staffId: string;
  date: Date;
  planned: number;
  logged: number;
  utilPct: number;
  isHoliday: boolean;
  isLeave: boolean;
  leaveId?: string;
  isWork: boolean;
  readOnly?: boolean;
  isOther?: boolean;
}) {
  const qc = useQueryClient();
  const addLeave = useMutation({
    mutationFn: () =>
      api.createLeave({ staff_id: staffId, leave_date: ymd(date) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.leave });
      toast.success("Leave added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeLeave = useMutation({
    mutationFn: () => api.deleteLeave(leaveId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.leave });
      toast.success("Leave removed");
    },
  });

  const overUtil = utilPct > 100;
  const goodUtil = utilPct > 0 && utilPct <= 100;
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  return (
    <button
      type="button"
      onClick={() => {
        if (isOther) {
          toast.error("You can only mark leave for yourself.");
          return;
        }
        if (readOnly) {
          toast.error("Read-only — viewers can't mark leave.");
          return;
        }
        if (isHoliday) {
          toast.error("That day is a public holiday — no leave needed.");
          return;
        }
        if (isWeekend && !isWork) {
          toast.error("Weekends are non-working days — no leave needed.");
          return;
        }
        if (!isWork) return;
        if (isLeave) removeLeave.mutate();
        else addLeave.mutate();
      }}
      className={cn(
        "border-l border-border p-2 text-left text-xs transition-colors",
        !readOnly && "hover:bg-accent/40",
        isHoliday && "bg-status-on-hold/10",
        isLeave && "bg-status-on-hold/15",
        !isWork && "bg-muted/40",
        readOnly && "cursor-default",
      )}
    >
      {isHoliday ? (
        <span className="font-medium text-status-on-hold">Holiday</span>
      ) : isLeave ? (
        <span className="font-medium text-status-on-hold">On leave</span>
      ) : !isWork ? (
        <span className="text-muted-foreground">Off</span>
      ) : (
        <>
          <p className="tabular-nums">
            <span className={cn("font-semibold", overUtil && "text-util-over", goodUtil && "text-util-good")}>
              {logged.toFixed(1)}
            </span>
            <span className="text-muted-foreground"> / {planned.toFixed(1)}h</span>
          </p>
          {!readOnly && (
            <p className="text-[10px] text-muted-foreground">click to mark leave</p>
          )}
        </>
      )}
    </button>
  );
}

function MonthlyView({ staff, readOnly = false, selfId }: { staff: import("@/lib/types").Staff[]; readOnly?: boolean; selfId: string | null }) {
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const holidaysQ = useQuery({ queryKey: qk.holidays, queryFn: api.listHolidays });
  const leaveQ = useQuery({ queryKey: qk.leave, queryFn: api.listLeave });

  const holidays = holidaysQ.data ?? [];
  const leave = leaveQ.data ?? [];

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const days = useMemo(
    () => eachDayOfInterval({ start: monthStart, end: monthEnd }),
    [monthStart, monthEnd],
  );

  const leadingBlanks = (monthStart.getDay() + 6) % 7;

  const monthLeave = leave.filter(
    (l) => l.leave_date >= ymd(monthStart) && l.leave_date <= ymd(monthEnd),
  );
  const monthHolidays = holidays.filter(
    (h) => h.holiday_date >= ymd(monthStart) && h.holiday_date <= ymd(monthEnd),
  );

  const holidayMap = new Map(holidays.map((h) => [h.holiday_date, h]));
  const leaveByDay = useMemo(() => {
    const m = new Map<string, { id: string; staff_id: string; reason?: string | null }[]>();
    for (const l of leave) {
      const arr = m.get(l.leave_date) ?? [];
      arr.push(l);
      m.set(l.leave_date, arr);
    }
    return m;
  }, [leave]);

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const initials = (name: string) =>
    name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();

  if (staff.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          No staff yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
          <Button variant="ghost" size="sm" onClick={() => setMonth(addMonths(month, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-sm font-medium">{format(month, "MMMM yyyy")}</span>
          <Button variant="ghost" size="sm" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {!readOnly && (
          <AddLeaveDialog staff={staff} defaultDate={month} selfId={selfId} />
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Team — {format(month, "MMMM yyyy")}
          </CardTitle>
          <p className="text-xs text-muted-foreground tabular-nums">
            {monthLeave.length} leave day{monthLeave.length === 1 ? "" : "s"} ·{" "}
            {monthHolidays.length} public holiday{monthHolidays.length === 1 ? "" : "s"}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`b-${i}`} className="min-h-[80px] rounded-md bg-transparent" />
            ))}
            {days.map((d) => {
              const k = ymd(d);
              const hol = holidayMap.get(k);
              const dayLeave = leaveByDay.get(k) ?? [];
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;

              return (
                <div
                  key={k}
                  className={cn(
                    "min-h-[80px] rounded-md border border-border p-1 text-left",
                    hol && "bg-status-on-hold/15 border-status-on-hold/40",
                    !hol && isWeekend && "bg-muted/40",
                  )}
                  title={hol ? `Holiday: ${hol.name}` : undefined}
                >
                  <p className="text-[11px] font-semibold tabular-nums">{format(d, "d")}</p>
                  {hol && (
                    <p className="mt-0.5 truncate text-[9px] font-medium text-status-on-hold">
                      {hol.name}
                    </p>
                  )}
                  {dayLeave.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {dayLeave.map((l) => {
                        const s = staffById.get(l.staff_id);
                        if (!s) return null;
                        return (
                          <span
                            key={l.id}
                            title={`${s.name} on leave${l.reason ? `: ${l.reason}` : ""}`}
                            className="rounded-sm bg-status-in-progress/20 px-1 py-0.5 text-[9px] font-semibold text-status-in-progress"
                          >
                            {initials(s.name)}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-status-on-hold/40 bg-status-on-hold/15" /> Public holiday
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-status-in-progress/20" /> Staff on leave
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-muted" /> Weekend
            </span>
          </div>
        </CardContent>
      </Card>

      {(monthLeave.length > 0 || monthHolidays.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {monthHolidays.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Public holidays</p>
                <ul className="mt-1 divide-y divide-border rounded-md border border-border">
                  {monthHolidays.map((h) => (
                    <li key={h.id} className="flex items-center justify-between p-2">
                      <span>{h.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {format(new Date(h.holiday_date), "EEE, MMM d")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {staff.map((s) => {
              const sLeave = monthLeave.filter((l) => l.staff_id === s.id);
              if (sLeave.length === 0) return null;
              return (
                <div key={s.id}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {s.name} — Leave
                  </p>
                  <LeaveList
                    leaves={sLeave}
                    readOnly={readOnly || (selfId !== null && selfId !== s.id)}
                    hideHeader
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}


function LeaveList({ leaves, readOnly = false, hideHeader = false }: { leaves: import("@/lib/types").LeaveDay[]; readOnly?: boolean; hideHeader?: boolean }) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteLeave(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.leave });
      toast.success("Leave removed");
    },
  });

  return (
    <div>
      {!hideHeader && <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Leave</p>}

      <ul className="mt-1 divide-y divide-border rounded-md border border-border">
        {leaves
          .slice()
          .sort((a, b) => a.leave_date.localeCompare(b.leave_date))
          .map((l) => (
            <li key={l.id} className="flex items-center justify-between p-2">
              <div>
                <p>{format(new Date(l.leave_date), "EEE, MMM d")}</p>
                {l.reason && <p className="text-xs text-muted-foreground">{l.reason}</p>}
              </div>
              {!readOnly && (
                <Button variant="ghost" size="icon" onClick={() => remove.mutate(l.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </li>
          ))}
      </ul>
    </div>
  );
}

function AddLeaveDialog({
  staff,
  defaultStaffId,
  defaultDate,
  selfId,
}: {
  staff: import("@/lib/types").Staff[];
  defaultStaffId?: string;
  defaultDate?: Date;
  selfId?: string | null;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  // If a real staff identity is signed in, lock the dialog to that person.
  const lockedStaffId = selfId ?? null;
  const initialStaffId = lockedStaffId ?? defaultStaffId ?? "";
  const [staffId, setStaffId] = useState(initialStaffId);
  const [date, setDate] = useState<Date | undefined>(defaultDate);
  const [reason, setReason] = useState("");
  const holidaysQ = useQuery({ queryKey: qk.holidays, queryFn: api.listHolidays });

  const create = useMutation({
    mutationFn: () => {
      if (!date) throw new Error("Pick a date");
      const dow = date.getDay();
      if (dow === 0 || dow === 6) {
        throw new Error("Leave can't fall on a weekend.");
      }
      const key = ymd(date);
      const isHoliday = (holidaysQ.data ?? []).some((h) => h.holiday_date === key);
      if (isHoliday) {
        throw new Error("That day is already a public holiday.");
      }
      return api.createLeave({
        staff_id: staffId,
        leave_date: key,
        reason: reason || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.leave });
      toast.success("Leave added");
      setOpen(false);
      setReason("");
      setDate(undefined);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (v) {
        setStaffId(lockedStaffId ?? defaultStaffId ?? staffId);
        if (defaultDate) setDate(defaultDate);
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1 h-4 w-4" /> Leave
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add leave day</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Staff</Label>
            <Select value={staffId} onValueChange={setStaffId} disabled={!!lockedStaffId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {(lockedStaffId ? staff.filter((s) => s.id === lockedStaffId) : staff).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {lockedStaffId && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                You can only mark leave for yourself.
              </p>
            )}
          </div>
          <div>
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Pick"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={setDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Reason (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={!staffId || !date}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
