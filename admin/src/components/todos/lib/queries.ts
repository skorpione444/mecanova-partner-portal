import { createClient } from '@/lib/supabase/client';
import type { Workspace, Status, Task, MindMap, StatusTemplate } from './types';
import { DEFAULT_STATUSES } from './statuses';

const db = () => createClient();

// ── Workspaces ────────────────────────────────────────────────────────────────

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await db().from('workspaces').select('*').order('created_at');
  if (error) throw error;
  return (data ?? []) as Workspace[];
}

export async function createWorkspace(ws: Partial<Workspace>): Promise<Workspace> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await db().from('workspaces').insert(ws as any).select().single();
  if (error) throw error;
  return data as Workspace;
}

export async function updateWorkspace(id: string, patch: Partial<Workspace>): Promise<void> {
  const { error } = await db().from('workspaces').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteWorkspace(id: string): Promise<void> {
  const { error } = await db().from('workspaces').delete().eq('id', id);
  if (error) throw error;
}

// ── Statuses ──────────────────────────────────────────────────────────────────

export async function fetchStatuses(workspaceId: string): Promise<Status[]> {
  const { data, error } = await db()
    .from('statuses')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('order_index');
  if (error) throw error;
  return (data ?? []) as Status[];
}

/** Creates default statuses for a newly-created workspace. */
export async function seedStatuses(workspaceId: string): Promise<Status[]> {
  const rows = DEFAULT_STATUSES.map((s) => ({ ...s, workspace_id: workspaceId }));
  const { data, error } = await db().from('statuses').insert(rows).select();
  if (error) throw error;
  return (data ?? []) as Status[];
}

/**
 * Saves the desired set of statuses for a workspace.
 * Pass a migration map { [removedStatusId]: replacementStatusId }
 * to reassign tasks whose status is being removed.
 *
 * Order: upsert first (so new statuses exist in the DB), then migrate tasks,
 * then delete stale statuses. This avoids the old delete-then-insert pattern
 * that left the workspace with zero statuses if the insert ever failed.
 */
export async function saveStatuses(
  workspaceId: string,
  statuses: Omit<Status, 'workspace_id'>[],
  migration?: Record<string, string>,
): Promise<void> {
  const client = db();

  // 1. Upsert desired statuses — creates new rows and updates existing ones.
  const rows = statuses.map((s, i) => ({ ...s, workspace_id: workspaceId, order_index: i }));
  const { error: upsertErr } = await client.from('statuses').upsert(rows, { onConflict: 'id' });
  if (upsertErr) throw upsertErr;

  // 2. Reassign tasks (migration targets are now guaranteed to exist in the DB).
  if (migration && Object.keys(migration).length) {
    for (const [oldId, newId] of Object.entries(migration)) {
      const { error } = await client
        .from('tasks')
        .update({ status_id: newId })
        .eq('status_id', oldId)
        .eq('workspace_id', workspaceId);
      if (error) throw error;
    }
  }

  // 3. Delete only the statuses the user actually removed.
  const keepIds = statuses.map((s) => s.id);
  if (keepIds.length > 0) {
    const { error: delErr } = await client
      .from('statuses')
      .delete()
      .eq('workspace_id', workspaceId)
      .not('id', 'in', `(${keepIds.join(',')})`);
    if (delErr) throw delErr;
  }
}

/** Returns count of tasks per statusId for the given status IDs. */
export async function countTasksForStatuses(
  workspaceId: string,
  statusIds: string[],
): Promise<Record<string, number>> {
  if (!statusIds.length) return {};
  const { data, error } = await db()
    .from('tasks')
    .select('status_id')
    .eq('workspace_id', workspaceId)
    .is('parent_id', null)  // only top-level tasks
    .in('status_id', statusIds);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    if (row.status_id) counts[row.status_id] = (counts[row.status_id] ?? 0) + 1;
  }
  return counts;
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function fetchTasks(workspaceId: string): Promise<Task[]> {
  const { data, error } = await db()
    .from('tasks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('order_index')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function createTask(task: Partial<Task>): Promise<Task> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await db().from('tasks').insert(task as any).select().single();
  if (error) throw error;
  return data as Task;
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<void> {
  const { error } = await db()
    .from('tasks')
    .update(patch)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await db().from('tasks').delete().eq('id', id);
  if (error) throw error;
}

// ── Mind Map ──────────────────────────────────────────────────────────────────

export async function fetchMindMap(workspaceId: string): Promise<MindMap> {
  const { data, error } = await db()
    .from('mindmap_state')
    .select('nodes, edges, viewport')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }) as MindMap;
}

export async function saveMindMap(workspaceId: string, mm: MindMap): Promise<void> {
  const { error } = await db()
    .from('mindmap_state')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert({ workspace_id: workspaceId, nodes: mm.nodes as any, edges: mm.edges as any, viewport: mm.viewport as any }, { onConflict: 'workspace_id' });
  if (error) throw error;
}

// ── Status Templates ──────────────────────────────────────────────────────────

export async function fetchStatusTemplates(): Promise<StatusTemplate[]> {
  const { data, error } = await db().from('status_templates').select('*').order('created_at');
  if (error) throw error;
  return (data ?? []) as StatusTemplate[];
}

export async function createStatusTemplate(name: string, statuses: Status[]): Promise<StatusTemplate> {
  const stripped = statuses.map(({ slug, name: n, color, is_terminal, order_index }) => ({
    slug, name: n, color, is_terminal, order_index,
  }));
  const { data, error } = await db()
    .from('status_templates')
    .insert({ name, statuses: stripped })
    .select()
    .single();
  if (error) throw error;
  return data as StatusTemplate;
}

export async function deleteStatusTemplate(id: string): Promise<void> {
  const { error } = await db().from('status_templates').delete().eq('id', id);
  if (error) throw error;
}

export async function renameStatusTemplate(id: string, name: string): Promise<void> {
  const { error } = await db().from('status_templates').update({ name }).eq('id', id);
  if (error) throw error;
}
