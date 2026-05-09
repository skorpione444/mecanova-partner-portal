"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import KanbanCard from "./KanbanCard";
import QuickAdd from "../list/QuickAdd";
import type { Task, Status } from "../lib/types";
import { colorBg } from "../lib/statuses";

interface Props {
  status: Status;
  tasks: Task[];
  allStatuses: Status[];
  workspaceColor: string;
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onCheckTask: (task: Task) => void;
  onQuickAdd: (title: string, statusId: string) => void;
}

export default function KanbanColumn({
  status,
  tasks,
  allStatuses,
  workspaceColor,
  selectedTaskId,
  onSelectTask,
  onCheckTask,
  onQuickAdd,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });

  return (
    <div style={{
      width: 300,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      background: "var(--mc-surface-warm)",
      border: "1px solid var(--mc-border)",
      maxHeight: "100%",
    }}>
      {/* Header */}
      <div style={{
        borderTop: `4px solid ${status.color}`,
        padding: "10px 12px 8px",
        borderBottom: "1px solid var(--mc-border)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: status.color,
          }}>
            {status.name}
          </span>
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "1px 6px",
            background: colorBg(status.color),
            border: `1px solid ${status.color}`,
            color: status.color,
          }}>
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Card list — droppable zone */}
      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 8,
          minHeight: 60,
          background: isOver ? colorBg(status.color) : undefined,
          transition: "background 150ms",
        }}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              statuses={allStatuses}
              workspaceColor={workspaceColor}
              isSelected={task.id === selectedTaskId}
              onSelect={() => onSelectTask(task.id)}
              onCheck={() => onCheckTask(task)}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div style={{
            border: "1px dashed var(--mc-border)",
            padding: "16px 12px",
            textAlign: "center",
            color: "var(--mc-text-muted)",
            fontSize: 12,
          }}>
            Drop task here
          </div>
        )}
      </div>

      {/* Quick add */}
      <div style={{ borderTop: "1px solid var(--mc-border)", flexShrink: 0 }}>
        <QuickAdd onAdd={(title) => onQuickAdd(title, status.id)} />
      </div>
    </div>
  );
}
