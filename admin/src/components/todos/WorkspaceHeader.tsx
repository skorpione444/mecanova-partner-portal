"use client";

import type { Workspace } from "./lib/types";

interface Props {
  workspace: Workspace;
}

export default function WorkspaceHeader({ workspace }: Props) {
  return (
    <div
      style={{
        padding: "18px 24px 14px",
        borderBottom: "1px solid var(--mc-border)",
        borderLeft: `4px solid ${workspace.color}`,
        background: "var(--mc-surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20 }}>{workspace.icon}</span>
        <h1
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 600,
            fontFamily: "var(--font-jost), Jost, sans-serif",
            color: "var(--mc-text-primary)",
            letterSpacing: "0.02em",
          }}
        >
          {workspace.name}
        </h1>
      </div>
      {workspace.description && (
        <p
          style={{
            margin: "6px 0 0 30px",
            fontSize: 13,
            color: "var(--mc-text-tertiary)",
            lineHeight: 1.5,
          }}
        >
          {workspace.description}
        </p>
      )}
    </div>
  );
}
