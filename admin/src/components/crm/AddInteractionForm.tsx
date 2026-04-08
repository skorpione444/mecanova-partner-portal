"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Paperclip, X } from "lucide-react";
import type { CRMInteractionType } from "@mecanova/shared";

interface AddInteractionFormProps {
  entityType: "prospect" | "partner";
  entityId: string;
  userId: string;
  onAdded: () => void;
}

const TYPES: { value: CRMInteractionType; label: string }[] = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "note", label: "Note" },
];

export default function AddInteractionForm({
  entityType,
  entityId,
  userId,
  onAdded,
}: AddInteractionFormProps) {
  const [type, setType] = useState<CRMInteractionType>("note");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) return;

    setLoading(true);
    setError(null);

    let filePath: string | null = null;
    let fileName: string | null = null;

    // Upload file if attached
    if (file) {
      const ext = file.name.split(".").pop();
      const path = `crm/${entityType}/${entityId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("crm-files")
        .upload(path, file);

      if (uploadError) {
        console.warn("File upload failed:", uploadError.message);
        // Continue without file rather than blocking the interaction
      } else {
        filePath = path;
        fileName = file.name;
      }
    }

    const insert = {
      interaction_type: type,
      summary: summary.trim(),
      body: body.trim() || null,
      file_path: filePath,
      file_name: fileName,
      created_by: userId,
      occurred_at: new Date().toISOString(),
      ...(entityType === "prospect"
        ? { prospect_id: entityId }
        : { partner_id: entityId }),
    };

    const { error: insertError } = await supabase
      .from("crm_interactions")
      .insert(insert);

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setSummary("");
    setBody("");
    setFile(null);
    setLoading(false);
    onAdded();
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Type selector */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            style={{
              padding: "4px 10px",
              fontSize: "0.6875rem",
              fontWeight: 600,
              letterSpacing: "0.05em",
              cursor: "pointer",
              border: "1px solid",
              borderColor: type === t.value ? "var(--mc-cream)" : "var(--mc-border)",
              background: type === t.value ? "rgba(236,223,204,0.08)" : "transparent",
              color: type === t.value ? "var(--mc-cream)" : "var(--mc-text-muted)",
              transition: "all 0.15s ease",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Summary */}
      <input
        className="mc-input"
        placeholder="Summary (e.g. Left voicemail, discussed pricing)"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        required
        style={{ marginBottom: 8 }}
      />

      {/* Body */}
      <textarea
        className="mc-input"
        placeholder="Additional notes (optional)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        style={{ marginBottom: 8, resize: "vertical" }}
      />

      {/* File attachment */}
      <div style={{ marginBottom: 12 }}>
        {file ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              background: "var(--mc-graphite)",
              border: "1px solid var(--mc-border)",
              fontSize: "0.75rem",
              color: "var(--mc-text-secondary)",
            }}
          >
            <Paperclip style={{ width: 12, height: 12 }} strokeWidth={1.5} />
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {file.name}
            </span>
            <button
              type="button"
              onClick={() => setFile(null)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--mc-text-muted)",
                padding: 0,
                lineHeight: 0,
              }}
            >
              <X style={{ width: 12, height: 12 }} strokeWidth={2} />
            </button>
          </div>
        ) : (
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              fontSize: "0.75rem",
              color: "var(--mc-text-muted)",
              border: "1px dashed var(--mc-border)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <Paperclip style={{ width: 12, height: 12 }} strokeWidth={1.5} />
            Attach file
            <input
              type="file"
              style={{ display: "none" }}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        )}
      </div>

      {error && (
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--mc-error)",
            marginBottom: 8,
          }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !summary.trim()}
        className="mc-btn mc-btn-primary"
        style={{ width: "100%" }}
      >
        {loading ? (
          <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
        ) : (
          "Log Interaction"
        )}
      </button>
    </form>
  );
}
