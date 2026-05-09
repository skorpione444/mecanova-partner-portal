"use client";

import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X, GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import type { Status, Task, StatusTemplate } from "./lib/types";
import { COLOR_PALETTE, DEFAULT_STATUSES } from "./lib/statuses";
import {
  saveStatuses,
  countTasksForStatuses,
  createStatusTemplate,
  deleteStatusTemplate,
} from "./lib/queries";

interface PendingMigration {
  fromStatusId: string;
  fromStatusName: string;
  affectedCount: number;
  toStatusId: string | null;
}

interface Props {
  workspaceId: string;
  statuses: Status[];
  tasks: Task[];
  templates: StatusTemplate[];
  onClose: () => void;
  onSaved: () => void;
  onTemplatesChanged: (templates: StatusTemplate[]) => void;
}

export default function EditStatusesModal({
  workspaceId,
  statuses: initialStatuses,
  tasks,
  templates,
  onClose,
  onSaved,
  onTemplatesChanged,
}: Props) {
  const [draft, setDraft] = useState<Status[]>(() => {
    if (initialStatuses.length > 0) return initialStatuses.map((s) => ({ ...s }));
    // Workspace lost all its statuses — prefill with defaults so the user can recover immediately.
    return DEFAULT_STATUSES.map((s, i) => ({
      ...s,
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      order_index: i,
    }));
  });
  const [pendingMigrations, setPendingMigrations] = useState<PendingMigration[]>([]);
  const [saving, setSaving] = useState(false);
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [pendingDeleteTemplateId, setPendingDeleteTemplateId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ── Draft mutations ────────────────────────────────────────────────────────

  const addStatus = () => {
    setDraft((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        workspace_id: workspaceId,
        slug: `status-${prev.length}`,
        name: "New Status",
        color: "#7D7468",
        is_terminal: false,
        order_index: prev.length,
      },
    ]);
  };

  const removeStatus = (id: string) => {
    if (draft.length <= 1) return;
    // Remove from pending migrations if already queued
    setPendingMigrations((prev) => prev.filter((m) => m.fromStatusId !== id));
    setDraft((prev) => prev.filter((s) => s.id !== id));
  };

  const patchStatus = (id: string, patch: Partial<Status>) => {
    setDraft((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = draft.findIndex((s) => s.id === active.id);
    const to = draft.findIndex((s) => s.id === over.id);
    if (from === -1 || to === -1) return;
    setDraft((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  // ── Template load — triggers migration if statuses disappear ──────────────

  const loadTemplate = (tmpl: StatusTemplate) => {
    const newStatuses: Status[] = tmpl.statuses.map((s, i) => ({
      ...s,
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      order_index: i,
    }));

    // Find current statuses that are being removed and have tasks
    const newIds = new Set(newStatuses.map((s) => s.slug));
    const removed = draft.filter((s) => !newIds.has(s.slug));
    const taskCountByStatus: Record<string, number> = {};
    for (const t of tasks) {
      if (t.status_id) taskCountByStatus[t.status_id] = (taskCountByStatus[t.status_id] ?? 0) + 1;
    }

    const migrations: PendingMigration[] = removed
      .map((s) => ({ fromStatusId: s.id, fromStatusName: s.name, affectedCount: taskCountByStatus[s.id] ?? 0, toStatusId: null }))
      .filter((m) => m.affectedCount > 0);

    setDraft(newStatuses);
    setPendingMigrations(migrations);
  };

  // ── X delete — queue migration if status has tasks ─────────────────────────

  const requestRemoveStatus = (status: Status) => {
    if (draft.length <= 1) return;
    const taskCount = tasks.filter((t) => t.status_id === status.id).length;
    if (taskCount > 0) {
      setPendingMigrations((prev) => {
        if (prev.find((m) => m.fromStatusId === status.id)) return prev;
        return [...prev, { fromStatusId: status.id, fromStatusName: status.name, affectedCount: taskCount, toStatusId: null }];
      });
      removeStatus(status.id);
    } else {
      removeStatus(status.id);
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const hasPendingUnresolved = pendingMigrations.some((m) => !m.toStatusId);

  const handleSave = async () => {
    // Verify any remaining tasks via DB count for statuses removed directly
    if (!hasPendingUnresolved) {
      // Re-check removed statuses via DB (in case tasks were created after open)
      const existingIds = new Set(initialStatuses.map((s) => s.id));
      const newIds = new Set(draft.map((s) => s.id));
      const removedIds = [...existingIds].filter((id) => !newIds.has(id));
      const alreadyQueued = new Set(pendingMigrations.map((m) => m.fromStatusId));
      const unQueued = removedIds.filter((id) => !alreadyQueued.has(id));

      if (unQueued.length > 0) {
        setSaving(true);
        const counts = await countTasksForStatuses(workspaceId, unQueued);
        setSaving(false);
        const extra: PendingMigration[] = unQueued
          .filter((id) => (counts[id] ?? 0) > 0)
          .map((id) => ({
            fromStatusId: id,
            fromStatusName: initialStatuses.find((s) => s.id === id)?.name ?? id,
            affectedCount: counts[id],
            toStatusId: null,
          }));
        if (extra.length > 0) {
          setPendingMigrations((prev) => [...prev, ...extra]);
          return;
        }
      }
    }

    if (hasPendingUnresolved) return;

    setSaving(true);
    try {
      const migration: Record<string, string> = {};
      for (const m of pendingMigrations) {
        if (m.toStatusId) migration[m.fromStatusId] = m.toStatusId;
      }
      await saveStatuses(workspaceId, draft.map(({ workspace_id: _wid, ...rest }) => rest), migration);
      onSaved();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ── Template actions ──────────────────────────────────────────────────────

  const handleSaveTemplate = async () => {
    const name = templateName.trim();
    if (!name) return;
    setSavingTemplate(true);
    try {
      // We need the full Status array for createStatusTemplate
      const fullStatuses = draft.map((s) => ({ ...s })) as Status[];
      const tmpl = await createStatusTemplate(name, fullStatuses);
      onTemplatesChanged([...templates, tmpl]);
      setTemplateName("");
    } catch (err) {
      console.error(err);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (pendingDeleteTemplateId !== id) {
      setPendingDeleteTemplateId(id);
      setTimeout(() => setPendingDeleteTemplateId((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    const name = templates.find((t) => t.id === id)?.name ?? "Template";
    setPendingDeleteTemplateId(null);
    try {
      await deleteStatusTemplate(id);
      onTemplatesChanged(templates.filter((t) => t.id !== id));
      toast.success(`Deleted template "${name}"`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete template");
    }
  };

  const canSave = !hasPendingUnresolved && !saving;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 49 }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: "min(560px, 96vw)",
          maxHeight: "88vh",
          background: "var(--mc-surface)",
          border: "1px solid var(--mc-border)",
          boxShadow: "var(--mc-shadow-lg)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderBottom: "1px solid var(--mc-border)",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "var(--font-jost), Jost, sans-serif",
              color: "var(--mc-text-primary)",
            }}
          >
            Edit statuses
          </span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mc-text-muted)", display: "flex", padding: 2 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 0 20px" }}>

          {/* Migration banner */}
          {pendingMigrations.length > 0 && (
            <div
              style={{
                margin: "16px 20px 0",
                padding: "14px 16px",
                border: "1px solid var(--mc-warning, #c4a35a)",
                background: "rgba(196,163,90,0.06)",
              }}
            >
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--mc-warning, #c4a35a)",
                }}
              >
                The following statuses were removed but still have tasks. Reassign them before saving:
              </p>
              {pendingMigrations.map((m) => (
                <div
                  key={m.fromStatusId}
                  style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--mc-text-secondary)",
                      minWidth: 140,
                      flexShrink: 0,
                    }}
                  >
                    <strong>{m.fromStatusName}</strong> ({m.affectedCount} tasks)
                  </span>
                  <span style={{ fontSize: 12, color: "var(--mc-text-muted)" }}>→</span>
                  <select
                    value={m.toStatusId ?? ""}
                    onChange={(e) =>
                      setPendingMigrations((prev) =>
                        prev.map((pm) =>
                          pm.fromStatusId === m.fromStatusId
                            ? { ...pm, toStatusId: e.target.value || null }
                            : pm
                        )
                      )
                    }
                    style={{
                      flex: 1,
                      padding: "5px 8px",
                      fontSize: 12,
                      background: "var(--mc-surface-elevated)",
                      border: "1px solid var(--mc-border)",
                      color: "var(--mc-text-primary)",
                    }}
                  >
                    <option value="">Pick a status…</option>
                    {draft.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* Status list */}
          <div style={{ padding: "16px 20px 0" }}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={draft.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {draft.map((status) => (
                  <SortableStatusRow
                    key={status.id}
                    status={status}
                    canDelete={draft.length > 1}
                    colorPickerOpen={colorPickerFor === status.id}
                    onToggleColorPicker={() =>
                      setColorPickerFor((prev) => (prev === status.id ? null : status.id))
                    }
                    onCloseColorPicker={() => setColorPickerFor(null)}
                    taskCount={tasks.filter((t) => t.status_id === status.id).length}
                    onChange={(patch) => patchStatus(status.id, patch)}
                    onRemove={() => requestRemoveStatus(status)}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {/* Add status */}
            <button
              onClick={addStatus}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                marginTop: 6,
                padding: "6px 10px",
                fontSize: 12,
                background: "none",
                border: "1px dashed var(--mc-border)",
                color: "var(--mc-text-muted)",
                cursor: "pointer",
                width: "100%",
              }}
            >
              <Plus size={13} />
              Add status
            </button>
          </div>

          {/* Divider */}
          <div style={{ margin: "20px 0 0", borderTop: "1px solid var(--mc-border)" }} />

          {/* Templates section */}
          <div style={{ padding: "16px 20px 0" }}>
            <p
              style={{
                margin: "0 4px 0",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--mc-text-muted)",
              }}
            >
              Templates
            </p>
            <p style={{ margin: "0 0 12px", fontSize: 11, color: "var(--mc-text-muted)" }}>
              Saved templates — click to load, trash to delete
            </p>

            {/* Load template */}
            {templates.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const tmpl = templates.find((t) => t.id === e.target.value);
                    if (tmpl) loadTemplate(tmpl);
                    e.target.value = "";
                  }}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    fontSize: 12,
                    background: "var(--mc-surface-elevated)",
                    border: "1px solid var(--mc-border)",
                    color: "var(--mc-text-muted)",
                    cursor: "pointer",
                  }}
                >
                  <option value="" disabled>
                    Load template…
                  </option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Template list with delete */}
            {templates.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {templates.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "5px 0",
                      borderBottom: "1px solid var(--mc-border-light)",
                    }}
                  >
                    <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                      {t.statuses.map((s, i) => (
                        <div
                          key={i}
                          style={{ width: 8, height: 8, background: s.color, flexShrink: 0 }}
                          title={s.name}
                        />
                      ))}
                    </div>
                    <span style={{ flex: 1, fontSize: 12, color: "var(--mc-text-secondary)" }}>
                      {t.name}
                    </span>
                    {pendingDeleteTemplateId === t.id ? (
                      <button
                        onClick={() => handleDeleteTemplate(t.id)}
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 8px",
                          background: "var(--mc-error)",
                          color: "#fff",
                          border: "none",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        Confirm?
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDeleteTemplate(t.id)}
                        title="Delete template"
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.color = "var(--mc-error)";
                          (e.currentTarget as HTMLButtonElement).style.background = "rgba(196,90,90,0.08)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.color = "var(--mc-text-muted)";
                          (e.currentTarget as HTMLButtonElement).style.background = "none";
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--mc-text-muted)",
                          display: "flex",
                          padding: "4px 6px",
                          flexShrink: 0,
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Save as template */}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name…"
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveTemplate(); }}
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  fontSize: 12,
                  background: "var(--mc-surface-elevated)",
                  border: "1px solid var(--mc-border)",
                  color: "var(--mc-text-primary)",
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
              <button
                onClick={handleSaveTemplate}
                disabled={!templateName.trim() || savingTemplate}
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  background: templateName.trim() ? "var(--mc-surface-elevated)" : "var(--mc-surface)",
                  border: "1px solid var(--mc-border)",
                  color: templateName.trim() ? "var(--mc-text-secondary)" : "var(--mc-text-muted)",
                  cursor: templateName.trim() ? "pointer" : "default",
                }}
              >
                {savingTemplate ? "Saving…" : "Save as template"}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "12px 20px",
            borderTop: "1px solid var(--mc-border)",
            flexShrink: 0,
          }}
        >
          {hasPendingUnresolved && (
            <span style={{ fontSize: 11, color: "var(--mc-warning, #c4a35a)", alignSelf: "center", marginRight: "auto" }}>
              Reassign all affected tasks before saving.
            </span>
          )}
          <button
            onClick={onClose}
            style={{
              padding: "7px 16px",
              fontSize: 12,
              background: "none",
              border: "1px solid var(--mc-border)",
              color: "var(--mc-text-secondary)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              padding: "7px 20px",
              fontSize: 12,
              fontWeight: 600,
              background: canSave ? "var(--mc-cream)" : "var(--mc-surface-elevated)",
              color: canSave ? "var(--mc-text-inverse)" : "var(--mc-text-muted)",
              border: "none",
              cursor: canSave ? "pointer" : "not-allowed",
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Sortable row ─────────────────────────────────────────────────────────────

interface RowProps {
  status: Status;
  canDelete: boolean;
  colorPickerOpen: boolean;
  onToggleColorPicker: () => void;
  onCloseColorPicker: () => void;
  taskCount: number;
  onChange: (patch: Partial<Status>) => void;
  onRemove: () => void;
}

function SortableStatusRow({
  status,
  canDelete,
  colorPickerOpen,
  onToggleColorPicker,
  onCloseColorPicker,
  taskCount,
  onChange,
  onRemove,
}: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: status.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 0",
        borderBottom: "1px solid var(--mc-border-light)",
      }}
    >
      {/* Drag handle */}
      <span
        {...attributes}
        {...listeners}
        style={{ color: "var(--mc-text-muted)", cursor: "grab", display: "flex", flexShrink: 0 }}
      >
        <GripVertical size={14} />
      </span>

      {/* Color circle */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <button
          onClick={onToggleColorPicker}
          title="Change color"
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: status.color,
            border: "2px solid rgba(255,255,255,0.15)",
            cursor: "pointer",
            flexShrink: 0,
            padding: 0,
          }}
        />
        {colorPickerOpen && (
          <div
            style={{
              position: "absolute",
              top: 28,
              left: 0,
              zIndex: 100,
              background: "var(--mc-surface-elevated)",
              border: "1px solid var(--mc-border)",
              boxShadow: "var(--mc-shadow-lg)",
              padding: 8,
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              width: 160,
            }}
          >
            {COLOR_PALETTE.map(({ value, label }) => (
              <button
                key={value}
                title={label}
                onClick={() => {
                  onChange({ color: value });
                  onCloseColorPicker();
                }}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: value,
                  border:
                    status.color === value
                      ? "2px solid var(--mc-text-primary)"
                      : "2px solid transparent",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Name input */}
      <input
        value={status.name}
        onChange={(e) => onChange({ name: e.target.value })}
        style={{
          flex: 1,
          padding: "4px 8px",
          fontSize: 13,
          background: "var(--mc-surface-elevated)",
          border: "1px solid var(--mc-border)",
          color: "var(--mc-text-primary)",
          outline: "none",
          fontFamily: "inherit",
          minWidth: 0,
        }}
      />

      {/* Terminal checkbox */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontSize: 11,
          color: "var(--mc-text-muted)",
          cursor: "pointer",
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
        title="Terminal statuses are hidden from list view but visible in Kanban"
      >
        <input
          type="checkbox"
          checked={status.is_terminal}
          onChange={(e) => onChange({ is_terminal: e.target.checked })}
          style={{ accentColor: "var(--mc-cream)" }}
        />
        Terminal
      </label>

      {/* Task count badge */}
      {taskCount > 0 && (
        <span
          style={{
            fontSize: 10,
            padding: "2px 6px",
            background: "var(--mc-surface-elevated)",
            border: "1px solid var(--mc-border)",
            color: "var(--mc-text-muted)",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          {taskCount} task{taskCount !== 1 ? "s" : ""}
        </span>
      )}

      {/* Delete */}
      <button
        onClick={onRemove}
        disabled={!canDelete}
        title={!canDelete ? "At least one status required" : "Remove"}
        style={{
          background: "none",
          border: "none",
          cursor: canDelete ? "pointer" : "not-allowed",
          color: canDelete ? "var(--mc-text-muted)" : "var(--mc-border)",
          display: "flex",
          padding: 2,
          flexShrink: 0,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
