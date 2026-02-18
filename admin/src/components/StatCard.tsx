import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  readonly label: string;
  readonly value: string | number;
  readonly icon: LucideIcon;
  readonly trend?: string;
  readonly color?: "cream" | "success" | "warning" | "error" | "info";
}

const colorMap = {
  cream: { icon: "var(--mc-cream)", bg: "rgba(236, 223, 204, 0.08)" },
  success: { icon: "var(--mc-success)", bg: "var(--mc-success-bg)" },
  warning: { icon: "var(--mc-warning)", bg: "var(--mc-warning-bg)" },
  error: { icon: "var(--mc-error)", bg: "var(--mc-error-bg)" },
  info: { icon: "var(--mc-info)", bg: "var(--mc-info-bg)" },
};

export default function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  color = "cream",
}: StatCardProps) {
  const c = colorMap[color];

  return (
    <div className="mc-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p
            className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-2"
            style={{ color: "var(--mc-text-muted)" }}
          >
            {label}
          </p>
          <p
            className="text-2xl font-medium"
            style={{
              fontFamily: "var(--font-jost), Jost, sans-serif",
              color: "var(--mc-text-primary)",
            }}
          >
            {value}
          </p>
          {trend && (
            <p
              className="text-[11px] mt-1"
              style={{ color: "var(--mc-text-tertiary)" }}
            >
              {trend}
            </p>
          )}
        </div>
        <div
          className="w-9 h-9 flex items-center justify-center flex-shrink-0"
          style={{ background: c.bg }}
        >
          <Icon className="w-[18px] h-[18px]" style={{ color: c.icon }} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}



