-- ─────────────────────────────────────────────────────────────────────────────
-- Todo Workspace — Dynamic task management with sections, views, and mind maps
-- ─────────────────────────────────────────────────────────────────────────────

-- Workspace sections (top-level tabs)
create table if not exists todo_sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#ecdfcc',
  icon text,
  position integer not null default 0,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- View types
do $$ begin
  create type todo_view_type as enum ('list', 'board', 'mind_map', 'process_map', 'mixed');
exception when duplicate_object then null;
end $$;

-- Views inside sections (task desks, boards, maps)
create table if not exists todo_views (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references todo_sections(id) on delete cascade,
  name text not null,
  view_type todo_view_type not null default 'list',
  position integer not null default 0,
  filter_config jsonb not null default '{}',
  layout_config jsonb not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Task status + priority enums
do $$ begin
  create type todo_task_status as enum ('todo', 'in_progress', 'blocked', 'done', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type todo_task_priority as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null;
end $$;

-- Tasks
create table if not exists todo_tasks (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references todo_sections(id) on delete set null,
  title text not null,
  description text,
  status todo_task_status not null default 'todo',
  priority todo_task_priority not null default 'medium',
  due_date date,
  owner_id uuid references auth.users(id) on delete set null,
  tags text[] not null default '{}',
  blocked_by_id uuid references todo_tasks(id) on delete set null,
  order_index float not null default 0,
  linked_partner_id uuid references partners(id) on delete set null,
  linked_order_id uuid references order_requests(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Subtasks
create table if not exists todo_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references todo_tasks(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  order_index float not null default 0
);

-- Node type enum
do $$ begin
  create type todo_node_type as enum ('idea', 'task_link', 'process_step', 'group', 'note', 'decision');
exception when duplicate_object then null;
end $$;

-- Mind map / process map nodes
create table if not exists todo_nodes (
  id uuid primary key default gen_random_uuid(),
  view_id uuid not null references todo_views(id) on delete cascade,
  label text not null,
  node_type todo_node_type not null default 'idea',
  position_x float not null default 0,
  position_y float not null default 0,
  color text,
  linked_task_id uuid references todo_tasks(id) on delete set null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Node connections (edges)
create table if not exists todo_connections (
  id uuid primary key default gen_random_uuid(),
  view_id uuid not null references todo_views(id) on delete cascade,
  source_node_id uuid not null references todo_nodes(id) on delete cascade,
  target_node_id uuid not null references todo_nodes(id) on delete cascade,
  label text,
  animated boolean not null default false,
  created_at timestamptz not null default now()
);

-- Module type enum
do $$ begin
  create type todo_module_type as enum ('task_list', 'kanban', 'notes', 'contacts', 'documents', 'mind_map');
exception when duplicate_object then null;
end $$;

-- Module blocks for mixed desks
create table if not exists todo_view_modules (
  id uuid primary key default gen_random_uuid(),
  view_id uuid not null references todo_views(id) on delete cascade,
  module_type todo_module_type not null,
  title text,
  order_index integer not null default 0,
  config jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table todo_sections enable row level security;
alter table todo_views enable row level security;
alter table todo_tasks enable row level security;
alter table todo_subtasks enable row level security;
alter table todo_nodes enable row level security;
alter table todo_connections enable row level security;
alter table todo_view_modules enable row level security;

create policy "Admins manage todo_sections"     on todo_sections     for all using (mecanova_is_admin()) with check (mecanova_is_admin());
create policy "Admins manage todo_views"        on todo_views        for all using (mecanova_is_admin()) with check (mecanova_is_admin());
create policy "Admins manage todo_tasks"        on todo_tasks        for all using (mecanova_is_admin()) with check (mecanova_is_admin());
create policy "Admins manage todo_subtasks"     on todo_subtasks     for all using (mecanova_is_admin()) with check (mecanova_is_admin());
create policy "Admins manage todo_nodes"        on todo_nodes        for all using (mecanova_is_admin()) with check (mecanova_is_admin());
create policy "Admins manage todo_connections"  on todo_connections  for all using (mecanova_is_admin()) with check (mecanova_is_admin());
create policy "Admins manage todo_view_modules" on todo_view_modules for all using (mecanova_is_admin()) with check (mecanova_is_admin());

-- ── Trigger: updated_at on todo_tasks ────────────────────────────────────────
create or replace function update_todo_task_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger todo_tasks_updated_at
  before update on todo_tasks
  for each row execute procedure update_todo_task_updated_at();
