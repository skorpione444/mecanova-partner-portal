import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@mecanova/shared";
import type { ActiveOrderStatus } from "@mecanova/shared";

const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  info: { bg: "var(--mc-info-bg)", border: "var(--mc-info-light)", text: "var(--mc-info)" },
  warning: { bg: "var(--mc-warning-bg)", border: "var(--mc-warning-light)", text: "var(--mc-warning)" },
  success: { bg: "var(--mc-success-bg)", border: "var(--mc-success-light)", text: "var(--mc-success)" },
  error: { bg: "var(--mc-error-bg)", border: "var(--mc-error-light)", text: "var(--mc-error)" },
};

export default function StatusBadge({ status }: { status: string }) {
  const colorKey = ORDER_STATUS_COLORS[status as ActiveOrderStatus] || "info";
  const colors = COLOR_MAP[colorKey] || COLOR_MAP.info;

  return (
    <span
      className="inline-flex px-3 py-1 text-[10px] font-medium tracking-wide uppercase"
      style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}
    >
      {ORDER_STATUS_LABELS[status as ActiveOrderStatus] || status}
    </span>
  );
}
