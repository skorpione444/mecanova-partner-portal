"use client";

import type { CRMStatus, PartnerType } from "@mecanova/shared";

interface PartnerPinProps {
  partnerType: PartnerType;
  status: CRMStatus | null;
  onClick?: () => void;
  selected?: boolean;
  hasOpenOrders?: boolean;
}

const PIN_COLORS: Record<string, string> = {
  uncontacted: "#7D7468",
  contacted: "#c4a35a",
  negotiating: "#d4763a",
  customer: "#6b8f6e",
  inactive: "#4a4540",
};

const OPEN_ORDER_COLOR = "#c4373a";

export default function PartnerPin({ partnerType, status, onClick, selected, hasOpenOrders }: PartnerPinProps) {
  const color = hasOpenOrders ? OPEN_ORDER_COLOR : PIN_COLORS[status ?? "customer"];
  const stroke = selected ? "#ecdfcc" : "rgba(236,223,204,0.6)";
  const strokeWidth = selected ? 2 : 1.5;
  const size = selected ? 22 : 18;

  const shadow = selected
    ? `drop-shadow(0 0 4px ${color}80) drop-shadow(0 2px 4px rgba(0,0,0,0.6))`
    : "drop-shadow(0 2px 4px rgba(0,0,0,0.5))";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      onClick={onClick}
      style={{ cursor: "pointer", filter: shadow, transition: "all 0.15s ease", display: "block", flexShrink: 0 }}
    >
      {partnerType === "distributor" && (
        // Diamond
        <polygon
          points="7,1 13,7 7,13 1,7"
          fill={color}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      )}
      {partnerType === "client" && (
        // Circle
        <circle
          cx="7"
          cy="7"
          r="5.5"
          fill={color}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      )}
      {partnerType === "supplier" && (
        // Triangle
        <polygon
          points="7,1.5 13,12.5 1,12.5"
          fill={color}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
