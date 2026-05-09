"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Workspace, Status } from "./lib/types";
import { COLOR_PALETTE, WORKSPACE_ICONS } from "./lib/statuses";
import { updateWorkspace, deleteWorkspace } from "./lib/queries";

interface Props {
  workspace: Workspace;
  statuses: Status[];
  onClose: () => void;
  onWorkspaceUpdated: (ws: Workspace) => void;
  onWorkspaceDeleted: (id: string) => void;
  onStatusesUpdated: (statuses: Status[]) => void;
}

type Tab = "general" | "appearance";

export default function WorkspaceSettingsModal({
  workspace,
  onClose,
  onWorkspaceUpdated,
  onWorkspaceDeleted,
}: Props) {
  const [tab, setTab] = useState<Tab>("general");
  const [wsDraft, setWsDraft] = useState<Workspace>({ ...workspace });
  const [saving, setSaving] = useState(false);
  const [showDeleteWorkspace, setShowDeleteWorkspace] = useState(false);

  const TABS: { id: Tab; label: string }[] = [
    { id: "general",    label: "General" },
    { id: "appearance", label: "Icon & Color" },
  ];

  const saveGeneral = async () => {
    setSaving(true);
    try {
      await updateWorkspace(workspace.id, { name: wsDraft.name, description: wsDraft.description });
      onWorkspaceUpdated({ ...workspace, name: wsDraft.name, description: wsDraft.description });
    } finally { setSaving(false); }
  };

  const handleDeleteWorkspace = async () => {
    setSaving(true);
    try {
      await deleteWorkspace(workspace.id);
      onWorkspaceDeleted(workspace.id);
    } finally { setSaving(false); }
  };

  const saveAppearance = async () => {
    setSaving(true);
    try {
      await updateWorkspace(workspace.id, { icon: wsDraft.icon, color: wsDraft.color });
      onWorkspaceUpdated({ ...workspace, icon: wsDraft.icon, color: wsDraft.color });
    } finally { setSaving(false); }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 49 }} />

      <div
        style={{
          position: "fixed",
          top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          width: "min(560px, 96vw)",
          maxHeight: "85vh",
          background: "var(--mc-surface)",
          border: "1px solid var(--mc-border)",
          boxShadow: "var(--mc-shadow-lg)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid var(--mc-border)", flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 600, fontFamily: "var(--font-jost), Jost, sans-serif", color: "var(--mc-text-primary)" }}>
            {workspace.icon} {workspace.name} — Settings
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mc-text-muted)", display: "flex" }}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--mc-border)", flexShrink: 0, background: "var(--mc-surface-warm)" }}>
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                padding: "9px 18px",
                fontSize: 12,
                fontWeight: 500,
                background: "none",
                border: "none",
                borderBottom: tab === id ? "2px solid var(--mc-cream)" : "2px solid transparent",
                color: tab === id ? "var(--mc-text-primary)" : "var(--mc-text-muted)",
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>

          {tab === "general" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Workspace name">
                <input
                  value={wsDraft.name}
                  onChange={(e) => setWsDraft((d) => ({ ...d, name: e.target.value }))}
                  style={inputStyle}
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={wsDraft.description}
                  onChange={(e) => setWsDraft((d) => ({ ...d, description: e.target.value }))}
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </Field>
              <div>
                <button onClick={saveGeneral} disabled={saving} style={primaryBtnStyle}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>

              <div style={{ marginTop: 24, padding: "16px", border: "1px solid var(--mc-error)", background: "rgba(196,90,90,0.04)" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--mc-error)", marginBottom: 8, marginTop: 0 }}>
                  Danger Zone
                </p>
                <p style={{ fontSize: 12, color: "var(--mc-text-muted)", marginBottom: 12, marginTop: 0 }}>
                  Deleting this workspace permanently removes all its tasks.
                </p>
                {showDeleteWorkspace ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={handleDeleteWorkspace} style={{ ...primaryBtnStyle, background: "var(--mc-error)" }}>
                      Yes, delete
                    </button>
                    <button onClick={() => setShowDeleteWorkspace(false)} style={ghostBtnStyle}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setShowDeleteWorkspace(true)} style={{ ...ghostBtnStyle, borderColor: "var(--mc-error)", color: "var(--mc-error)" }}>
                    Delete workspace
                  </button>
                )}
              </div>
            </div>
          )}

          {tab === "appearance" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <Field label="Icon">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {WORKSPACE_ICONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setWsDraft((d) => ({ ...d, icon: emoji }))}
                      style={{
                        fontSize: 20,
                        width: 36, height: 36,
                        background: wsDraft.icon === emoji ? "var(--mc-surface-elevated)" : "none",
                        border: wsDraft.icon === emoji ? "1px solid var(--mc-cream)" : "1px solid transparent",
                        cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Color">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {COLOR_PALETTE.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setWsDraft((d) => ({ ...d, color: value }))}
                      title={label}
                      style={{
                        width: 28, height: 28,
                        background: value,
                        border: wsDraft.color === value ? "2px solid var(--mc-text-primary)" : "2px solid transparent",
                        cursor: "pointer",
                        outline: "none",
                      }}
                    />
                  ))}
                </div>
              </Field>

              <div>
                <button onClick={saveAppearance} disabled={saving} style={primaryBtnStyle}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}
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
