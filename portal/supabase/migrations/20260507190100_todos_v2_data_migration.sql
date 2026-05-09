-- ─────────────────────────────────────────────────────────────────────────────
-- To-Do's v2 — Data migration from old todo_* tables
-- Preserves UUIDs so any existing links/bookmarks keep working.
-- Safe to re-run (ON CONFLICT DO NOTHING on every insert).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Workspaces from todo_sections
insert into workspaces (id, name, description, icon, color, created_at, updated_at)
select
  id,
  name,
  '',
  coalesce(icon, '📋'),
  color,
  created_at,
  created_at
from todo_sections
on conflict (id) do nothing;

-- 2. Default statuses for each migrated workspace
--    Slugs map exactly to old todo_task_status enum values (see step 3)
insert into statuses (workspace_id, slug, name, color, is_terminal, order_index)
select w.id, 'open',        'Open',        '#7D7468', false, 0 from workspaces w
union all
select w.id, 'in-progress', 'In Progress', '#5a8ab0', false, 1 from workspaces w
union all
select w.id, 'blocked',     'Blocked',     '#c45a5a', false, 2 from workspaces w
union all
select w.id, 'done',        'Done',        '#6b8f6e', true,  3 from workspaces w
union all
select w.id, 'cancelled',   'Cancelled',   '#7D7468', true,  4 from workspaces w
on conflict do nothing;

-- 3. Top-level tasks from todo_tasks
insert into tasks (
  id, workspace_id, parent_id,
  title, description, notes, context,
  status_id, priority,
  start_date, due_date, tags, assignee,
  order_index, created_at, updated_at
)
select
  t.id,
  t.section_id,
  null,
  t.title,
  coalesce(t.description, ''),
  '', '',
  s.id,
  t.priority,
  null, t.due_date, t.tags, '',
  t.order_index, t.created_at, t.updated_at
from todo_tasks t
join statuses s
  on  s.workspace_id = t.section_id
  and s.slug = case t.status::text
    when 'todo'        then 'open'
    when 'in_progress' then 'in-progress'
    when 'blocked'     then 'blocked'
    when 'done'        then 'done'
    when 'cancelled'   then 'cancelled'
    else 'open'
  end
on conflict (id) do nothing;

-- 4. Subtasks → child tasks (parent_id = task.id)
insert into tasks (
  id, workspace_id, parent_id,
  title, description, notes, context,
  status_id, priority,
  start_date, due_date, tags, assignee,
  order_index, created_at, updated_at
)
select
  sub.id,
  t.section_id,
  sub.task_id,
  sub.title,
  coalesce(sub.description, ''),
  '', '',
  s.id,
  sub.priority,
  null, sub.due_date, sub.tags, '',
  sub.order_index, now(), now()
from todo_subtasks sub
join todo_tasks t on t.id = sub.task_id
join statuses s
  on  s.workspace_id = t.section_id
  and s.slug = case sub.status::text
    when 'todo'        then 'open'
    when 'in_progress' then 'in-progress'
    when 'blocked'     then 'blocked'
    when 'done'        then 'done'
    when 'cancelled'   then 'cancelled'
    else 'open'
  end
on conflict (id) do nothing;

-- 5. Mind map state — migrate nodes from the first mind_map view per workspace
insert into mindmap_state (workspace_id, nodes, edges, viewport, updated_at)
select
  w.id,
  coalesce(
    (
      select jsonb_agg(node_row)
      from (
        select jsonb_build_object(
          'id',         n.id,
          'x',          n.position_x,
          'y',          n.position_y,
          'w',          160,
          'h',          56,
          'text',       n.label,
          'shape',      case n.node_type::text
                          when 'decision' then 'diamond'
                          when 'note'     then 'sticky'
                          when 'idea'     then 'rounded'
                          else 'rect'
                        end,
          'fill',       coalesce(n.color, '#1a1a1a'),
          'border',     '#2A2A2A',
          'borderStyle','solid',
          'textColor',  '#ecdfcc',
          'fontSize',   14,
          'textAlign',  'center',
          'textVAlign', 'middle',
          'z',          row_number() over (order by n.created_at)
        ) as node_row
        from todo_nodes n
        where n.view_id = (
          select v.id from todo_views v
          where v.section_id = w.id
            and v.view_type = 'mind_map'
          order by v.position limit 1
        )
      ) sub
    ),
    '[]'::jsonb
  ),
  '[]'::jsonb,
  '{"x":0,"y":0,"zoom":1}'::jsonb,
  now()
from workspaces w
on conflict (workspace_id) do nothing;
