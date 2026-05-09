-- ─────────────────────────────────────────────────────────────────────────────
-- !!!  DANGER ZONE  !!!
-- Run this ONLY AFTER the new to-do's UI is verified working in production.
-- This permanently removes all old todo_* tables and most of their enums.
-- The todo_task_priority enum is intentionally kept — the new tasks table
-- still references it.
-- ─────────────────────────────────────────────────────────────────────────────

-- DO NOT apply with supabase db push until explicitly instructed.

/*

drop table if exists todo_view_modules cascade;
drop table if exists todo_connections   cascade;
drop table if exists todo_nodes         cascade;
drop table if exists todo_subtasks      cascade;
drop table if exists todo_tasks         cascade;
drop table if exists todo_views         cascade;
drop table if exists todo_sections      cascade;

drop type if exists todo_task_status;
drop type if exists todo_view_type;
drop type if exists todo_node_type;
drop type if exists todo_module_type;

drop function if exists update_todo_task_updated_at() cascade;

*/
