"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import type { Status } from "../lib/types";

interface Props {
  status: Status;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}

export default function GroupHeader({ status, count, collapsed, onToggle }: Props) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 16px",
        cursor: "pointer",
        borderBottom: "1px solid var(--mc-border-light)",
        background: "var(--mc-surface-warm)",
        userSelect: "none",
      }}
    >
      {/* Collapse chevron */}
      <span style={{ color: "var(--mc-text-muted)", display: "flex" }}>
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </span>

      {/* Status name */}
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: status.color,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {status.name}
      </span>

      {/* Count badge */}
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          padding: "1px 7px",
          background: `rgba(${hexToRgb(status.color)},0.12)`,
          border: `1px solid ${status.color}`,
          color: status.color,
        }}
      >
        {count}
      </span>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
