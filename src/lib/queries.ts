import { supabase } from "@/integrations/supabase/client";
import type {
  Staff,
  Client,
  Project,
  Task,
  TimeLog,
  PublicHoliday,
  LeaveDay,
} from "./types";

async function unwrap<T>(p: Promise<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

export const api = {
  // Staff
  listStaff: () =>
    unwrap<Staff[]>(
      supabase.from("staff").select("*").order("name") as never,
    ),
  createStaff: (input: { name: string; weekly_target_hours?: number }) =>
    unwrap<Staff[]>(
      supabase.from("staff").insert(input).select() as never,
    ),
  updateStaff: (id: string, patch: Partial<Staff>) =>
    unwrap<Staff[]>(
      supabase.from("staff").update(patch).eq("id", id).select() as never,
    ),
  deleteStaff: (id: string) =>
    unwrap(supabase.from("staff").delete().eq("id", id) as never),

  // Clients
  listClients: () =>
    unwrap<Client[]>(
      supabase.from("clients").select("*").order("name") as never,
    ),
  createClient: (name: string) =>
    unwrap<Client[]>(
      supabase.from("clients").insert({ name }).select() as never,
    ),
  deleteClient: (id: string) =>
    unwrap(supabase.from("clients").delete().eq("id", id) as never),

  // Projects
  listProjects: () =>
    unwrap<Project[]>(
      supabase.from("projects").select("*").order("name") as never,
    ),
  createProject: (input: { client_id: string; name: string }) =>
    unwrap<Project[]>(
      supabase.from("projects").insert(input).select() as never,
    ),
  deleteProject: (id: string) =>
    unwrap(supabase.from("projects").delete().eq("id", id) as never),

  // Tasks
  listTasks: () =>
    unwrap<Task[]>(
      supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false }) as never,
    ),
  createTask: (input: {
    staff_id: string;
    project_id: string;
    description: string;
    estimated_hours?: number;
    status?: Task["status"];
    start_date?: string | null;
    due_date?: string | null;
    actual_start_date?: string | null;
    actual_end_date?: string | null;
  }) =>
    unwrap<Task[]>(
      supabase.from("tasks").insert(input).select() as never,
    ),
  updateTask: (id: string, patch: Partial<Task>) =>
    unwrap<Task[]>(
      supabase.from("tasks").update(patch).eq("id", id).select() as never,
    ),
  deleteTask: (id: string) =>
    unwrap(supabase.from("tasks").delete().eq("id", id) as never),

  // Time logs
  listTimeLogs: () =>
    unwrap<TimeLog[]>(
      supabase
        .from("time_logs")
        .select("*")
        .order("log_date", { ascending: false }) as never,
    ),
  createTimeLog: (input: {
    task_id: string;
    staff_id: string;
    log_date: string;
    hours: number;
    notes?: string | null;
  }) =>
    unwrap<TimeLog[]>(
      supabase.from("time_logs").insert(input).select() as never,
    ),
  deleteTimeLog: (id: string) =>
    unwrap(supabase.from("time_logs").delete().eq("id", id) as never),

  // Holidays
  listHolidays: () =>
    unwrap<PublicHoliday[]>(
      supabase.from("public_holidays").select("*").order("holiday_date") as never,
    ),
  createHoliday: (input: { holiday_date: string; name: string }) =>
    unwrap<PublicHoliday[]>(
      supabase.from("public_holidays").insert(input).select() as never,
    ),
  deleteHoliday: (id: string) =>
    unwrap(supabase.from("public_holidays").delete().eq("id", id) as never),

  // Leave
  listLeave: () =>
    unwrap<LeaveDay[]>(
      supabase.from("leave_days").select("*").order("leave_date") as never,
    ),
  createLeave: (input: { staff_id: string; leave_date: string; reason?: string }) =>
    unwrap<LeaveDay[]>(
      supabase.from("leave_days").insert(input).select() as never,
    ),
  deleteLeave: (id: string) =>
    unwrap(supabase.from("leave_days").delete().eq("id", id) as never),
};

export const qk = {
  staff: ["staff"] as const,
  clients: ["clients"] as const,
  projects: ["projects"] as const,
  tasks: ["tasks"] as const,
  timeLogs: ["timeLogs"] as const,
  holidays: ["holidays"] as const,
  leave: ["leave"] as const,
};
