import type { OrderStatus } from "@/lib/supabase/types";

const STATUS_CONFIG: Record<
  string,
  { bg: string; text: string; border: string; dot: string; label: string }
> = {
  created: {
    bg: "rgba(125, 116, 104, 0.08)",
    text: "#7D7468",
    border: "rgba(125, 116, 104, 0.2)",
    dot: "#7D7468",
    label: "Draft",
  },
  submitted: {
    bg: "rgba(196, 163, 90, 0.08)",
    text: "#c4a35a",
    border: "rgba(196, 163, 90, 0.2)",
    dot: "#c4a35a",
    label: "Submitted",
  },
  accepted: {
    bg: "rgba(90, 138, 176, 0.08)",
    text: "#5a8ab0",
    border: "rgba(90, 138, 176, 0.2)",
    dot: "#5a8ab0",
    label: "Accepted",
  },
  fulfilled: {
    bg: "rgba(107, 143, 110, 0.08)",
    text: "#6b8f6e",
    border: "rgba(107, 143, 110, 0.2)",
    dot: "#6b8f6e",
    label: "Fulfilled",
  },
  rejected: {
    bg: "rgba(196, 90, 90, 0.08)",
    text: "#c45a5a",
    border: "rgba(196, 90, 90, 0.2)",
    dot: "#c45a5a",
    label: "Rejected",
  },
  cancelled: {
    bg: "rgba(92, 84, 73, 0.08)",
    text: "#5C5449",
    border: "rgba(92, 84, 73, 0.2)",
    dot: "#5C5449",
    label: "Cancelled",
  },
};

interface StatusBadgeProps {
  status: OrderStatus | string;
  large?: boolean;
}

export default function StatusBadge({ status, large }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.created;

  return (
    <span
      className={`mc-animate-badge inline-flex items-center gap-1.5 font-medium ${
        large ? "px-3.5 py-1.5 text-xs" : "px-2.5 py-1 text-[11px]"
      }`}
      style={{
        background: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
        fontFamily: "var(--font-manrope), Manrope, sans-serif",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      <span
        className={`flex-shrink-0 ${large ? "w-1.5 h-1.5" : "w-1 h-1"}`}
        style={{ background: config.dot }}
      />
      {config.label}
    </span>
  );
}
