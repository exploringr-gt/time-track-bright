export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "on_hold"
  | "complete"
  | "cancelled";

export const TASK_STATUSES: TaskStatus[] = [
  "not_started",
  "in_progress",
  "on_hold",
  "complete",
  "cancelled",
];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  on_hold: "On hold",
  complete: "Complete",
  cancelled: "Cancelled",
};

export const ACTIVE_STATUSES: TaskStatus[] = ["not_started", "in_progress"];

export interface Staff {
  id: string;
  name: string;
  weekly_target_hours: number;
  working_days: number[];
  is_active: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  staff_id: string;
  project_id: string;
  description: string;
  estimated_hours: number;
  status: TaskStatus;
  start_date: string | null;
  due_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeLog {
  id: string;
  task_id: string;
  staff_id: string;
  log_date: string;
  hours: number;
  notes: string | null;
  created_at: string;
}

export interface PublicHoliday {
  id: string;
  holiday_date: string;
  name: string;
  created_at: string;
}

export interface LeaveDay {
  id: string;
  staff_id: string;
  leave_date: string;
  reason: string | null;
  created_at: string;
}
