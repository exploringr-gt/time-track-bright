import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash2, Pencil, Check, X } from "lucide-react";

import { api, qk } from "@/lib/queries";
import { ymd } from "@/lib/dates";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Tempo" }] }),
  component: Settings,
});

function Settings() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage staff, clients, and public holidays.
        </p>
      </div>
      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="holidays">Public holidays</TabsTrigger>
        </TabsList>
        <TabsContent value="staff" className="mt-4"><StaffSection /></TabsContent>
        <TabsContent value="clients" className="mt-4"><ClientsSection /></TabsContent>
        <TabsContent value="holidays" className="mt-4"><HolidaysSection /></TabsContent>
      </Tabs>
    </main>
  );
}

function StaffSection() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.staff, queryFn: api.listStaff });
  const [name, setName] = useState("");
  const [hours, setHours] = useState("40");

  const create = useMutation({
    mutationFn: () =>
      api.createStaff({ name: name.trim(), weekly_target_hours: Number(hours) || 40 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.staff });
      setName("");
      setHours("40");
      toast.success("Staff added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteStaff(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.staff });
      qc.invalidateQueries({ queryKey: qk.tasks });
      qc.invalidateQueries({ queryKey: qk.timeLogs });
      toast.success("Staff removed");
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Staff members</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_auto]">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex Kim" />
          </div>
          <div>
            <Label className="text-xs">Weekly hours</Label>
            <Input type="number" step="1" min="1" value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending} className="w-full sm:w-auto">
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>
        </div>
        <ul className="divide-y divide-border rounded-md border border-border">
          {(q.data ?? []).length === 0 && (
            <li className="p-4 text-center text-sm text-muted-foreground">No staff yet.</li>
          )}
          {(q.data ?? []).map((s) => (
            <li key={s.id} className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {Number(s.weekly_target_hours).toFixed(0)}h/week
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => {
                if (confirm(`Delete ${s.name}? This removes their tasks and time logs.`)) remove.mutate(s.id);
              }}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ClientsSection() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.clients, queryFn: api.listClients });
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const create = useMutation({
    mutationFn: () => api.createClient(name.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.clients });
      setName("");
      toast.success("Client added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.updateClient(id, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.clients });
      setEditingId(null);
      toast.success("Client updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteClient(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.clients });
      qc.invalidateQueries({ queryKey: qk.projects });
      qc.invalidateQueries({ queryKey: qk.tasks });
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Clients</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name" />
          <Button onClick={() => create.mutate()} disabled={!name.trim()}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
        <ul className="divide-y divide-border rounded-md border border-border">
          {(q.data ?? []).length === 0 && (
            <li className="p-4 text-center text-sm text-muted-foreground">No clients yet.</li>
          )}
          {(q.data ?? []).map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 p-3">
              {editingId === c.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={!editName.trim() || update.isPending}
                      onClick={() => update.mutate({ id: c.id, name: editName.trim() })}
                    >
                      <Check className="h-4 w-4 text-status-complete" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">{c.name}</p>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingId(c.id);
                        setEditName(c.name);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      if (confirm(`Delete ${c.name}? This removes their projects and tasks.`)) remove.mutate(c.id);
                    }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function HolidaysSection() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.holidays, queryFn: api.listHolidays });
  const [date, setDate] = useState<Date | undefined>();
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api.createHoliday({ holiday_date: ymd(date!), name: name.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.holidays });
      toast.success("Holiday added");
      setDate(undefined);
      setName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteHoliday(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.holidays });
      toast.success("Holiday removed");
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Public holidays</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr_auto]">
          <div>
            <Label className="text-xs">Date</Label>
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
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Labor Day" />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => create.mutate()}
              disabled={!date || !name.trim() || create.isPending}
              className="w-full sm:w-auto"
            >
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>
        </div>
        <ul className="divide-y divide-border rounded-md border border-border">
          {(q.data ?? []).length === 0 && (
            <li className="p-4 text-center text-sm text-muted-foreground">No holidays yet.</li>
          )}
          {(q.data ?? []).map((h) => (
            <li key={h.id} className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium">{h.name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {format(new Date(h.holiday_date), "EEE, MMM d, yyyy")}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => {
                if (confirm(`Remove ${h.name}?`)) remove.mutate(h.id);
              }}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
