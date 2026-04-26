import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addMonths, format, startOfMonth } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as Cr,
  FileSpreadsheet,
  FileText,
} from "lucide-react";

import { api, qk } from "@/lib/queries";
import { monthRange, ymd } from "@/lib/dates";
import { exportXLSX, exportPDF } from "@/lib/exports";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/billing")({
  head: () => ({ meta: [{ title: "Billing — Tempo" }] }),
  component: Billing,
});

function Billing() {
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterStaff, setFilterStaff] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const staffQ = useQuery({ queryKey: qk.staff, queryFn: api.listStaff });
  const tasksQ = useQuery({ queryKey: qk.tasks, queryFn: api.listTasks });
  const logsQ = useQuery({ queryKey: qk.timeLogs, queryFn: api.listTimeLogs });
  const projectsQ = useQuery({ queryKey: qk.projects, queryFn: api.listProjects });
  const clientsQ = useQuery({ queryKey: qk.clients, queryFn: api.listClients });

  const { start, end } = monthRange(month);
  const startKey = ymd(start);
  const endKey = ymd(end);

  const grouped = useMemo(() => {
    const tasks = tasksQ.data ?? [];
    const projects = projectsQ.data ?? [];
    const clients = clientsQ.data ?? [];
    const staff = staffQ.data ?? [];
    const logs = (logsQ.data ?? []).filter(
      (l) => l.log_date >= startKey && l.log_date <= endKey,
    );

    type StaffRow = { staffId: string; staffName: string; total: number; tasks: { taskId: string; description: string; hours: number }[] };
    type ClientRow = { clientId: string; clientName: string; total: number; staff: StaffRow[] };

    const byClient = new Map<string, ClientRow>();

    for (const log of logs) {
      const task = tasks.find((t) => t.id === log.task_id);
      if (!task || task.status === "cancelled") continue;
      const project = projects.find((p) => p.id === task.project_id);
      if (!project) continue;
      const client = clients.find((c) => c.id === project.client_id);
      if (!client) continue;
      const st = staff.find((s) => s.id === task.staff_id);
      if (!st) continue;

      if (filterClient !== "all" && client.id !== filterClient) continue;
      if (filterStaff !== "all" && st.id !== filterStaff) continue;

      let cRow = byClient.get(client.id);
      if (!cRow) {
        cRow = { clientId: client.id, clientName: client.name, total: 0, staff: [] };
        byClient.set(client.id, cRow);
      }
      cRow.total += Number(log.hours);

      let sRow = cRow.staff.find((x) => x.staffId === st.id);
      if (!sRow) {
        sRow = { staffId: st.id, staffName: st.name, total: 0, tasks: [] };
        cRow.staff.push(sRow);
      }
      sRow.total += Number(log.hours);

      let tRow = sRow.tasks.find((x) => x.taskId === task.id);
      if (!tRow) {
        tRow = { taskId: task.id, description: `${project.name} · ${task.description}`, hours: 0 };
        sRow.tasks.push(tRow);
      }
      tRow.hours += Number(log.hours);
    }

    return Array.from(byClient.values()).sort((a, b) => b.total - a.total);
  }, [tasksQ.data, projectsQ.data, clientsQ.data, staffQ.data, logsQ.data, startKey, endKey, filterClient, filterStaff]);

  const grandTotal = grouped.reduce((s, c) => s + c.total, 0);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const monthLabel = format(month, "MMMM yyyy");

  const flatRows = useMemo(() => {
    const rows: Record<string, unknown>[] = [];
    for (const c of grouped) {
      for (const s of c.staff) {
        for (const t of s.tasks) {
          rows.push({
            client: c.clientName,
            staff: s.staffName,
            task: t.description,
            hours: t.hours.toFixed(2),
          });
        }
      }
    }
    return rows;
  }, [grouped]);

  const handleExportXLSX = () => {
    exportXLSX(`billing-${format(month, "yyyy-MM")}`, [
      {
        name: "Detail",
        columns: [
          { header: "Client", key: "client", width: 24 },
          { header: "Staff", key: "staff", width: 22 },
          { header: "Task", key: "task", width: 50 },
          { header: "Hours", key: "hours" },
        ],
        rows: flatRows,
      },
      {
        name: "Summary by client",
        columns: [
          { header: "Client", key: "client", width: 26 },
          { header: "Hours", key: "hours" },
        ],
        rows: grouped.map((c) => ({
          client: c.clientName,
          hours: c.total.toFixed(2),
        })),
      },
    ]);
  };

  const handleExportPDF = () => {
    exportPDF(
      `billing-${format(month, "yyyy-MM")}`,
      "Billing Report",
      `${monthLabel} · Cancelled tasks excluded · Grand total ${grandTotal.toFixed(2)}h`,
      [
        {
          heading: "Summary by client",
          columns: [
            { header: "Client", key: "client" },
            { header: "Hours", key: "hours" },
          ],
          rows: grouped.map((c) => ({
            client: c.clientName,
            hours: c.total.toFixed(2) + "h",
          })),
        },
        {
          heading: "Detail",
          columns: [
            { header: "Client", key: "client" },
            { header: "Staff", key: "staff" },
            { header: "Task", key: "task" },
            { header: "Hours", key: "hours" },
          ],
          rows: flatRows,
        },
      ],
    );
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
          <p className="text-sm text-muted-foreground">
            Hours per client per staff for the selected month. Cancelled tasks excluded.
          </p>
        </div>
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
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {(clientsQ.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStaff} onValueChange={setFilterStaff}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All staff</SelectItem>
              {(staffQ.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        {grouped.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No billable hours in this period.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {grouped.map((c) => {
              const cKey = `c:${c.clientId}`;
              const cOpen = expanded.has(cKey);
              return (
                <div key={c.clientId}>
                  <button
                    onClick={() => toggle(cKey)}
                    className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-accent/40"
                  >
                    <div className="flex items-center gap-2">
                      {cOpen ? <ChevronDown className="h-4 w-4" /> : <Cr className="h-4 w-4" />}
                      <span className="font-semibold">{c.clientName}</span>
                    </div>
                    <span className="text-sm font-bold tabular-nums">{c.total.toFixed(2)}h</span>
                  </button>
                  {cOpen && (
                    <div className="border-t border-border bg-muted/20">
                      {c.staff.map((s) => {
                        const sKey = `s:${c.clientId}:${s.staffId}`;
                        const sOpen = expanded.has(sKey);
                        return (
                          <div key={s.staffId} className="border-b border-border last:border-b-0">
                            <button
                              onClick={() => toggle(sKey)}
                              className="flex w-full items-center justify-between gap-3 px-3 py-2 pl-10 text-left text-sm hover:bg-accent/40"
                            >
                              <div className="flex items-center gap-2">
                                {sOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <Cr className="h-3.5 w-3.5" />}
                                <span>{s.staffName}</span>
                              </div>
                              <span className="font-medium tabular-nums">{s.total.toFixed(2)}h</span>
                            </button>
                            {sOpen && (
                              <ul className="bg-background/60 px-3 pb-2 pl-16">
                                {s.tasks.map((t) => (
                                  <li key={t.taskId} className="flex items-center justify-between py-1 text-xs">
                                    <span className="text-muted-foreground">{t.description}</span>
                                    <span className="tabular-nums">{t.hours.toFixed(2)}h</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex items-center justify-between bg-muted/40 p-3">
              <span className="font-semibold">Grand total</span>
              <span className="text-lg font-bold tabular-nums">{grandTotal.toFixed(2)}h</span>
            </div>
          </div>
        )}
      </Card>
    </main>
  );
}
