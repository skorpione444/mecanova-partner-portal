"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, X } from "lucide-react";
import type { Partner } from "@mecanova/shared";

interface Props {
  partner: Partner;
  onClose: () => void;
  onSaved: (notes: string | null) => void;
}

export default function PartnerNotesModal({ partner, onClose, onSaved }: Props) {
  const supabase = createClient();
  const [notes, setNotes] = useState(partner.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const value = notes.trim() || null;
    const { error: dbError } = await supabase
      .from("partners")
      .update({ notes: value })
      .eq("id", partner.id);
    if (dbError) {
      setError(dbError.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    onSaved(value);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(10,11,13,0.8)",
        backdropFilter: "blur(2px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 480,
          maxWidth: "96vw",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "var(--mc-surface)",
          border: "1px solid var(--mc-border)",
          boxShadow: "var(--mc-shadow-lg)",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--mc-border)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "0.9375rem",
                fontWeight: 500,
                color: "var(--mc-text-primary)",
                fontFamily: "var(--font-jost), Jost, sans-serif",
                margin: 0,
              }}
            >
              Edit Notes
            </h2>
            <p style={{ fontSize: "0.75rem", color: "var(--mc-text-muted)", marginTop: 2 }}>
              {partner.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--mc-text-muted)",
              padding: 4,
              lineHeight: 0,
            }}
          >
            <X style={{ width: 16, height: 16 }} strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px" }}>
          <label className="mc-label">Notes</label>
          <textarea
            className="mc-input"
            rows={6}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal notes or description about this partner..."
            style={{ resize: "vertical" }}
            autoFocus
          />

          {error && (
            <p style={{ fontSize: "0.75rem", color: "var(--mc-error)", marginTop: 12 }}>
              {error}
            </p>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button type="button" onClick={onClose} className="mc-btn mc-btn-ghost" style={{ flex: 1 }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="mc-btn mc-btn-primary"
              style={{ flex: 2 }}
            >
              {saving ? (
                <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
              ) : (
                "Save Notes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
