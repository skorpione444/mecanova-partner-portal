import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
}

export default function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  return (
    <div className="mc-card p-4 flex items-center gap-3">
      <div
        className="flex items-center justify-center w-9 h-9 rounded-sm"
        style={{ background: "var(--mc-surface-warm)", color: color || "var(--mc-cream)" }}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-[10px] tracking-[0.1em] uppercase" style={{ color: "var(--mc-text-muted)" }}>
          {label}
        </p>
        <p className="text-lg font-semibold" style={{ color: "var(--mc-cream)" }}>
          {value}
        </p>
      </div>
    </div>
  );
}
