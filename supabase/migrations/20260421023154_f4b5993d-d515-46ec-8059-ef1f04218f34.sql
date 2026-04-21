
-- Enums
CREATE TYPE public.task_status AS ENUM ('not_started', 'in_progress', 'on_hold', 'complete', 'cancelled');

-- Staff
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  weekly_target_hours NUMERIC(5,2) NOT NULL DEFAULT 40,
  working_days INT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5], -- 0=Sun..6=Sat
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clients
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, name)
);

-- Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  estimated_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  status public.task_status NOT NULL DEFAULT 'not_started',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Time logs
CREATE TABLE public.time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  hours NUMERIC(5,2) NOT NULL CHECK (hours > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Public holidays (org-wide)
CREATE TABLE public.public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leave days (per staff)
CREATE TABLE public.leave_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  leave_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(staff_id, leave_date)
);

-- Indexes
CREATE INDEX idx_tasks_staff ON public.tasks(staff_id);
CREATE INDEX idx_tasks_project ON public.tasks(project_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_time_logs_task ON public.time_logs(task_id);
CREATE INDEX idx_time_logs_staff_date ON public.time_logs(staff_id, log_date);
CREATE INDEX idx_leave_days_staff ON public.leave_days(staff_id, leave_date);

-- Updated_at trigger for tasks
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER tasks_set_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS on all tables
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_days ENABLE ROW LEVEL SECURITY;

-- This is an internal team tool with no authentication by design (name dropdown only).
-- Therefore we allow anonymous access to all operations on all tables.
-- If auth is added later, these policies should be tightened.

CREATE POLICY "anon all staff" ON public.staff FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon all clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon all projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon all tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon all time_logs" ON public.time_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon all public_holidays" ON public.public_holidays FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon all leave_days" ON public.leave_days FOR ALL USING (true) WITH CHECK (true);
