interface CostItem {
  label: string;
  value: number;
}

interface CostBreakdownBarProps {
  readonly costs: CostItem[];
  readonly total: number;
}

const COST_COLORS = [
  "var(--mc-cream)",
  "var(--mc-cream-muted)",
  "var(--mc-cream-subtle)",
  "var(--mc-cream-faint)",
  "var(--mc-info)",
  "var(--mc-warning)",
];

export default function CostBreakdownBar({
  costs,
  total,
}: CostBreakdownBarProps) {
  if (total === 0) {
    return (
      <div
        className="h-5 w-full"
        style={{ background: "var(--mc-surface-warm)" }}
      />
    );
  }

  return (
    <div>
      <div className="flex h-5 w-full overflow-hidden">
        {costs.map((cost, i) => {
          const pct = (cost.value / total) * 100;
          if (cost.value === 0) return null;
          return (
            <div
              key={cost.label}
              className="h-full transition-all duration-300"
              style={{
                width: `${pct}%`,
                background: COST_COLORS[i % COST_COLORS.length],
                opacity: 0.85,
                minWidth: cost.value > 0 ? 2 : 0,
              }}
              title={`${cost.label}: EUR ${cost.value.toFixed(2)}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
        {costs
          .filter((c) => c.value > 0)
          .map((cost, i) => (
            <div key={cost.label} className="flex items-center gap-1">
              <div
                className="w-1.5 h-1.5 flex-shrink-0"
                style={{ background: COST_COLORS[i % COST_COLORS.length] }}
              />
              <span
                className="text-[9px]"
                style={{ color: "var(--mc-text-muted)" }}
              >
                {cost.label} ({cost.value.toFixed(2)})
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
