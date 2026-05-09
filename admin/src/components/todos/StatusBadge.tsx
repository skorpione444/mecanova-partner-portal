"use client";

import type { Status } from "./lib/types";
import { colorBg } from "./lib/statuses";

interface Props {
  status: Status;
  clickable?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export default function StatusBadge({ status, clickable, onClick }: Props) {
  return (
    <span
      onClick={
        clickable && onClick
          ? (e) => {
              e.stopPropagation();
              onClick(e);
            }
          : undefined
      }
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        background: colorBg(status.color),
        border: `1px solid ${status.color}`,
        color: status.color,
        cursor: clickable ? "pointer" : "default",
        userSelect: "none",
        whiteSpace: "nowrap",
        transition: "opacity 120ms",
      }}
      onMouseEnter={clickable ? (e) => { e.currentTarget.style.opacity = "0.7"; } : undefined}
      onMouseLeave={clickable ? (e) => { e.currentTarget.style.opacity = "1"; } : undefined}
    >
      {status.name}
    </span>
  );
}
