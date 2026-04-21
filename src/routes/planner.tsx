import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";

import { api, qk } from "@/lib/queries";
import { committedHours, plannedHours, pct } from "@/lib/calc";
import { daysInWeek, fmt, weekRange, ymd } from "@/lib/dates";

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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/planner")({
  head: () => ({ meta: [{ title: "Planner — Tempo" }] }),
  component: Planner,
});

function Planner() {
  const [weekDate, setWeekDate] = useState(new Date());
  const staffQ = useQuery({ queryKey: qk.staff, queryFn: api.listStaff });
  const tasksQ = useQuery({ queryKey: qk.tasks, queryFn: api.listTasks });
  const logsQ = useQuery({ queryKey: qk.timeLogs, queryFn: api.listTimeLogs });
  const holidaysQ = useQuery({ queryKey: qk.holidays, queryFn: api.listHolidays });
  const leaveQ = useQuery({ queryKey: qk.leave, queryFn: api.listLeave });

  const days = daysInWeek(weekDate);
  const { start, end } = weekRange(weekDate);
  const staff = staffQ.data ?? [];
  const holidays = holidaysQ.data ?? [];
  const leave = leaveQ.data ?? [];
  const logs = logsQ.data ?? [];
  const tasks = tasksQ.data ?? [];

  const holidayMap = new Map(holidays.map((h) => [h.holiday_date, h]));

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planner</h1>
          <p className="text-sm text-muted-foreground">
            Capacity, leave, and holidays by day.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WeekSelector value={weekDate} onChange={setWeekDate} />
          <AddHolidayDialog />
          <AddLeaveDialog staff={staff} />
        </div>
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
    </main>
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
        "border-l border-border p-2 text-left text-xs transition-colors hover:bg-accent/40",
        isHoliday && "bg-status-on-hold/10",
        isLeave && "bg-status-on-hold/15",
        !isWork && "bg-muted/40",
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
          <p className="text-[10px] text-muted-foreground">click to mark leave</p>
        </>
      )}
    </button>
  );
}

function AddHolidayDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>();
  const [name, setName] = useState("");
  const holidaysQ = useQuery({ queryKey: qk.holidays, queryFn: api.listHolidays });

  const create = useMutation({
    mutationFn: () =>
      api.createHoliday({ holiday_date: ymd(date!), name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.holidays });
      toast.success("Holiday added");
      setOpen(false);
      setName("");
      setDate(undefined);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteHoliday(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.holidays }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1 h-4 w-4" /> Holiday
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Public holidays</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
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
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Labor Day" />
            </div>
          </div>
          <Button onClick={() => create.mutate()} disabled={!date || !name}>
            Add holiday
          </Button>
          <div className="mt-2 max-h-60 overflow-y-auto">
            {(holidaysQ.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No holidays added.</p>
            ) : (
              <ul className="divide-y divide-border">
                {(holidaysQ.data ?? []).map((h) => (
                  <li key={h.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      {format(new Date(h.holiday_date), "MMM d, yyyy")} —{" "}
                      <span className="text-muted-foreground">{h.name}</span>
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(h.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddLeaveDialog({ staff }: { staff: import("@/lib/types").Staff[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [reason, setReason] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api.createLeave({
        staff_id: staffId,
        leave_date: ymd(date!),
        reason: reason || undefined,
      }),
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
    <Dialog open={open} onOpenChange={setOpen}>
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
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
