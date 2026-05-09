import type { Task, FilterState, Status } from './types';

export function applyFilters(tasks: Task[], filters: FilterState, statuses?: Status[]): Task[] {
  const today = new Date().toISOString().slice(0, 10);
  const terminalIds = statuses
    ? new Set(statuses.filter((s) => s.is_terminal).map((s) => s.id))
    : null;

  return tasks.filter((t) => {
    if (filters.statusId && t.status_id !== filters.statusId) return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    if (filters.tag && !t.tags.includes(filters.tag)) return false;
    if (filters.assignee && t.assignee !== filters.assignee) return false;
    if (filters.overdue) {
      if (!t.due_date || t.due_date >= today) return false;
      if (terminalIds && t.status_id && terminalIds.has(t.status_id)) return false;
    }
    if (filters.dueFrom && (!t.due_date || t.due_date < filters.dueFrom)) return false;
    if (filters.dueTo && (!t.due_date || t.due_date > filters.dueTo)) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (
        !t.title.toLowerCase().includes(q) &&
        !t.description.toLowerCase().includes(q) &&
        !t.notes.toLowerCase().includes(q) &&
        !t.tags.join(' ').toLowerCase().includes(q) &&
        !t.context.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });
}
