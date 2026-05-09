-- Add description and recursive nesting to subtasks
alter table todo_subtasks
  add column if not exists description text,
  add column if not exists parent_subtask_id uuid references todo_subtasks(id) on delete cascade;
