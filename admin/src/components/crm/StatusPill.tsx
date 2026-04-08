"use client";

import type { CRMStatus } from "@mecanova/shared";

interface StatusPillProps {
  status: CRMStatus;
  size?: "sm" | "md";
}

const STATUS_CONFIG: Record<
  CRMStatus,
  { label: string; color: string; bg: string }
> = {
  uncontacted: {
    label: "Uncontacted",
    color: "var(--mc-text-muted)",
    bg: "rgba(125, 116, 104, 0.12)",
  },
  contacted: {
    label: "Contacted",
    color: "var(--mc-warning)",
    bg: "var(--mc-warning-bg)",
  },
  negotiating: {
    label: "Negotiating",
    color: "#d4763a",
    bg: "rgba(212, 118, 58, 0.1)",
  },
  customer: {
    label: "Customer",
    color: "var(--mc-success)",
    bg: "var(--mc-success-bg)",
  },
  inactive: {
    label: "Inactive",
    color: "var(--mc-text-muted)",
    bg: "rgba(125, 116, 104, 0.08)",
  },
};

export default function StatusPill({ status, size = "md" }: StatusPillProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: size === "sm" ? "2px 7px" : "3px 9px",
        fontSize: size === "sm" ? "0.6rem" : "0.6875rem",
        fontWeight: 600,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        color: config.color,
        background: config.bg,
        border: `1px solid ${config.color}30`,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: config.color,
          flexShrink: 0,
        }}
      />
      {config.label}
    </span>
  );
}
