"use client";

import { useState, useEffect } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, notes: string) => void;
  isSaving: boolean;
  isEditing: boolean;
  initialName?: string;
  initialNotes?: string;
}

export default function SaveScenarioDialog({
  isOpen,
  onClose,
  onSave,
  isSaving,
  isEditing,
  initialName = "",
  initialNotes = "",
}: Props) {
  const [name, setName] = useState(initialName);
  const [notes, setNotes] = useState(initialNotes);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setNotes(initialNotes);
    }
  }, [isOpen, initialName, initialNotes]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--mc-surface)",
          border: "1px solid var(--mc-border)",
          width: 400,
          padding: "1.5rem",
        }}
      >
        <h2
          className="text-xs font-semibold tracking-[0.08em] uppercase mb-5"
          style={{ color: "var(--mc-text-muted)" }}
        >
          {isEditing ? "Save changes" : "Save measurement"}
        </h2>

        <div className="space-y-3">
          <div>
            <label className="mc-label">Name *</label>
            <input
              className="mc-input w-full mt-1"
              placeholder="e.g. Tequila Reserva — Berlin Q3"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim() && !isSaving) onSave(name, notes);
                if (e.key === "Escape") onClose();
              }}
            />
          </div>
          <div>
            <label className="mc-label">Notes (optional)</label>
            <textarea
              className="mc-input w-full mt-1 resize-none"
              rows={3}
              placeholder="Any context, assumptions, or deal stage…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ fontFamily: "Manrope, sans-serif", fontSize: 12 }}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button className="mc-btn mc-btn-ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            className="mc-btn mc-btn-primary"
            onClick={() => onSave(name.trim(), notes.trim())}
            disabled={!name.trim() || isSaving}
          >
            {isSaving ? "Saving…" : isEditing ? "Save changes" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
