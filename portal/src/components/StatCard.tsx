import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  loading?: boolean;
  icon?: LucideIcon;
  accent?: boolean;
}

export default function StatCard({
  title,
  value,
  loading,
  icon: Icon,
  accent,
}: StatCardProps) {
  return (
    <div className="mc-card mc-card-lift p-6 relative overflow-hidden group">
      <div className="flex items-start justify-between mb-4">
        <p
          className="text-[10px] font-semibold tracking-[0.1em] uppercase"
          style={{
            fontFamily: "var(--font-manrope), Manrope, sans-serif",
            color: "var(--mc-text-muted)",
          }}
        >
          {title}
        </p>
        {Icon && (
          <div
            className="w-7 h-7 flex items-center justify-center flex-shrink-0"
            style={{
              background: accent
                ? "rgba(236, 223, 204, 0.06)"
                : "rgba(236, 223, 204, 0.04)",
              color: accent ? "#ecdfcc" : "#7D7468",
            }}
          >
            <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="mc-skeleton h-9 w-20 mt-1" />
      ) : (
        <p
          className="text-3xl font-light tracking-tight"
          style={{
            fontFamily: "var(--font-jost), Jost, sans-serif",
            color: "#ecdfcc",
          }}
        >
          {value}
        </p>
      )}
    </div>
  );
}
