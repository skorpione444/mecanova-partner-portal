"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Circle, CheckCircle2 } from "lucide-react";
import type { Task, Status } from "../lib/types";
import { PRIORITY_COLORS, colorBg, formatDate, isOverdue } from "../lib/statuses";

interface Props {
  task: Task;
  statuses: Status[];
  workspaceColor: string;
  isSelected: boolean;
  onSelect: () => void;
  onCheck: () => void;
}

export default function KanbanCard({ task, statuses, workspaceColor, isSelected, onSelect, onCheck }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const status = statuses.find((s) => s.id === task.status_id);
  const isTerminal = status?.is_terminal ?? false;
  const overdue = isOverdue(task.due_date) && !isTerminal;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : isTerminal ? 0.55 : 1,
        background: "var(--mc-surface-elevated)",
        border: isSelected ? `2px solid ${workspaceColor}` : "1px solid var(--mc-border)",
        padding: isSelected ? "7px 9px" : "8px 10px",
        cursor: "pointer",
        userSelect: "none",
        marginBottom: 4,
      }}
      onClick={onSelect}
      {...attributes}
      {...listeners}
    >
      {/* Title */}
      <div style={{
        fontSize: 13,
        fontWeight: 500,
        fontFamily: "Jost, sans-serif",
        color: "var(--mc-text-secondary)",
        textDecoration: isTerminal ? "line-through" : "none",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical" as const,
        overflow: "hidden",
        marginBottom: task.tags.length > 0 ? 6 : 4,
        lineHeight: 1.4,
      }}>
        {task.title}
      </div>

      {/* Tags */}
      {task.tags.length > 0 && (
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 6 }}>
          {task.tags.slice(0, 3).map((tag) => (
            <span key={tag} style={{
              fontSize: 10,
              padding: "1px 5px",
              background: colorBg("#7D7468"),
              border: "1px solid var(--mc-border)",
              color: "var(--mc-text-muted)",
            }}>
              {tag}
            </span>
          ))}
          {task.tags.length > 3 && (
            <span style={{ fontSize: 10, color: "var(--mc-text-muted)", lineHeight: "18px" }}>
              +{task.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{
          width: 6,
          height: 6,
          background: PRIORITY_COLORS[task.priority],
          flexShrink: 0,
          display: "inline-block",
        }} />
        {task.due_date && (
          <span style={{ fontSize: 11, color: overdue ? "var(--mc-error)" : "var(--mc-text-muted)", flex: 1 }}>
            {formatDate(task.due_date)}
          </span>
        )}
        <div style={{ flex: task.due_date ? undefined : 1 }} />
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onCheck(); }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: isTerminal ? "var(--mc-success)" : "var(--mc-text-muted)",
            display: "flex",
            padding: 0,
          }}
        >
          {isTerminal ? <CheckCircle2 size={13} /> : <Circle size={13} />}
        </button>
      </div>
    </div>
  );
}
