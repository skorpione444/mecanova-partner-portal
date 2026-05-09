"use client";

import { useState, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckCircle2, Circle, GripVertical, ChevronRight, ChevronDown } from "lucide-react";
import type { Task, Status } from "../lib/types";
import { PRIORITY_COLORS, PRIORITY_LABELS, formatDate, isOverdue } from "../lib/statuses";

interface Props {
  task: Task;
  statuses: Status[];
  isSelected: boolean;
  depth?: number;
  childCount?: number;
  isExpanded?: boolean;
  onToggleExpand?: (id: string) => void;
  onSelect: () => void;
  onCheck: () => void;
  onPatchTask: (id: string, patch: Partial<Task>) => void;
}

export default function TaskRow({ task, statuses, isSelected, depth = 0, childCount = 0, isExpanded = false, onToggleExpand, onSelect, onCheck, onPatchTask }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const [assigneeDraft, setAssigneeDraft] = useState(task.assignee);

  useEffect(() => { setAssigneeDraft(task.assignee); }, [task.assignee]);

  const status = statuses.find((s) => s.id === task.status_id);
  const isTerminal = status?.is_terminal ?? false;

  return (
    <>
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition: transition ?? "background 120ms",
          opacity: isDragging ? 0.4 : 1,
          display: "grid",
          gridTemplateColumns: "40px 1fr 160px 120px 100px 90px",
          alignItems: "center",
          padding: `0 16px 0 ${16 + depth * 20}px`,
          minHeight: 38,
          gap: 0,
          background: isSelected
            ? "rgba(236,223,204,0.06)"
            : "transparent",
          borderBottom: "1px solid var(--mc-border-light)",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--mc-surface-elevated)"; }}
        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
        onClick={onSelect}
      >
        {/* Chevron + drag handle */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand?.(task.id); }}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: "0 2px",
              color: "var(--mc-text-muted)", display: "flex", flexShrink: 0,
              opacity: childCount > 0 || isExpanded ? 1 : 0.3,
            }}
          >
            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          <div
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "flex", alignItems: "center",
              cursor: depth > 0 ? "default" : "grab",
              color: depth > 0 ? "transparent" : "var(--mc-text-muted)",
              padding: "0 2px",
              pointerEvents: depth > 0 ? "none" : "auto",
            }}
          >
            <GripVertical size={14} />
          </div>
        </div>

        {/* Title (with check button) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, padding: "8px 0" }}>
          <button
            onClick={(e) => { e.stopPropagation(); onCheck(); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: isTerminal ? "var(--mc-success)" : "var(--mc-text-muted)", display: "flex", flexShrink: 0, padding: 0 }}
          >
            {isTerminal ? <CheckCircle2 size={15} /> : <Circle size={15} />}
          </button>
          <span
            style={{
              fontSize: 13,
              color: isTerminal ? "var(--mc-text-muted)" : "var(--mc-text-secondary)",
              textDecoration: isTerminal ? "line-through" : "none",
              opacity: isTerminal ? 0.55 : 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {task.title}
          </span>
          {task.tags.length > 0 && (
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              {task.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    background: "var(--mc-surface-elevated)",
                    border: "1px solid var(--mc-border)",
                    color: "var(--mc-text-muted)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Assignee — inline editable */}
        <div style={{ padding: "0 4px" }} onMouseDown={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={assigneeDraft}
            onChange={(e) => setAssigneeDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.currentTarget.blur(); }
              else if (e.key === "Escape") { setAssigneeDraft(task.assignee); e.currentTarget.blur(); }
            }}
            onFocus={(e) => {
              e.currentTarget.style.border = "1px solid var(--mc-border)";
              e.currentTarget.style.background = "var(--mc-surface-elevated)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.border = "1px solid transparent";
              e.currentTarget.style.background = "transparent";
              const next = assigneeDraft.trim();
              if (next !== task.assignee) onPatchTask(task.id, { assignee: next });
            }}
            placeholder="Unassigned"
            style={{
              background: "transparent",
              border: "1px solid transparent",
              padding: "2px 6px",
              fontSize: 11,
              color: assigneeDraft ? "var(--mc-text-secondary)" : "var(--mc-text-muted)",
              width: "100%",
              outline: "none",
              transition: "border-color 0.15s, background 0.15s",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Priority */}
        <div style={{ padding: "0 8px" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: PRIORITY_COLORS[task.priority] }}>
            {PRIORITY_LABELS[task.priority]}
          </span>
        </div>

        {/* Due date */}
        <div style={{ padding: "0 8px" }}>
          {task.due_date && (
            <span
              style={{
                fontSize: 11,
                color: isOverdue(task.due_date) && !isTerminal ? "var(--mc-error)" : "var(--mc-text-muted)",
              }}
            >
              {formatDate(task.due_date)}
            </span>
          )}
        </div>

        {/* Subtask count */}
        <div style={{ padding: "0 8px" }}>
          {childCount > 0 && (
            <span style={{ fontSize: 10, padding: "2px 6px", background: "var(--mc-surface-elevated)", border: "1px solid var(--mc-border)", color: "var(--mc-text-muted)" }}>
              {childCount}
            </span>
          )}
        </div>
      </div>

    </>
  );
}
