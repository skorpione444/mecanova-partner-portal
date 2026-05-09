"use client";

import { useEffect, useRef, useState, useCallback, KeyboardEvent } from "react";
import {
  X, Trash2, ChevronRight, Plus, CheckCircle2, Circle, ExternalLink,
} from "lucide-react";
import type { Task, Status } from "./lib/types";
import { PRIORITY_COLORS, PRIORITY_LABELS, colorBg, formatDate } from "./lib/statuses";
import { updateTask, deleteTask, createTask, fetchTasks } from "./lib/queries";

interface Props {
  task: Task | null;
  parentTask?: Task | null;
  statuses: Status[];
  allTasks: Task[];
  onClose: () => void;
  onTaskUpdated: (task: Task) => void;
  onTaskDeleted: (id: string) => void;
  onOpenSubtask: (id: string) => void;
  onSubtaskCreated: (subtask: Task) => void;
}

const DEBOUNCE_MS = 400;

export default function TaskDrawer({
  task,
  parentTask,
  statuses,
  allTasks,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
  onOpenSubtask,
  onSubtaskCreated,
}: Props) {
  const [draft, setDraft] = useState<Task | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const prevTaskId = useRef<string | null>(null);

  // Reset draft when task changes
  useEffect(() => {
    if (!task) { setDraft(null); return; }
    if (task.id !== prevTaskId.current) {
      setDraft({ ...task });
      prevTaskId.current = task.id;
    }
  }, [task]);

  // Auto-resize title textarea
  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = "auto";
      titleRef.current.style.height = titleRef.current.scrollHeight + "px";
    }
  }, [draft?.title]);

  const save = useCallback(async (data: Task) => {
    try {
      await updateTask(data.id, {
        title: data.title,
        description: data.description,
        notes: data.notes,
        context: data.context,
        status_id: data.status_id,
        priority: data.priority,
        start_date: data.start_date,
        due_date: data.due_date,
        tags: data.tags,
        assignee: data.assignee,
      });
      onTaskUpdated(data);
      setShowSaved(true);
      setSavedAt(Date.now());
      setTimeout(() => setShowSaved(false), 1200);
    } catch {}
  }, [onTaskUpdated]);

  const patch = useCallback((changes: Partial<Task>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...changes };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => save(next), DEBOUNCE_MS);
      return next;
    });
  }, [save]);

  // Auto-bullet in textareas
  const handleBulletKeyDown = (
    e: KeyboardEvent<HTMLTextAreaElement>,
    field: "description" | "notes"
  ) => {
    const ta = e.currentTarget;
    const pos = ta.selectionStart;
    const val = ta.value;
    const lineStart = val.lastIndexOf("\n", pos - 1) + 1;
    const lineText = val.slice(lineStart, pos);

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (lineText.startsWith("• ")) {
        if (lineText === "• ") {
          // Empty bullet → exit bullet mode
          const before = val.slice(0, lineStart);
          const after = val.slice(pos);
          const newVal = before.slice(0, -2) + "\n" + after;
          patch({ [field]: newVal });
        } else {
          const before = val.slice(0, pos);
          const after = val.slice(pos);
          patch({ [field]: before + "\n• " + after });
        }
      } else {
        const before = val.slice(0, pos);
        const after = val.slice(pos);
        patch({ [field]: before + "\n" + after });
      }
      return;
    }

    if (e.key === " " && lineText === "-") {
      e.preventDefault();
      const before = val.slice(0, lineStart);
      const after = val.slice(pos);
      patch({ [field]: before + "• " + after });
    }
  };

  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/,+$/, "").trim();
    if (!tag || !draft) return;
    if (!draft.tags.includes(tag)) patch({ tags: [...draft.tags, tag] });
    setNewTagInput("");
  };

  const removeTag = (tag: string) => {
    if (!draft) return;
    patch({ tags: draft.tags.filter((t) => t !== tag) });
  };

  const addSubtask = async () => {
    const title = newSubtaskTitle.trim();
    if (!title || !draft) return;
    const firstStatus = statuses[0];
    try {
      const sub = await createTask({
        workspace_id: draft.workspace_id,
        parent_id: draft.id,
        title,
        status_id: firstStatus?.id ?? null,
        priority: "medium",
        tags: [],
        description: "",
        notes: "",
        context: "",
        assignee: "",
        order_index: allTasks.filter((t) => t.parent_id === draft.id).length,
        start_date: null,
        due_date: null,
      });
      onSubtaskCreated(sub);
      setNewSubtaskTitle("");
    } catch {}
  };

  const handleDelete = async () => {
    if (!draft) return;
    try {
      await deleteTask(draft.id);
      onTaskDeleted(draft.id);
      setShowDeleteConfirm(false);
    } catch {}
  };

  if (!draft) return null;

  const subtasks = allTasks.filter((t) => t.parent_id === draft.id);
  const currentStatus = statuses.find((s) => s.id === draft.status_id);
  const doneStatus = statuses.find((s) => s.is_terminal && s.slug === "done") ?? statuses.find((s) => s.is_terminal);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 39,
        }}
      />

      {/* Drawer panel */}
      <div
        style={{
          position: "fixed",
          top: 0, right: 0, bottom: 0,
          width: "min(720px, 92vw)",
          background: "var(--mc-surface)",
          borderLeft: "1px solid var(--mc-border)",
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--mc-shadow-lg)",
          transform: "translateX(0)",
          transition: "transform 250ms var(--mc-ease)",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
            borderBottom: "1px solid var(--mc-border)",
            flexShrink: 0,
            background: "var(--mc-surface-warm)",
          }}
        >
          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--mc-text-muted)" }}>
            {parentTask && (
              <>
                <button
                  onClick={() => onOpenSubtask(parentTask.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mc-text-muted)", fontSize: 12, padding: 0 }}
                >
                  {parentTask.title.slice(0, 30)}
                  {parentTask.title.length > 30 ? "…" : ""}
                </button>
                <ChevronRight size={12} />
              </>
            )}
            <span style={{ color: "var(--mc-text-tertiary)" }}>Task</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Saved indicator */}
            {showSaved && (
              <span style={{ fontSize: 11, color: "var(--mc-success)", fontWeight: 600 }}>
                Saved
              </span>
            )}

            <button
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mc-text-muted)", display: "flex", padding: 4 }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 0 40px" }}>
          {/* Title */}
          <div style={{ padding: "20px 24px 12px" }}>
            <textarea
              ref={titleRef}
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              rows={1}
              style={{
                width: "100%",
                fontSize: 18,
                fontWeight: 700,
                fontFamily: "var(--font-jost), Jost, sans-serif",
                color: "var(--mc-text-primary)",
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                lineHeight: 1.4,
                padding: 0,
                letterSpacing: "0.01em",
              }}
              placeholder="Task title…"
            />
          </div>

          <div style={{ height: 1, background: "var(--mc-border-light)", margin: "0 24px" }} />

          {/* Status / Priority / Due row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, padding: "12px 24px", borderBottom: "1px solid var(--mc-border-light)" }}>
            {/* Status */}
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--mc-text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>
                Status
              </label>
              <select
                value={draft.status_id ?? ""}
                onChange={(e) => patch({ status_id: e.target.value || null })}
                style={{
                  width: "100%",
                  appearance: "none",
                  padding: "5px 10px",
                  fontSize: 12,
                  background: "var(--mc-surface-elevated)",
                  border: `1px solid ${currentStatus?.color ?? "var(--mc-border)"}`,
                  borderLeft: `4px solid ${currentStatus?.color ?? "var(--mc-border)"}`,
                  color: currentStatus?.color ?? "var(--mc-text-secondary)",
                  cursor: "pointer",
                }}
              >
                <option value="">No status</option>
                {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--mc-text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>
                Priority
              </label>
              <select
                value={draft.priority}
                onChange={(e) => patch({ priority: e.target.value as Task["priority"] })}
                style={{
                  width: "100%",
                  appearance: "none",
                  padding: "5px 10px",
                  fontSize: 12,
                  background: "var(--mc-surface-elevated)",
                  border: "1px solid var(--mc-border)",
                  color: PRIORITY_COLORS[draft.priority],
                  cursor: "pointer",
                }}
              >
                {(["low", "medium", "high", "urgent"] as const).map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>

            {/* Due date */}
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--mc-text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>
                Due Date
              </label>
              <input
                type="date"
                value={draft.due_date ?? ""}
                onChange={(e) => patch({ due_date: e.target.value || null })}
                style={{
                  width: "100%",
                  padding: "5px 10px",
                  fontSize: 12,
                  background: "var(--mc-surface-elevated)",
                  border: "1px solid var(--mc-border)",
                  color: "var(--mc-text-secondary)",
                  cursor: "pointer",
                }}
              />
            </div>
          </div>

          {/* Start date + Assignee row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, padding: "12px 24px", borderBottom: "1px solid var(--mc-border-light)" }}>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--mc-text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>
                Start Date
              </label>
              <input
                type="date"
                value={draft.start_date ?? ""}
                onChange={(e) => patch({ start_date: e.target.value || null })}
                style={{ width: "100%", padding: "5px 10px", fontSize: 12, background: "var(--mc-surface-elevated)", border: "1px solid var(--mc-border)", color: "var(--mc-text-secondary)" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--mc-text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>
                Assignee
              </label>
              <input
                value={draft.assignee}
                onChange={(e) => patch({ assignee: e.target.value })}
                placeholder="Person or team"
                style={{ width: "100%", padding: "5px 10px", fontSize: 12, background: "var(--mc-surface-elevated)", border: "1px solid var(--mc-border)", color: "var(--mc-text-secondary)", outline: "none" }}
              />
            </div>
          </div>

          {/* Tags */}
          <DrawerSection label="Tags">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              {draft.tags.map((tag) => (
                <span
                  key={tag}
                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 8px", background: "var(--mc-surface-elevated)", border: "1px solid var(--mc-border)", color: "var(--mc-text-secondary)" }}
                >
                  {tag}
                  <button onClick={() => removeTag(tag)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mc-text-muted)", padding: 0, display: "flex" }}>
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(newTagInput); }
                }}
                placeholder="Add tag…"
                style={{ fontSize: 12, padding: "2px 6px", background: "none", border: "1px dashed var(--mc-border)", color: "var(--mc-text-secondary)", outline: "none", width: 90 }}
              />
            </div>
          </DrawerSection>

          {/* Context */}
          <DrawerSection label="Context">
            <input
              value={draft.context}
              onChange={(e) => patch({ context: e.target.value })}
              placeholder="Short context line…"
              style={{ width: "100%", padding: "6px 10px", fontSize: 13, background: "var(--mc-surface-elevated)", border: "1px solid var(--mc-border)", color: "var(--mc-text-secondary)", outline: "none" }}
            />
          </DrawerSection>

          {/* Description */}
          <DrawerSection label="Description">
            <textarea
              value={draft.description}
              onChange={(e) => patch({ description: e.target.value })}
              onKeyDown={(e) => handleBulletKeyDown(e, "description")}
              placeholder={"Start with '- ' for bullet lists…"}
              rows={4}
              style={{ width: "100%", padding: "8px 10px", fontSize: 13, background: "var(--mc-surface-elevated)", border: "1px solid var(--mc-border)", color: "var(--mc-text-secondary)", outline: "none", resize: "vertical", lineHeight: 1.7, fontFamily: "inherit" }}
            />
          </DrawerSection>

          {/* Notes */}
          <DrawerSection label="Notes">
            <textarea
              value={draft.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              onKeyDown={(e) => handleBulletKeyDown(e, "notes")}
              placeholder="Additional notes…"
              rows={3}
              style={{ width: "100%", padding: "8px 10px", fontSize: 13, background: "var(--mc-surface-elevated)", border: "1px solid var(--mc-border)", color: "var(--mc-text-secondary)", outline: "none", resize: "vertical", lineHeight: 1.7, fontFamily: "inherit" }}
            />
          </DrawerSection>

          {/* Subtasks */}
          <DrawerSection label={`Subtasks (${subtasks.length})`}>
            {subtasks.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                {subtasks.map((sub) => {
                  const subStatus = statuses.find((s) => s.id === sub.status_id);
                  const isDone = subStatus?.is_terminal ?? sub.status_id === doneStatus?.id;
                  return (
                    <div
                      key={sub.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "5px 0",
                        borderBottom: "1px solid var(--mc-border-light)",
                      }}
                    >
                      <button
                        onClick={async () => {
                          const firstNonTerminal = statuses.find((s) => !s.is_terminal);
                          const newStatusId = isDone
                            ? (firstNonTerminal?.id ?? sub.status_id)
                            : (doneStatus?.id ?? sub.status_id);
                          if (newStatusId === sub.status_id) return;
                          try {
                            await updateTask(sub.id, { status_id: newStatusId });
                            onTaskUpdated({ ...sub, status_id: newStatusId });
                          } catch {}
                        }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: isDone ? "var(--mc-success)" : "var(--mc-text-muted)", display: "flex", flexShrink: 0, padding: 0 }}
                      >
                        {isDone ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                      </button>
                      <span style={{ flex: 1, fontSize: 13, color: isDone ? "var(--mc-text-muted)" : "var(--mc-text-secondary)", textDecoration: isDone ? "line-through" : "none", opacity: isDone ? 0.55 : 1 }}>
                        {sub.title}
                      </span>
                      <button
                        onClick={() => onOpenSubtask(sub.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mc-text-muted)", display: "flex", padding: 2 }}
                        title="Open subtask"
                      >
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubtask(); } }}
                placeholder="New subtask…"
                style={{ flex: 1, padding: "5px 9px", fontSize: 12, background: "var(--mc-surface-elevated)", border: "1px dashed var(--mc-border)", color: "var(--mc-text-secondary)", outline: "none" }}
              />
              <button
                onClick={addSubtask}
                style={{ padding: "5px 12px", fontSize: 12, background: "var(--mc-surface-elevated)", border: "1px solid var(--mc-border)", color: "var(--mc-text-secondary)", cursor: "pointer" }}
              >
                <Plus size={12} />
              </button>
            </div>
          </DrawerSection>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid var(--mc-border)",
            flexShrink: 0,
            background: "var(--mc-surface-warm)",
          }}
        >
          {showDeleteConfirm ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: "var(--mc-text-secondary)" }}>Delete this task?</span>
              <button
                onClick={handleDelete}
                style={{ padding: "5px 14px", fontSize: 12, fontWeight: 600, background: "var(--mc-error)", color: "#fff", border: "none", cursor: "pointer" }}
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{ padding: "5px 14px", fontSize: 12, background: "none", border: "1px solid var(--mc-border)", color: "var(--mc-text-muted)", cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 14px", fontSize: 12, background: "none", border: "1px solid var(--mc-error)", color: "var(--mc-error)", cursor: "pointer" }}
            >
              <Trash2 size={13} />
              Delete task
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function DrawerSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--mc-border-light)" }}>
      <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--mc-text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </label>
      {children}
    </div>
  );
}
