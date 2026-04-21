import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";

import { api, qk } from "@/lib/queries";
import {
  ACTIVE_STATUSES,
  type Staff,
  type Task,
  type TimeLog,
} from "@/lib/types";
import {
  committedHours,
  loggedHoursForStaff,
  loggedHoursForTask,
  overrunLevel,
  pct,
  plannedHours,
} from "@/lib/calc";
import { daysInWeek, fmt, shiftWeek, weekRange, ymd } from "@/lib/dates";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { WeekSelector } from "@/components/WeekSelector";
import { UtilCell } from "@/components/UtilCell";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Tempo" }] }),
  component: Dashboard,
});

function Dashboard() {
  const [weekDate, setWeekDate] = useState(new Date());
  const [expanded, setExpanded] = useState<string | null>(null);

  const staffQ = useQuery({ queryKey: qk.staff, queryFn: api.listStaff });
  const tasksQ = useQuery({ queryKey: qk.tasks, queryFn: api.listTasks });
  const logsQ = useQuery({ queryKey: qk.timeLogs, queryFn: api.listTimeLogs });
  const projectsQ = useQuery({ queryKey: qk.projects, queryFn: api.listProjects });
  const clientsQ = useQuery({ queryKey: qk.clients, queryFn: api.listClients });
  const holidaysQ = useQuery({ queryKey: qk.holidays, queryFn: api.listHolidays });
  const leaveQ = useQuery({ queryKey: qk.leave, queryFn: api.listLeave });

  const { start, end } = weekRange(weekDate);
  const staff = staffQ.data ?? [];
  const tasks = tasksQ.data ?? [];
  const logs = logsQ.data ?? [];

  const rows = useMemo(() => {
    return staff.map((s) => {
      const planned = plannedHours(s, start, end, holidaysQ.data ?? [], leaveQ.data ?? []);
      const logged = loggedHoursForStaff(s.id, logs, start, end);
      const committed = committedHours(tasks, logs, s.id);
      const projectedPct = pct(committed + logged, planned);
      const actualPct = pct(logged, planned);
      const available = Math.max(planned - committed - logged, 0);
      const myTasks = tasks.filter((t) => t.staff_id === s.id);
      const active = myTasks.filter((t) => ACTIVE_STATUSES.includes(t.status));
      const onHold = myTasks.filter((t) => t.status === "on_hold");
      const overdueDate = ymd(new Date());
      const overdue = active.filter(
        (t) => t.due_date && t.due_date < overdueDate,
      );
      const overrunning = active.filter((t) => {
        const lg = loggedHoursForTask(t.id, logs);
        return overrunLevel(Number(t.estimated_hours), lg) === "over";
      });
      return {
        staff: s,
        planned,
        committed,
        logged,
        projectedPct,
        actualPct,
        available,
        active: active.length,
        onHold: onHold.length,
        overdue: overdue.length,
        overrunning: overrunning.length,
      };
    });
  }, [staff, tasks, logs, start, end, holidaysQ.data, leaveQ.data]);

  const allOverruns = useMemo(() => {
    return tasks
      .filter((t) => ACTIVE_STATUSES.includes(t.status))
      .map((t) => ({
        task: t,
        logged: loggedHoursForTask(t.id, logs),
      }))
      .filter((r) => overrunLevel(Number(r.task.estimated_hours), r.logged) === "over");
  }, [tasks, logs]);

  const allOnHold = useMemo(
    () => tasks.filter((t) => t.status === "on_hold"),
    [tasks],
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Planned vs committed vs actual for the selected week.
          </p>
        </div>
        <WeekSelector value={weekDate} onChange={setWeekDate} />
      </div>

      <Card className="mb-6 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Staff</TableHead>
              <TableHead className="text-right">Planned</TableHead>
              <TableHead className="text-right">Committed</TableHead>
              <TableHead className="text-right">Logged</TableHead>
              <TableHead className="text-right">Projected</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Tasks</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                  No staff yet. Add some in Settings.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const isOpen = expanded === r.staff.id;
              return (
                <>
                  <TableRow
                    key={r.staff.id}
                    className="cursor-pointer hover:bg-accent/40"
                    onClick={() => setExpanded(isOpen ? null : r.staff.id)}
                  >
                    <TableCell className="font-medium">{r.staff.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.planned.toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.committed.toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.logged.toFixed(1)}</TableCell>
                    <TableCell className="text-right">
                      <UtilCell pct={r.projectedPct} />
                    </TableCell>
                    <TableCell className="text-right">
                      <UtilCell pct={r.actualPct} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.available.toFixed(1)}h</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {r.active}a · {r.onHold}h
                      {r.overdue > 0 && <span className="ml-1 text-util-over">· {r.overdue} late</span>}
                      {r.overrunning > 0 && <span className="ml-1 text-util-over">· {r.overrunning} over</span>}
                    </TableCell>
                    <TableCell>
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow key={`${r.staff.id}-detail`}>
                      <TableCell colSpan={9} className="bg-muted/30 p-0">
                        <DailyDrillDown
                          staff={r.staff}
                          weekDate={weekDate}
                          tasks={tasks}
                          logs={logs}
                          holidays={holidaysQ.data ?? []}
                          leave={leaveQ.data ?? []}
                          projects={projectsQ.data ?? []}
                          clients={clientsQ.data ?? []}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Overrunning tasks (&gt;25%)</CardTitle>
          </CardHeader>
          <CardContent>
            {allOverruns.length === 0 ? (
              <p className="text-sm text-muted-foreground">None — nice.</p>
            ) : (
              <ul className="space-y-2">
                {allOverruns.map((r) => {
                  const s = staff.find((x) => x.id === r.task.staff_id);
                  return (
                    <li key={r.task.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-2">
                      <div>
                        <p className="text-sm font-medium">{r.task.description}</p>
                        <p className="text-xs text-muted-foreground">{s?.name}</p>
                      </div>
                      <span className="rounded-md bg-util-over/15 px-2 py-0.5 text-xs font-semibold text-util-over tabular-nums">
                        {r.logged.toFixed(1)}h / {Number(r.task.estimated_hours).toFixed(1)}h
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">On hold</CardTitle>
          </CardHeader>
          <CardContent>
            {allOnHold.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing parked.</p>
            ) : (
              <ul className="space-y-2">
                {allOnHold.map((t) => {
                  const s = staff.find((x) => x.id === t.staff_id);
                  return (
                    <li key={t.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-2">
                      <div>
                        <p className="text-sm font-medium">{t.description}</p>
                        <p className="text-xs text-muted-foreground">{s?.name}</p>
                      </div>
                      <StatusBadge status="on_hold" />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function DailyDrillDown({
  staff,
  weekDate,
  tasks,
  logs,
  holidays,
  leave,
  projects,
  clients,
}: {
  staff: Staff;
  weekDate: Date;
  tasks: Task[];
  logs: TimeLog[];
  holidays: import("@/lib/types").PublicHoliday[];
  leave: import("@/lib/types").LeaveDay[];
  projects: import("@/lib/types").Project[];
  clients: import("@/lib/types").Client[];
}) {
  const dailyHours =
    staff.working_days.length > 0
      ? staff.weekly_target_hours / staff.working_days.length
      : 0;
  const holidaySet = new Set(holidays.map((h) => h.holiday_date));
  const leaveSet = new Set(
    leave.filter((l) => l.staff_id === staff.id).map((l) => l.leave_date),
  );

  const weeks = [
    { offset: -1, label: "Last week" },
    { offset: 0, label: "This week" },
    { offset: 1, label: "Next week" },
  ];

  return (
    <div className="p-4 space-y-5">
      {weeks.map(({ offset, label }) => {
        const anchor = shiftWeek(weekDate, offset);
        const days = daysInWeek(anchor);
        const { start, end } = weekRange(anchor);
        return (
          <div key={offset} className="space-y-2">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {fmt(start, "MMM d")} – {fmt(end, "MMM d")}
              </p>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {days.map((d) => {
                const k = ymd(d);
                const isWork = staff.working_days.includes(d.getDay());
                const isHol = holidaySet.has(k);
                const isLeave = leaveSet.has(k);
                const planned = isWork && !isHol && !isLeave ? dailyHours : 0;
                const dayLogs = logs.filter((l) => l.staff_id === staff.id && l.log_date === k);
                const logged = dayLogs.reduce((s, l) => s + Number(l.hours), 0);
                const dayPct = pct(logged, planned);

                return (
                  <div key={k} className="rounded-md border border-border bg-card p-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {fmt(d, "EEE d")}
                    </p>
                    {isHol && <p className="mt-1 text-xs font-medium text-status-on-hold">Holiday</p>}
                    {isLeave && <p className="mt-1 text-xs font-medium text-status-on-hold">Leave</p>}
                    {!isWork && !isHol && !isLeave && (
                      <p className="mt-1 text-xs text-muted-foreground">Off</p>
                    )}
                    {isWork && !isHol && !isLeave && (
                      <>
                        <p className="mt-1 text-sm font-semibold tabular-nums">
                          {logged.toFixed(1)}/{planned.toFixed(1)}h
                        </p>
                        <div className="mt-1">
                          <UtilCell pct={dayPct} />
                        </div>
                      </>
                    )}
                    <ul className="mt-2 space-y-1">
                      {dayLogs.map((l) => {
                        const t = tasks.find((tk) => tk.id === l.task_id);
                        const proj = t ? projects.find((p) => p.id === t.project_id) : null;
                        const cli = proj ? clients.find((c) => c.id === proj.client_id) : null;
                        return (
                          <li key={l.id} className="text-[11px] leading-tight text-muted-foreground">
                            <span className="font-medium text-foreground tabular-nums">{Number(l.hours).toFixed(1)}h</span>{" "}
                            {cli?.name} · {t?.description}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
