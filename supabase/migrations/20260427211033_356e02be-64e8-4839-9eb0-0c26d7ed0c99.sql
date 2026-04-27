-- Migrate any existing 'on_hold' tasks to 'not_started'
UPDATE public.tasks SET status = 'not_started' WHERE status = 'on_hold';

-- Recreate task_status enum without 'on_hold'
ALTER TYPE public.task_status RENAME TO task_status_old;

CREATE TYPE public.task_status AS ENUM (
  'not_started',
  'in_progress',
  'complete',
  'cancelled'
);

ALTER TABLE public.tasks
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.task_status USING status::text::public.task_status,
  ALTER COLUMN status SET DEFAULT 'not_started'::public.task_status;

DROP TYPE public.task_status_old;