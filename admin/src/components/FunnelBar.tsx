interface FunnelStage {
  label: string;
  count: number;
  color: string;
}

interface FunnelBarProps {
  readonly stages: FunnelStage[];
}

export default function FunnelBar({ stages }: FunnelBarProps) {
  const total = stages.reduce((sum, s) => sum + s.count, 0);

  if (total === 0) {
    return (
      <div>
        <div
          className="h-6 w-full"
          style={{ background: "var(--mc-surface-warm)" }}
        />
        <p
          className="text-[10px] mt-2 text-center"
          style={{ color: "var(--mc-text-muted)" }}
        >
          No data yet
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex h-6 w-full overflow-hidden">
        {stages.map((stage) => {
          const pct = (stage.count / total) * 100;
          if (stage.count === 0) return null;
          return (
            <div
              key={stage.label}
              className="h-full flex items-center justify-center text-[9px] font-semibold tracking-wide transition-all duration-300"
              style={{
                width: `${pct}%`,
                background: stage.color,
                color: "var(--mc-black)",
                minWidth: 24,
              }}
              title={`${stage.label}: ${stage.count}`}
            >
              {stage.count}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2">
        {stages.map((stage) => (
          <div key={stage.label} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 flex-shrink-0"
              style={{ background: stage.color }}
            />
            <span
              className="text-[10px]"
              style={{ color: "var(--mc-text-muted)" }}
            >
              {stage.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
