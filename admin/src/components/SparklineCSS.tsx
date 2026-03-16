interface SparklineCSSProps {
  readonly data: number[];
  readonly color?: string;
  readonly height?: number;
}

export default function SparklineCSS({
  data,
  color = "var(--mc-cream-subtle)",
  height = 32,
}: SparklineCSSProps) {
  if (data.length === 0) {
    return (
      <div
        className="w-full"
        style={{ height, background: "var(--mc-surface-warm)" }}
      />
    );
  }

  const max = Math.max(...data, 1);

  if (data.length === 1) {
    return (
      <div className="flex items-end gap-px" style={{ height }}>
        <div
          className="flex-1"
          style={{
            height: `${(data[0] / max) * 100}%`,
            background: color,
            minHeight: 2,
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-end gap-px" style={{ height }}>
      {data.map((value, i) => (
        <div
          key={i}
          className="flex-1 transition-all duration-300"
          style={{
            height: `${(value / max) * 100}%`,
            background: color,
            minHeight: 2,
            opacity: 0.5 + (i / (data.length - 1)) * 0.5,
          }}
        />
      ))}
    </div>
  );
}
