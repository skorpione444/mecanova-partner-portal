"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Status } from "./lib/types";
import StatusBadge from "./StatusBadge";

interface Props {
  statuses: Status[];
  currentStatusId: string | null;
  anchorRect: DOMRect;
  onChange: (statusId: string) => void;
  onClose: () => void;
}

export default function StatusPicker({ statuses, currentStatusId, anchorRect, onChange, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Flip upward if near bottom of screen
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const estimatedHeight = statuses.length * 38;
  const above = spaceBelow < estimatedHeight && anchorRect.top > estimatedHeight;

  const style: React.CSSProperties = {
    position: "fixed",
    left: anchorRect.left,
    zIndex: 1000,
    background: "var(--mc-surface-elevated)",
    border: "1px solid var(--mc-border)",
    boxShadow: "var(--mc-shadow-lg)",
    minWidth: Math.max(anchorRect.width, 160),
    ...(above
      ? { bottom: window.innerHeight - anchorRect.top + 4 }
      : { top: anchorRect.bottom + 4 }),
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div ref={ref} style={style}>
      {statuses.map((s) => (
        <div
          key={s.id}
          onClick={() => {
            onChange(s.id);
            onClose();
          }}
          style={{
            padding: "7px 12px",
            cursor: "pointer",
            background: s.id === currentStatusId ? "rgba(236,223,204,0.06)" : "transparent",
            borderBottom: "1px solid var(--mc-border-light)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--mc-surface-warm)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background =
              s.id === currentStatusId ? "rgba(236,223,204,0.06)" : "transparent";
          }}
        >
          <StatusBadge status={s} />
        </div>
      ))}
    </div>,
    document.body
  );
}
