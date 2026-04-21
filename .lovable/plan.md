
## Team Time Tracking & Utilization App (revised)

A no-login web app where staff log time against tasks and supervisors monitor utilization, availability, and billable hours. Availability now factors in **task status** so commitments only consume capacity while a task is actually active.

### Core concept
- **Staff** pick their name from a dropdown, then log tasks and daily hours.
- **Supervisors** switch into a dashboard view to monitor everyone.
- No passwords — name selection drives the experience.

### Task status (new)
Every task has a status: **Not started**, **In progress**, **On hold**, **Complete**, **Cancelled**.

Status drives availability calculations:
- **Not started** + **In progress** → remaining estimated hours are counted as committed capacity.
- **On hold** → excluded from current availability (still visible, flagged separately).
- **Complete** + **Cancelled** → excluded from availability entirely. Complete tasks still contribute to billable totals; cancelled tasks do not.

### Availability & utilization model

For a given staff member over a given day or week:

```text
Planned capacity   = working hours in period − leave − public holidays
Committed hours    = sum of (estimated − already logged) for active tasks
                     (active = Not started or In progress)
Projected util %   = Committed ÷ Planned          (forecast)
Actual util %      = Logged hours ÷ Planned       (real, once time is logged)
Available hours    = Planned − Committed − Logged-on-other-tasks
```

Behavior:
- Before any time is logged, the dashboard shows **projected utilization** from estimates + active statuses.
- As staff log actual hours, **actual utilization** appears alongside the projection.
- Marking a task **Complete / Cancelled / On hold** instantly frees committed capacity and updates availability live.

### Data model
- **Staff** — name, weekly target hours (default 40), working days (default Mon–Fri).
- **Clients** — name, active flag.
- **Projects** — name, linked to client.
- **Tasks** — staff, project, description, estimated hours, **status** (enum), due date, completed_at.
- **Time logs** — task, staff, date, hours.
- **Calendar exceptions** — public holidays (org-wide), leave days (per staff).

### Pages

**1. Home / role switcher** — pick staff or supervisor view.

**2. Staff workspace**
- **My tasks** — grouped by status tab (Active / On hold / Done / Cancelled). Each row shows estimate, hours logged, remaining, due date, overrun badge.
- **Add / edit task** — client → project → description → estimated hours → due date → status (defaults to Not started).
- **Quick status change** — inline dropdown on each task row.
- **Log time** — pick task, date, hours. Logging time on a Not-started task auto-prompts to switch it to In progress.
- **My week** — daily bars showing logged vs planned, plus a "remaining commitment this week" figure derived from active tasks.
- **Overrun badge** — amber when logged > estimate, red when logged > 1.25 × estimate.

**3. Supervisor dashboard**
- **Week selector** — Last / This / Next week + date jump.
- **Team table** — one row per staff:
  - Planned hours
  - Committed hours (from active tasks)
  - Logged hours
  - Projected utilization %
  - Actual utilization %
  - Available hours remaining
  - Counts: active / on-hold / overdue / overrunning tasks
- **Color cues** — green ≤85%, amber 85–100%, red >100% (separately for projected vs actual).
- **Drill-down** — click a staff row → daily view: each day shows planned, committed, logged, and the tasks driving each.
- **Overruns panel** — all active tasks across the team currently >25% over estimate.
- **On-hold panel** — visibility into parked work that isn't consuming capacity.

**4. Planner (supervisor)**
- Calendar grid: staff rows × day columns.
- Each cell shows planned capacity, leave, holiday, committed (from active tasks), and logged hours, with an over/under capacity cue.
- Add public holidays (org-wide) and per-staff leave days inline.

**5. Billing view (supervisor)**
- Month selector.
- Table grouped by **client → staff → total logged hours** for the month, with project/task breakdown on expand.
- Cancelled tasks excluded; on-hold and complete tasks included for any hours actually logged.
- Filters by client, staff, project. Grand total per client.

### Setup / admin
- Settings page (accessible from supervisor view) to manage staff, clients, projects, and public holidays.

### Real-time behavior
- Dashboard auto-refreshes when staff log time or change a task status, so committed/available figures update live for supervisors.

### Visual design
- Clean, data-dense layout. Neutral palette with strong accent colors for status: not started (grey), in progress (blue), on hold (amber), complete (green), cancelled (muted/strikethrough). Utilization cells use green/amber/red.
- Desktop-first dashboards; mobile-friendly time entry and status changes for staff on the go.

### Out of scope (later)
- Login & permissions, approval workflows, CSV/PDF export, calendar sync, custom per-staff schedules, notifications/reminders for stalled tasks.
