-- Add task-level detail fields to subtasks so they can be opened as full items
alter table todo_subtasks
  add column if not exists status todo_task_status not null default 'todo',
  add column if not exists priority todo_task_priority default 'medium',
  add column if not exists due_date date,
  add column if not exists tags text[] default '{}';
