"use client";

import { useState } from "react";
import { Settings, Plus } from "lucide-react";
import type { Workspace } from "./lib/types";

interface Props {
  workspaces: Workspace[];
  activeId: string;
  onSwitch: (id: string) => void;
  onOpenSettings: (workspace: Workspace) => void;
  onCreateWorkspace: () => void;
}

export default function WorkspaceTabs({
  workspaces,
  activeId,
  onSwitch,
  onOpenSettings,
  onCreateWorkspace,
}: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        overflowX: "auto",
        borderBottom: "1px solid var(--mc-border)",
        background: "var(--mc-surface-warm)",
        padding: "0 20px",
        scrollbarWidth: "none",
        flexShrink: 0,
      }}
    >
      {workspaces.map((ws) => {
        const isActive = ws.id === activeId;
        const isHovered = hoveredId === ws.id;

        return (
          <div
            key={ws.id}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 14px",
              cursor: "pointer",
              color: isActive ? "var(--mc-text-primary)" : "var(--mc-text-muted)",
              borderBottom: isActive
                ? `2px solid ${ws.color}`
                : "2px solid transparent",
              marginBottom: -1,
              whiteSpace: "nowrap",
              transition: "color 150ms",
              userSelect: "none",
            }}
            onMouseEnter={() => setHoveredId(ws.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onSwitch(ws.id)}
          >
            {/* Color dot */}
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: ws.color,
                flexShrink: 0,
              }}
            />
            {/* Emoji icon */}
            <span style={{ fontSize: 13 }}>{ws.icon}</span>
            {/* Name */}
            <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400 }}>
              {ws.name}
            </span>
            {/* Settings cog (shows on hover) */}
            {isHovered && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSettings(ws);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 18,
                  height: 18,
                  padding: 0,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--mc-text-muted)",
                }}
                title="Workspace settings"
              >
                <Settings size={13} />
              </button>
            )}
          </div>
        );
      })}

      {/* New workspace button */}
      <button
        onClick={onCreateWorkspace}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "10px 12px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--mc-text-muted)",
          fontSize: 13,
          whiteSpace: "nowrap",
          transition: "color 150ms",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-text-primary)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-text-muted)")}
        title="New workspace"
      >
        <Plus size={14} />
        <span>New</span>
      </button>
    </div>
  );
}
