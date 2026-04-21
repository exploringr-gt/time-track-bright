import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { api, qk } from "@/lib/queries";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
          Manage staff, clients, projects, and public holidays.
        </p>
      </div>
      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
        </TabsList>
        <TabsContent value="staff" className="mt-4"><StaffSection /></TabsContent>
        <TabsContent value="clients" className="mt-4"><ClientsSection /></TabsContent>
        <TabsContent value="projects" className="mt-4"><ProjectsSection /></TabsContent>
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

  const create = useMutation({
    mutationFn: () => api.createClient(name.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.clients });
      setName("");
      toast.success("Client added");
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
            <li key={c.id} className="flex items-center justify-between p-3">
              <p className="text-sm font-medium">{c.name}</p>
              <Button variant="ghost" size="icon" onClick={() => {
                if (confirm(`Delete ${c.name}? This removes their projects and tasks.`)) remove.mutate(c.id);
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

function ProjectsSection() {
  const qc = useQueryClient();
  const clientsQ = useQuery({ queryKey: qk.clients, queryFn: api.listClients });
  const q = useQuery({ queryKey: qk.projects, queryFn: api.listProjects });
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");

  const create = useMutation({
    mutationFn: () => api.createProject({ client_id: clientId, name: name.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projects });
      setName("");
      toast.success("Project added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projects });
      qc.invalidateQueries({ queryKey: qk.tasks });
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Projects</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger><SelectValue placeholder="Client" /></SelectTrigger>
            <SelectContent>
              {(clientsQ.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" />
          <Button onClick={() => create.mutate()} disabled={!clientId || !name.trim()}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
        <ul className="divide-y divide-border rounded-md border border-border">
          {(q.data ?? []).length === 0 && (
            <li className="p-4 text-center text-sm text-muted-foreground">No projects yet.</li>
          )}
          {(q.data ?? []).map((p) => {
            const client = (clientsQ.data ?? []).find((c) => c.id === p.client_id);
            return (
              <li key={p.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{client?.name}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => {
                  if (confirm(`Delete ${p.name}? This removes its tasks.`)) remove.mutate(p.id);
                }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
