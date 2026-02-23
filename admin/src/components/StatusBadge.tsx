import type { OrderStatus } from "@mecanova/shared";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@mecanova/shared";
import type { ActiveOrderStatus } from "@mecanova/shared";

const colorStyles = {
  success: {
    bg: "var(--mc-success-bg)",
    border: "var(--mc-success-light)",
    text: "var(--mc-success)",
  },
  warning: {
    bg: "var(--mc-warning-bg)",
    border: "var(--mc-warning-light)",
    text: "var(--mc-warning)",
  },
  error: {
    bg: "var(--mc-error-bg)",
    border: "var(--mc-error-light)",
    text: "var(--mc-error)",
  },
  info: {
    bg: "var(--mc-info-bg)",
    border: "var(--mc-info-light)",
    text: "var(--mc-info)",
  },
};

interface StatusBadgeProps {
  readonly status: OrderStatus;
  readonly large?: boolean;
}

export default function StatusBadge({ status, large }: StatusBadgeProps) {
  const isActive = status in ORDER_STATUS_COLORS;
  const colorKey = isActive
    ? ORDER_STATUS_COLORS[status as ActiveOrderStatus]
    : "info";
  const label = isActive
    ? ORDER_STATUS_LABELS[status as ActiveOrderStatus]
    : status;
  const c = colorStyles[colorKey];

  return (
    <span
      className={`inline-flex items-center font-medium tracking-wide uppercase ${
        large ? "px-3 py-1.5 text-[11px]" : "px-2 py-1 text-[10px]"
      }`}
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
      }}
    >
      {label}
    </span>
  );
}




