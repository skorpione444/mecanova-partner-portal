"use client";

import { useState, useCallback, useRef, useMemo, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { createPortal } from "react-dom";
import GroupHeader from "./GroupHeader";
import TaskRow from "./TaskRow";
import QuickAdd from "./QuickAdd";
import type { Task, Status, FilterState } from "../lib/types";
import { applyFilters } from "../lib/filters";

const STORAGE_KEY = "todoUiPrefs";

function getCollapsed(): Record<string, boolean> {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}"); }
  catch { return {}; }
}
function setCollapsed(prefs: Record<string, boolean>) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {}
}

const EXPANDED_KEY = "todoUiExpanded";

interface Props {
  tasks: Task[];
  statuses: Status[];
  filters: FilterState;
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onCheckTask: (task: Task) => void;
  onQuickAdd: (title: string, statusId: string) => void;
  onReorder: (taskId: string, newStatusId: string, newIndex: number, allTaskIds: string[]) => void;
  onChangeStatus: (taskId: string, statusId: string) => void;
  onAddSubtask: (parentId: string, title: string) => void;
  onPatchTask: (id: string, patch: Partial<Task>) => void;
}

export default function ListView({
  tasks,
  statuses,
  filters,
  selectedTaskId,
  onSelectTask,
  onCheckTask,
  onQuickAdd,
  onReorder,
  onChangeStatus,
  onAddSubtask,
  onPatchTask,
}: Props) {
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>(getCollapsed);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(EXPANDED_KEY) ?? "[]");
      return new Set(Array.isArray(saved) ? saved : []);
    } catch { return new Set<string>(); }
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStatusId, setOverStatusId] = useState<string | null>(null);
  const prevOverStatus = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const toggleCollapse = useCallback((statusId: string) => {
    setCollapsedMap((prev) => {
      const next = { ...prev, [statusId]: !prev[statusId] };
      setCollapsed(next);
      return next;
    });
  }, []);

  const toggleExpand = useCallback((taskId: string) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      try { sessionStorage.setItem(EXPANDED_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  const childrenByParent = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (t.parent_id) {
        (map[t.parent_id] ??= []).push(t);
      }
    }
    for (const list of Object.values(map)) {
      list.sort((a, b) => a.order_index - b.order_index || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return map;
  }, [tasks]);

  const terminalIds = new Set(statuses.filter((s) => s.is_terminal).map((s) => s.id));
  const rawFiltered = applyFilters(tasks.filter((t) => !t.parent_id), filters, statuses);
  // Exclude tasks in terminal statuses from list view (unless user explicitly filters to that status)
  const filteredTop = filters.statusId && terminalIds.has(filters.statusId)
    ? rawFiltered
    : rawFiltered.filter((t) => !t.status_id || !terminalIds.has(t.status_id));

  const tasksByStatus = statuses.reduce<Record<string, Task[]>>((acc, s) => {
    acc[s.id] = filteredTop
      .filter((t) => t.status_id === s.id)
      .sort((a, b) => a.order_index - b.order_index || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return acc;
  }, {});

  // Unassigned tasks (status_id null or points to deleted status)
  const validStatusIds = new Set(statuses.map((s) => s.id));
  const unassigned = filteredTop.filter((t) => !t.status_id || !validStatusIds.has(t.status_id));

  const allTopIds = filteredTop.map((t) => t.id);

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as string);
    const task = tasks.find((t) => t.id === active.id);
    setOverStatusId(task?.status_id ?? null);
    prevOverStatus.current = task?.status_id ?? null;
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const overId = over.id as string;
    // Check if dragging over a status group header (droppable)
    if (statuses.find((s) => s.id === overId)) {
      setOverStatusId(overId);
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) setOverStatusId(overTask.status_id);
    }
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    setOverStatusId(null);
    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const overId = over.id as string;
    let newStatusId = task.status_id;

    // Dropped on a status group header
    if (statuses.find((s) => s.id === overId)) {
      newStatusId = overId;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) newStatusId = overTask.status_id;
    }

    const destTasks = tasks
      .filter((t) => t.status_id === newStatusId && t.id !== taskId && !t.parent_id)
      .sort((a, b) => a.order_index - b.order_index);

    let newIndex = destTasks.length;
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask && overTask.status_id === newStatusId) {
      newIndex = destTasks.findIndex((t) => t.id === overId);
      if (newIndex === -1) newIndex = destTasks.length;
    }

    onReorder(taskId, newStatusId ?? "", newIndex, allTopIds);
  };

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;
  const activeStatus = activeTask
    ? statuses.find((s) => s.id === activeTask.status_id)
    : null;

  // Terminal statuses are hidden from list view (still visible in Kanban)
  const visibleStatuses = statuses.filter((s) => {
    if (s.is_terminal && filters.statusId !== s.id) return false;
    return true;
  });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Column header row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "40px 1fr 160px 120px 100px 90px",
            padding: "4px 16px",
            borderBottom: "1px solid var(--mc-border)",
            background: "var(--mc-surface-warm)",
            position: "sticky",
            top: 0,
            zIndex: 2,
          }}
        >
          {["", "Title", "Assignee", "Priority", "Due", ""].map((col, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 600, color: "var(--mc-text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", padding: "4px 8px" }}>
              {col}
            </span>
          ))}
        </div>

        {visibleStatuses.map((status) => {
          const group = tasksByStatus[status.id] ?? [];
          const collapsed = !!collapsedMap[status.id];

          // Hide empty terminal groups by default
          if (status.is_terminal && group.length === 0 && !filters.statusId) return null;

          const renderTaskTree = (task: Task, depth: number): ReactNode[] => {
            const children = childrenByParent[task.id] ?? [];
            const isExpanded = expandedTaskIds.has(task.id);
            const rows: React.ReactNode[] = [
              <TaskRow
                key={task.id}
                task={task}
                statuses={statuses}
                isSelected={task.id === selectedTaskId}
                depth={depth}
                childCount={children.length}
                isExpanded={isExpanded}
                onToggleExpand={toggleExpand}
                onSelect={() => onSelectTask(task.id)}
                onCheck={() => onCheckTask(task)}
                onPatchTask={onPatchTask}
              />,
            ];
            if (isExpanded) {
              for (const child of children) {
                rows.push(...renderTaskTree(child, depth + 1));
              }
              rows.push(
                <QuickAdd
                  key={`subtask-add-${task.id}`}
                  onAdd={(title) => onAddSubtask(task.id, title)}
                  placeholder="New subtask…"
                  paddingLeft={16 + (depth + 1) * 20 + 16}
                />
              );
            }
            return rows;
          };

          return (
            <div key={status.id}>
              <GroupHeader
                status={status}
                count={group.length}
                collapsed={collapsed}
                onToggle={() => toggleCollapse(status.id)}
              />
              {!collapsed && (
                <SortableContext items={group.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {group.flatMap((task) => renderTaskTree(task, 0))}
                </SortableContext>
              )}
              {!collapsed && (
                <QuickAdd onAdd={(title) => onQuickAdd(title, status.id)} />
              )}
            </div>
          );
        })}

        {/* Tasks with no valid status */}
        {unassigned.length > 0 && (
          <div>
            <div style={{ padding: "7px 16px", fontSize: 11, color: "var(--mc-text-muted)", borderBottom: "1px solid var(--mc-border-light)", background: "var(--mc-surface-warm)" }}>
              UNASSIGNED ({unassigned.length})
            </div>
            <SortableContext items={unassigned.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {unassigned.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  statuses={statuses}
                  isSelected={task.id === selectedTaskId}
                  depth={0}
                  childCount={(childrenByParent[task.id] ?? []).length}
                  isExpanded={expandedTaskIds.has(task.id)}
                  onToggleExpand={toggleExpand}
                  onSelect={() => onSelectTask(task.id)}
                  onCheck={() => onCheckTask(task)}
                  onPatchTask={onPatchTask}
                />
              ))}
            </SortableContext>
          </div>
        )}

        {filteredTop.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--mc-text-muted)", fontSize: 14 }}>
            No tasks
          </div>
        )}
      </div>

      {/* Drag overlay */}
      {typeof document !== "undefined" &&
        createPortal(
          <DragOverlay>
            {activeTask && (
              <div
                style={{
                  background: "var(--mc-surface-elevated)",
                  border: "1px solid var(--mc-border-warm)",
                  padding: "8px 16px",
                  fontSize: 13,
                  color: "var(--mc-text-primary)",
                  boxShadow: "var(--mc-shadow-lg)",
                  pointerEvents: "none",
                  opacity: 0.9,
                }}
              >
                {activeTask.title}
              </div>
            )}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );
}
