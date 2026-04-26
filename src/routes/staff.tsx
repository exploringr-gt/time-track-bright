import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, differenceInCalendarDays } from "date-fns";
import { CalendarIcon, Plus, Trash2, Clock, Pencil } from "lucide-react";

import { api, qk } from "@/lib/queries";
import {
  ACTIVE_STATUSES,
  STATUS_LABEL,
  TASK_STATUSES,
  type Task,
  type TaskStatus,
} from "@/lib/types";
import {
  committedHours,
  loggedHoursForStaff,
  loggedHoursForTask,
  overrunLevel,
  pct,
  plannedHours,
  spreadTaskHours,
  validateTaskBoundary,
} from "@/lib/calc";
import { daysInWeek, fmt, weekRange, ymd } from "@/lib/dates";
import { useSelectedStaff, useUserRole } from "@/lib/staffStore";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import { UtilBar, UtilCell } from "@/components/UtilCell";

export const Route = createFileRoute("/staff")({
  head: () => ({
    meta: [{ title: "My work — Tempo" }],
  }),
  component: StaffPage,
});

function StaffPage() {
  const [selectedId, setSelectedId] = useSelectedStaff();
  const [role, setRole] = useUserRole();
  const navigate = useNavigate();
  const staffQ = useQuery({ queryKey: qk.staff, queryFn: api.listStaff });

  if (staffQ.isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }

  const staff = staffQ.data ?? [];
  const me = staff.find((s) => s.id === selectedId) ?? null;

  // Viewer (PwC NL/KS) is read-only — bounce to Dashboard.
  if (role === "viewer") {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Read-only viewer (PwC NL/KS)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This view is for staff to log their time. As a viewer, head to the
              Dashboard or Billing pages to review and export reports.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => navigate({ to: "/dashboard" })}>
                Go to Dashboard
              </Button>
              <Button variant="outline" onClick={() => navigate({ to: "/billing" })}>
                Go to Billing
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setRole("staff");
                  setSelectedId(null);
                }}
              >
                Switch user
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Who are you?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {staff.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No staff yet. Add team members in{" "}
                <a href="/settings" className="text-primary underline">
                  Settings
                </a>
                .
              </p>
            ) : (
              <Select
                onValueChange={(v) => {
                  if (v === "__viewer__") {
                    setRole("viewer");
                    setSelectedId(null);
                    navigate({ to: "/dashboard" });
                  } else {
                    setRole("staff");
                    setSelectedId(v);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your name" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__viewer__">
                    PwC NL/KS (read-only viewer)
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Workspace
      meStaffId={me.id}
      onSwitch={() => {
        setRole("staff");
        setSelectedId(null);
      }}
    />
  );
}

function Workspace({
  meStaffId,
  onSwitch,
}: {
  meStaffId: string;
  onSwitch: () => void;
}) {
  const qc = useQueryClient();

  const staffQ = useQuery({ queryKey: qk.staff, queryFn: api.listStaff });
  const tasksQ = useQuery({ queryKey: qk.tasks, queryFn: api.listTasks });
  const logsQ = useQuery({ queryKey: qk.timeLogs, queryFn: api.listTimeLogs });
  const projectsQ = useQuery({ queryKey: qk.projects, queryFn: api.listProjects });
  const clientsQ = useQuery({ queryKey: qk.clients, queryFn: api.listClients });
  const holidaysQ = useQuery({ queryKey: qk.holidays, queryFn: api.listHolidays });
  const leaveQ = useQuery({ queryKey: qk.leave, queryFn: api.listLeave });

  const me = (staffQ.data ?? []).find((s) => s.id === meStaffId);
  const myTasks = (tasksQ.data ?? []).filter((t) => t.staff_id === meStaffId);
  const myLogs = (logsQ.data ?? []).filter((l) => l.staff_id === meStaffId);

  // When a task is moved to "complete", auto-open the Log dialog so the staff
  // member can record actual start/end dates and the hours it really took.
  const [autoLogTaskId, setAutoLogTaskId] = useState<string | null>(null);

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      api.updateTask(id, {
        status,
        completed_at: status === "complete" ? new Date().toISOString() : null,
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.tasks });
      toast.success("Status updated");
      if (vars.status === "complete") {
        setAutoLogTaskId(vars.id);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTask = useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.tasks });
      qc.invalidateQueries({ queryKey: qk.timeLogs });
      toast.success("Task deleted");
    },
  });


  // My week stats
  const today = new Date();
  const { start, end } = weekRange(today);
  const planned = me
    ? plannedHours(me, start, end, holidaysQ.data ?? [], leaveQ.data ?? [])
    : 0;
  const logged = loggedHoursForStaff(meStaffId, myLogs, start, end);
  const committed = committedHours(myTasks, myLogs, meStaffId);
  const projectedPct = pct(committed + logged, planned);
  const actualPct = pct(logged, planned);

  const days = daysInWeek(today);
  const dayLogs = days.map((d) => {
    const k = ymd(d);
    return {
      date: d,
      hours: myLogs
        .filter((l) => l.log_date === k)
        .reduce((s, l) => s + Number(l.hours), 0),
    };
  });
  const maxDay = Math.max(8, ...dayLogs.map((d) => d.hours));

  const grouped: Record<string, Task[]> = {
    active: myTasks.filter((t) => ACTIVE_STATUSES.includes(t.status)),
    on_hold: myTasks.filter((t) => t.status === "on_hold"),
    complete: myTasks.filter((t) => t.status === "complete"),
    cancelled: myTasks.filter((t) => t.status === "cancelled"),
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Logged in as
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{me?.name}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onSwitch}>
            Switch user
          </Button>
          <NewTaskDialog meStaffId={meStaffId} />
        </div>
      </div>

      {/* My week */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              This week — planned
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {planned.toFixed(1)}h
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Working days minus leave & holidays
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Projected utilization
              </p>
              <UtilCell pct={projectedPct} />
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {(committed + logged).toFixed(1)}h
            </p>
            <UtilBar pct={projectedPct} />
            <p className="mt-1 text-xs text-muted-foreground">
              Logged + remaining estimates on active tasks
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Actual utilization
              </p>
              <UtilCell pct={actualPct} />
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {logged.toFixed(1)}h
            </p>
            <UtilBar pct={actualPct} />
            <p className="mt-1 text-xs text-muted-foreground">
              Hours actually logged this week
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Daily hours this week</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-28">
            {dayLogs.map((d) => (
              <div key={d.date.toISOString()} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-full w-full items-end">
                  <div
                    className="w-full rounded-t bg-primary/80 transition-all"
                    style={{
                      height: `${(d.hours / maxDay) * 100}%`,
                      minHeight: d.hours > 0 ? "4px" : "0",
                    }}
                    title={`${d.hours.toFixed(1)}h`}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {fmt(d.date, "EEE")}
                </span>
                <span className="text-[10px] tabular-nums font-medium">
                  {d.hours > 0 ? d.hours.toFixed(1) : "—"}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tasks */}
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active ({grouped.active.length})</TabsTrigger>
          <TabsTrigger value="on_hold">On hold ({grouped.on_hold.length})</TabsTrigger>
          <TabsTrigger value="complete">Done ({grouped.complete.length})</TabsTrigger>
          <TabsTrigger value="cancelled">
            Cancelled ({grouped.cancelled.length})
          </TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>
        {(["active", "on_hold", "complete", "cancelled"] as const).map((k) => (
          <TabsContent key={k} value={k} className="mt-4">
            <TaskList
              tasks={grouped[k]}
              logs={myLogs}
              clients={clientsQ.data ?? []}
              projects={projectsQ.data ?? []}
              holidays={holidaysQ.data ?? []}
              leave={leaveQ.data ?? []}
              me={me ?? null}
              onStatus={(id, status) => updateStatus.mutate({ id, status })}
              onDelete={(id) => deleteTask.mutate(id)}
              meStaffId={meStaffId}
              autoLogTaskId={autoLogTaskId}
              onAutoLogClose={() => setAutoLogTaskId(null)}
            />
          </TabsContent>
        ))}
        <TabsContent value="timeline" className="mt-4">
          <TaskTimeline
            tasks={myTasks}
            logs={myLogs}
            clients={clientsQ.data ?? []}
            projects={projectsQ.data ?? []}
            holidays={holidaysQ.data ?? []}
            leave={leaveQ.data ?? []}
            me={me ?? null}
          />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function TaskList({
  tasks,
  logs,
  clients,
  projects,
  holidays,
  leave,
  me,
  onStatus,
  onDelete,
  meStaffId,
}: {
  tasks: Task[];
  logs: import("@/lib/types").TimeLog[];
  clients: import("@/lib/types").Client[];
  projects: import("@/lib/types").Project[];
  holidays: import("@/lib/types").PublicHoliday[];
  leave: import("@/lib/types").LeaveDay[];
  me: import("@/lib/types").Staff | null;
  onStatus: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  meStaffId: string;
}) {
  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          No tasks here.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((t) => {
        const project = projects.find((p) => p.id === t.project_id);
        const client = project ? clients.find((c) => c.id === project.client_id) : null;
        const logged = loggedHoursForTask(t.id, logs);
        const remaining = Math.max(Number(t.estimated_hours) - logged, 0);
        const overrun = overrunLevel(Number(t.estimated_hours), logged);

        return (
          <Card key={t.id} className="overflow-hidden">
            <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    {client?.name ?? "?"} · {project?.name ?? "?"}
                  </p>
                  {(t.start_date || t.due_date) && (
                    <span className="text-xs text-muted-foreground">
                      {t.start_date ? format(new Date(t.start_date), "MMM d") : "?"}
                      {" → "}
                      {t.due_date ? format(new Date(t.due_date), "MMM d") : "?"}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-sm font-medium">{t.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    Est <strong className="text-foreground">{Number(t.estimated_hours).toFixed(1)}h</strong>
                  </span>
                  <span className="tabular-nums">
                    Logged <strong className="text-foreground">{logged.toFixed(1)}h</strong>
                  </span>
                  <span className="tabular-nums">
                    Remaining <strong className="text-foreground">{remaining.toFixed(1)}h</strong>
                  </span>
                  {overrun === "warn" && (
                    <span className="rounded-md bg-util-warn/15 px-1.5 py-0.5 text-util-warn font-semibold">
                      Over estimate
                    </span>
                  )}
                  {overrun === "over" && (
                    <span className="rounded-md bg-util-over/15 px-1.5 py-0.5 text-util-over font-semibold">
                      Overrun &gt;25%
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={t.status}
                  onValueChange={(v) => onStatus(t.id, v as TaskStatus)}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <LogTimeDialog task={t} meStaffId={meStaffId} onLogged={() => onStatus(t.id, "in_progress")} />
                {me && (
                  <EditTaskDialog
                    task={t}
                    me={me}
                    holidays={holidays}
                    leave={leave}
                    logs={logs}
                  />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm("Delete this task and all its time logs?")) onDelete(t.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
            <div className="border-t border-border">
              <StatusBadge status={t.status} className="m-2" />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function NewTaskDialog({ meStaffId }: { meStaffId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [estimate, setEstimate] = useState("1");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [status, setStatus] = useState<TaskStatus>("not_started");

  const clientsQ = useQuery({ queryKey: qk.clients, queryFn: api.listClients });
  const projectsQ = useQuery({ queryKey: qk.projects, queryFn: api.listProjects });
  const staffQ = useQuery({ queryKey: qk.staff, queryFn: api.listStaff });
  const holidaysQ = useQuery({ queryKey: qk.holidays, queryFn: api.listHolidays });
  const leaveQ = useQuery({ queryKey: qk.leave, queryFn: api.listLeave });

  const me = (staffQ.data ?? []).find((s) => s.id === meStaffId) ?? null;

  // Resolve (or create) a default project for the selected client.
  async function resolveProjectId(): Promise<string> {
    const all = projectsQ.data ?? [];
    const existing = all.find((p) => p.client_id === clientId);
    if (existing) return existing.id;
    const created = await api.createProject({ client_id: clientId, name: "General" });
    qc.invalidateQueries({ queryKey: qk.projects });
    return created[0].id;
  }

  const create = useMutation({
    mutationFn: async () => {
      // Validate dates
      if (me) {
        if (startDate) {
          const err = validateTaskBoundary(ymd(startDate), me, holidaysQ.data ?? [], leaveQ.data ?? []);
          if (err) throw new Error(`Start date: ${err}`);
        }
        if (dueDate) {
          const err = validateTaskBoundary(ymd(dueDate), me, holidaysQ.data ?? [], leaveQ.data ?? []);
          if (err) throw new Error(`Due date: ${err}`);
        }
      }
      if (startDate && dueDate && startDate > dueDate) {
        throw new Error("Start date must be on or before due date.");
      }
      const projectId = await resolveProjectId();
      return api.createTask({
        staff_id: meStaffId,
        project_id: projectId,
        description,
        estimated_hours: Number(estimate) || 0,
        status,
        start_date: startDate ? ymd(startDate) : null,
        due_date: dueDate ? ymd(dueDate) : null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.tasks });
      toast.success("Task added");
      setOpen(false);
      setDescription("");
      setEstimate("1");
      setStartDate(undefined);
      setDueDate(undefined);
      setStatus("not_started");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" />
          New task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {(clientsQ.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Estimated hours</Label>
            <Input
              type="number"
              step="0.25"
              min="0"
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Due date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start", !dueDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP") : "Pick"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!clientId || !description || create.isPending}
          >
            Add task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LogTimeDialog({
  task,
  meStaffId,
  onLogged,
}: {
  task: Task;
  meStaffId: string;
  onLogged: () => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date>(new Date());
  const [hours, setHours] = useState("1");
  const [notes, setNotes] = useState("");

  const log = useMutation({
    mutationFn: async () => {
      const logDate = ymd(date);
      const created = await api.createTimeLog({
        task_id: task.id,
        staff_id: meStaffId,
        log_date: logDate,
        hours: Number(hours),
        notes: notes || null,
      });
      // Auto-extend actual_start_date / actual_end_date based on log range.
      // Users can still override via Edit task.
      const patch: Partial<Task> = {};
      if (!task.actual_start_date || logDate < task.actual_start_date) {
        patch.actual_start_date = logDate;
      }
      if (!task.actual_end_date || logDate > task.actual_end_date) {
        patch.actual_end_date = logDate;
      }
      if (Object.keys(patch).length > 0) {
        await api.updateTask(task.id, patch);
      }
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.timeLogs });
      qc.invalidateQueries({ queryKey: qk.tasks });
      toast.success("Time logged");
      setOpen(false);
      setHours("1");
      setNotes("");
      if (task.status === "not_started") onLogged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Clock className="mr-1 h-4 w-4" />
          Log
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log time — {task.description}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(date, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Hours</Label>
              <Input
                type="number"
                step="0.25"
                min="0.25"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => log.mutate()} disabled={!hours || log.isPending}>
            Log
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditTaskDialog({
  task,
  me,
  holidays,
  leave,
  logs,
}: {
  task: Task;
  me: import("@/lib/types").Staff;
  holidays: import("@/lib/types").PublicHoliday[];
  leave: import("@/lib/types").LeaveDay[];
  logs: import("@/lib/types").TimeLog[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  // Derive defaults from logs for actual dates if none set yet.
  const taskLogs = logs.filter((l) => l.task_id === task.id);
  const sortedDates = taskLogs.map((l) => l.log_date).sort();
  const derivedActualStart = sortedDates[0] ?? null;
  const derivedActualEnd = sortedDates[sortedDates.length - 1] ?? null;

  const [startDate, setStartDate] = useState<Date | undefined>(
    task.start_date ? new Date(task.start_date) : undefined,
  );
  const [dueDate, setDueDate] = useState<Date | undefined>(
    task.due_date ? new Date(task.due_date) : undefined,
  );
  const [actualStart, setActualStart] = useState<Date | undefined>(
    task.actual_start_date
      ? new Date(task.actual_start_date)
      : derivedActualStart
        ? new Date(derivedActualStart)
        : undefined,
  );
  const [actualEnd, setActualEnd] = useState<Date | undefined>(
    task.actual_end_date
      ? new Date(task.actual_end_date)
      : derivedActualEnd
        ? new Date(derivedActualEnd)
        : undefined,
  );
  const [estimate, setEstimate] = useState(String(task.estimated_hours ?? 0));

  const save = useMutation({
    mutationFn: async () => {
      // Validate planned boundaries against working calendar
      if (startDate) {
        const err = validateTaskBoundary(ymd(startDate), me, holidays, leave);
        if (err) throw new Error(`Start date: ${err}`);
      }
      if (dueDate) {
        const err = validateTaskBoundary(ymd(dueDate), me, holidays, leave);
        if (err) throw new Error(`Due date: ${err}`);
      }
      if (startDate && dueDate && startDate > dueDate) {
        throw new Error("Start date must be on or before due date.");
      }
      if (actualStart && actualEnd && actualStart > actualEnd) {
        throw new Error("Actual start must be on or before actual end.");
      }
      return api.updateTask(task.id, {
        estimated_hours: Number(estimate) || 0,
        start_date: startDate ? ymd(startDate) : null,
        due_date: dueDate ? ymd(dueDate) : null,
        actual_start_date: actualStart ? ymd(actualStart) : null,
        actual_end_date: actualEnd ? ymd(actualEnd) : null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.tasks });
      toast.success("Task updated");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Edit task">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit task — {task.description}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label>Estimated hours</Label>
            <Input
              type="number"
              step="0.25"
              min="0"
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Planned span
            </p>
            <div className="mt-1 grid grid-cols-2 gap-3">
              <DateField label="Start date" value={startDate} onChange={setStartDate} />
              <DateField label="Due date" value={dueDate} onChange={setDueDate} />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Actual span
              <span className="ml-1 font-normal normal-case text-muted-foreground">
                (prefilled from logs)
              </span>
            </p>
            <div className="mt-1 grid grid-cols-2 gap-3">
              <DateField label="Actual start" value={actualStart} onChange={setActualStart} />
              <DateField label="Actual end" value={actualEnd} onChange={setActualEnd} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("w-full justify-start", !value && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "PPP") : "Pick"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function TaskTimeline({
  tasks,
  logs,
  clients,
  projects,
  holidays,
  leave,
  me,
}: {
  tasks: Task[];
  logs: import("@/lib/types").TimeLog[];
  clients: import("@/lib/types").Client[];
  projects: import("@/lib/types").Project[];
  holidays: import("@/lib/types").PublicHoliday[];
  leave: import("@/lib/types").LeaveDay[];
  me: import("@/lib/types").Staff | null;
}) {
  // Filter to tasks with at least a planned or actual span.
  const visible = useMemo(
    () =>
      tasks
        .filter((t) => t.start_date || t.due_date || t.actual_start_date || t.actual_end_date)
        .sort((a, b) => {
          const aS = a.start_date ?? a.actual_start_date ?? "";
          const bS = b.start_date ?? b.actual_start_date ?? "";
          return aS.localeCompare(bS);
        }),
    [tasks],
  );

  // Compute global span across all visible tasks for the bar scale.
  const range = useMemo(() => {
    const all: string[] = [];
    visible.forEach((t) => {
      if (t.start_date) all.push(t.start_date);
      if (t.due_date) all.push(t.due_date);
      if (t.actual_start_date) all.push(t.actual_start_date);
      if (t.actual_end_date) all.push(t.actual_end_date);
    });
    if (all.length === 0) return null;
    all.sort();
    const min = new Date(all[0]);
    const max = new Date(all[all.length - 1]);
    const totalDays = Math.max(differenceInCalendarDays(max, min) + 1, 1);
    return { min, max, totalDays };
  }, [visible]);

  if (visible.length === 0 || !range) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          No tasks have planned or actual dates yet. Add a start &amp; due date in the New / Edit task dialog.
        </CardContent>
      </Card>
    );
  }

  function pctFromStart(d: Date) {
    return (differenceInCalendarDays(d, range!.min) / range!.totalDays) * 100;
  }
  function pctWidth(a: Date, b: Date) {
    return ((differenceInCalendarDays(b, a) + 1) / range!.totalDays) * 100;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Task timeline — planned vs actual</CardTitle>
        <p className="text-xs text-muted-foreground tabular-nums">
          {format(range.min, "MMM d, yyyy")} – {format(range.max, "MMM d, yyyy")}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {visible.map((t) => {
            const project = projects.find((p) => p.id === t.project_id);
            const client = project ? clients.find((c) => c.id === project.client_id) : null;
            const planned =
              t.start_date && t.due_date
                ? { start: new Date(t.start_date), end: new Date(t.due_date) }
                : null;
            const actual =
              t.actual_start_date && t.actual_end_date
                ? {
                    start: new Date(t.actual_start_date),
                    end: new Date(t.actual_end_date),
                  }
                : null;

            const spread = me && planned ? spreadTaskHours(t, me, holidays, leave) : new Map();
            const totalSpread = Array.from(spread.values()).reduce(
              (s: number, n) => s + (n as number),
              0,
            );
            const dailyAvg =
              spread.size > 0 ? totalSpread / spread.size : 0;
            const logged = loggedHoursForTask(t.id, logs);

            return (
              <div key={t.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.description}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {client?.name ?? "?"} · {project?.name ?? "?"}
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {Number(t.estimated_hours).toFixed(1)}h est ·{" "}
                    {logged.toFixed(1)}h logged
                    {planned && spread.size > 0 && (
                      <>
                        {" · "}~{dailyAvg.toFixed(1)}h/day over {spread.size}d
                      </>
                    )}
                  </p>
                </div>

                <div className="relative mt-3 h-7 w-full rounded bg-muted/40">
                  {planned && (
                    <div
                      className="absolute top-0 h-3 rounded bg-primary/40"
                      style={{
                        left: `${pctFromStart(planned.start)}%`,
                        width: `${pctWidth(planned.start, planned.end)}%`,
                      }}
                      title={`Planned: ${format(planned.start, "MMM d")} – ${format(planned.end, "MMM d")}`}
                    />
                  )}
                  {actual && (
                    <div
                      className="absolute bottom-0 h-3 rounded bg-util-good/70"
                      style={{
                        left: `${pctFromStart(actual.start)}%`,
                        width: `${pctWidth(actual.start, actual.end)}%`,
                      }}
                      title={`Actual: ${format(actual.start, "MMM d")} – ${format(actual.end, "MMM d")}`}
                    />
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-3 rounded bg-primary/40" />
                    Planned{" "}
                    {planned
                      ? `${format(planned.start, "MMM d")} → ${format(planned.end, "MMM d")}`
                      : "—"}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-3 rounded bg-util-good/70" />
                    Actual{" "}
                    {actual
                      ? `${format(actual.start, "MMM d")} → ${format(actual.end, "MMM d")}`
                      : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
