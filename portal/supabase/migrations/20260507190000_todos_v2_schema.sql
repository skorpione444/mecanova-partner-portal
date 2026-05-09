-- ─────────────────────────────────────────────────────────────────────────────
-- To-Do's v2 — Workspaces, Statuses, Tasks, Mind Maps, Status Templates
-- Replaces: todo_sections, todo_views, todo_tasks, todo_subtasks,
--           todo_nodes, todo_connections, todo_view_modules
-- ─────────────────────────────────────────────────────────────────────────────

-- Workspaces (replaces todo_sections)
create table if not exists workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null default '',
  icon        text not null default '📋',
  color       text not null default '#ecdfcc',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Per-workspace statuses (ordered, can be customised)
create table if not exists statuses (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  slug         text not null,
  name         text not null,
  color        text not null default '#7D7468',
  is_terminal  boolean not null default false,
  order_index  integer not null default 0
);

-- Tasks (top-level tasks have parent_id = null; subtasks have parent_id = task.id)
-- Reuses the existing todo_task_priority enum to avoid re-creating it
create table if not exists tasks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  parent_id    uuid references tasks(id) on delete cascade,
  title        text not null check (char_length(title) <= 500),
  description  text not null default '',
  notes        text not null default '',
  context      text not null default '',
  status_id    uuid references statuses(id) on delete set null,
  priority     todo_task_priority not null default 'medium',
  start_date   date,
  due_date     date,
  tags         text[] not null default '{}',
  assignee     text not null default '',
  order_index  float not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- One mind-map state row per workspace (nodes + edges stored as JSONB)
create table if not exists mindmap_state (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  nodes        jsonb not null default '[]',
  edges        jsonb not null default '[]',
  viewport     jsonb not null default '{"x":0,"y":0,"zoom":1}',
  updated_at   timestamptz not null default now()
);

-- Global, reusable status templates (snapshotted from a workspace's statuses)
create table if not exists status_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  statuses   jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- ── Row-Level Security ────────────────────────────────────────────────────────
alter table workspaces      enable row level security;
alter table statuses        enable row level security;
alter table tasks           enable row level security;
alter table mindmap_state   enable row level security;
alter table status_templates enable row level security;

create policy "Admins manage workspaces"       on workspaces       for all using (mecanova_is_admin()) with check (mecanova_is_admin());
create policy "Admins manage statuses"         on statuses         for all using (mecanova_is_admin()) with check (mecanova_is_admin());
create policy "Admins manage tasks"            on tasks            for all using (mecanova_is_admin()) with check (mecanova_is_admin());
create policy "Admins manage mindmap_state"    on mindmap_state    for all using (mecanova_is_admin()) with check (mecanova_is_admin());
create policy "Admins manage status_templates" on status_templates for all using (mecanova_is_admin()) with check (mecanova_is_admin());

-- ── updated_at triggers ───────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger workspaces_updated_at
  before update on workspaces
  for each row execute procedure set_updated_at();

create trigger tasks_updated_at
  before update on tasks
  for each row execute procedure set_updated_at();

create trigger mindmap_state_updated_at
  before update on mindmap_state
  for each row execute procedure set_updated_at();
