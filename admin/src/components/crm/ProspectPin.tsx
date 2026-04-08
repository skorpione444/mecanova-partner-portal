"use client";

import type { CRMStatus } from "@mecanova/shared";

interface ProspectPinProps {
  status: CRMStatus;
  onClick?: () => void;
  selected?: boolean;
}

const PIN_COLORS: Record<CRMStatus, string> = {
  uncontacted: "#7D7468",
  contacted: "#c4a35a",
  negotiating: "#d4763a",
  customer: "#6b8f6e",
  inactive: "#4a4540",
};

export default function ProspectPin({ status, onClick, selected }: ProspectPinProps) {
  const color = PIN_COLORS[status];
  const size = selected ? 18 : 14;

  return (
    <div
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        border: selected ? "2px solid #ecdfcc" : "2px solid rgba(236,223,204,0.5)",
        boxShadow: selected
          ? `0 0 0 3px ${color}40, 0 3px 8px rgba(0,0,0,0.5)`
          : "0 2px 5px rgba(0,0,0,0.4)",
        cursor: "pointer",
        transition: "all 0.15s ease",
        flexShrink: 0,
      }}
    />
  );
}
