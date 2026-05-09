"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Status, StatusTemplate } from "./lib/types";
import { COLOR_PALETTE, WORKSPACE_ICONS } from "./lib/statuses";
import { fetchStatusTemplates } from "./lib/queries";

interface Props {
  onClose: () => void;
  onSubmit: (
    name: string,
    icon: string,
    color: string,
    templateStatuses: Omit<Status, "id" | "workspace_id">[] | null
  ) => void;
}

export default function NewWorkspaceModal({ onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📁");
  const [color, setColor] = useState(COLOR_PALETTE[5].value); // Cream
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("default");
  const [templates, setTemplates] = useState<StatusTemplate[]>([]);

  useEffect(() => {
    fetchStatusTemplates().then(setTemplates).catch(() => {});
  }, []);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const tmpl = templates.find((t) => t.id === selectedTemplateId);
    onSubmit(trimmed, icon, color, tmpl ? tmpl.statuses : null);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 49 }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          width: "min(480px, 96vw)",
          background: "var(--mc-surface)",
          border: "1px solid var(--mc-border)",
          boxShadow: "var(--mc-shadow-lg)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid var(--mc-border)" }}>
          <span style={{ fontSize: 16, fontWeight: 600, fontFamily: "var(--font-jost), Jost, sans-serif", color: "var(--mc-text-primary)" }}>
            New Workspace
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mc-text-muted)", display: "flex" }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Name */}
          <Field label="Name">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              placeholder="e.g. Marketing, Engineering…"
              style={inputStyle}
            />
          </Field>

          {/* Icon */}
          <Field label="Icon">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {WORKSPACE_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setIcon(emoji)}
                  style={{
                    fontSize: 18, width: 32, height: 32,
                    background: icon === emoji ? "var(--mc-surface-elevated)" : "none",
                    border: icon === emoji ? "1px solid var(--mc-cream)" : "1px solid transparent",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </Field>

          {/* Color */}
          <Field label="Color">
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {COLOR_PALETTE.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setColor(value)}
                  title={label}
                  style={{
                    width: 24, height: 24, background: value,
                    border: color === value ? "2px solid var(--mc-text-primary)" : "2px solid transparent",
                    cursor: "pointer", outline: "none",
                  }}
                />
              ))}
            </div>
          </Field>

          {/* Starting statuses */}
          <Field label="Starting statuses">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {/* Default option */}
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "6px 8px", background: selectedTemplateId === "default" ? "var(--mc-surface-elevated)" : "transparent", border: "1px solid var(--mc-border)" }}>
                <input
                  type="radio"
                  name="template"
                  value="default"
                  checked={selectedTemplateId === "default"}
                  onChange={() => setSelectedTemplateId("default")}
                  style={{ accentColor: "var(--mc-cream)" }}
                />
                <span style={{ fontSize: 13, color: "var(--mc-text-secondary)" }}>Default</span>
                <span style={{ fontSize: 11, color: "var(--mc-text-muted)", marginLeft: "auto" }}>Open · In Progress · Blocked · Done · Cancelled</span>
              </label>

              {/* Template options */}
              {templates.map((tmpl) => (
                <label
                  key={tmpl.id}
                  style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "6px 8px", background: selectedTemplateId === tmpl.id ? "var(--mc-surface-elevated)" : "transparent", border: "1px solid var(--mc-border)" }}
                >
                  <input
                    type="radio"
                    name="template"
                    value={tmpl.id}
                    checked={selectedTemplateId === tmpl.id}
                    onChange={() => setSelectedTemplateId(tmpl.id)}
                    style={{ accentColor: "var(--mc-cream)" }}
                  />
                  <div style={{ display: "flex", gap: 3 }}>
                    {tmpl.statuses.map((s, i) => (
                      <div key={i} style={{ width: 9, height: 9, background: s.color }} title={s.name} />
                    ))}
                  </div>
                  <span style={{ fontSize: 13, color: "var(--mc-text-secondary)" }}>{tmpl.name}</span>
                </label>
              ))}
            </div>
          </Field>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 24px", borderTop: "1px solid var(--mc-border)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={ghostBtnStyle}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            style={{ ...primaryBtnStyle, opacity: name.trim() ? 1 : 0.45, cursor: name.trim() ? "pointer" : "not-allowed" }}
          >
            Create
          </button>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--mc-text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  fontSize: 13,
  background: "var(--mc-surface-elevated)",
  border: "1px solid var(--mc-border)",
  color: "var(--mc-text-primary)",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "7px 18px",
  fontSize: 12,
  fontWeight: 600,
  background: "var(--mc-cream)",
  color: "var(--mc-text-inverse)",
  border: "none",
  cursor: "pointer",
};

const ghostBtnStyle: React.CSSProperties = {
  padding: "6px 14px",
  fontSize: 12,
  background: "none",
  border: "1px solid var(--mc-border)",
  color: "var(--mc-text-secondary)",
  cursor: "pointer",
};
