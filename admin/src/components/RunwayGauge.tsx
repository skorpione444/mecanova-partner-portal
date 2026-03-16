interface RunwayGaugeProps {
  readonly months: number;
  readonly maxMonths?: number;
}

export default function RunwayGauge({
  months,
  maxMonths = 18,
}: RunwayGaugeProps) {
  const pct = Math.min((months / maxMonths) * 100, 100);
  const color =
    months > 6
      ? "var(--mc-success)"
      : months >= 3
        ? "var(--mc-warning)"
        : "var(--mc-error)";

  return (
    <div>
      <div
        className="h-3 w-full"
        style={{ background: "var(--mc-surface-warm)" }}
      >
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
          0
        </span>
        <span className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
          {maxMonths} months
        </span>
      </div>
    </div>
  );
}
