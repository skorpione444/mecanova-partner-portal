"use client";

import { useState } from "react";
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
import { createPortal } from "react-dom";
import KanbanColumn from "./KanbanColumn";
import type { Task, Status, FilterState } from "../lib/types";
import { applyFilters } from "../lib/filters";

interface Props {
  tasks: Task[];
  statuses: Status[];
  filters: FilterState;
  workspaceColor: string;
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onCheckTask: (task: Task) => void;
  onQuickAdd: (title: string, statusId: string) => void;
  onReorder: (taskId: string, newStatusId: string, newIndex: number, allTaskIds: string[]) => void;
}

export default function KanbanView({
  tasks,
  statuses,
  filters,
  workspaceColor,
  selectedTaskId,
  onSelectTask,
  onCheckTask,
  onQuickAdd,
  onReorder,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const filteredTasks = applyFilters(tasks.filter((t) => !t.parent_id), filters, statuses);

  const tasksByStatus = statuses.reduce<Record<string, Task[]>>((acc, s) => {
    acc[s.id] = filteredTasks
      .filter((t) => t.status_id === s.id)
      .sort((a, b) => a.order_index - b.order_index || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return acc;
  }, {});

  const allTopIds = filteredTasks.map((t) => t.id);

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as string);
  };

  const handleDragOver = (_: DragOverEvent) => {
    // isOver is handled per-column via useDroppable
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const overId = over.id as string;
    let newStatusId = task.status_id;

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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div style={{
        flex: 1,
        overflowX: "auto",
        overflowY: "hidden",
        display: "flex",
        gap: 12,
        padding: 16,
        alignItems: "stretch",
        background: "var(--mc-charcoal)",
        height: "100%",
      }}>
        {statuses.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            tasks={tasksByStatus[status.id] ?? []}
            allStatuses={statuses}
            workspaceColor={workspaceColor}
            selectedTaskId={selectedTaskId}
            onSelectTask={onSelectTask}
            onCheckTask={onCheckTask}
            onQuickAdd={onQuickAdd}
          />
        ))}
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <DragOverlay>
            {activeTask && (
              <div style={{
                background: "var(--mc-surface-elevated)",
                border: "1px solid var(--mc-border-warm)",
                padding: "8px 10px",
                fontSize: 13,
                width: 280,
                color: "var(--mc-text-secondary)",
                boxShadow: "var(--mc-shadow-lg)",
                pointerEvents: "none",
                opacity: 0.92,
              }}>
                {activeTask.title}
              </div>
            )}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );
}
