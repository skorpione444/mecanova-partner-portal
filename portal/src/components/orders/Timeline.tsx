interface TimelineEvent {
  label: string;
  date: string | null;
}

export default function Timeline({ events }: { events: TimelineEvent[] }) {
  const filtered = events.filter((e) => e.date);

  if (filtered.length === 0) return null;

  return (
    <div className="space-y-2">
      {filtered.map((event, i) => (
        <div key={i} className="flex items-center gap-3 text-xs" style={{ color: "var(--mc-text-secondary)" }}>
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: i === filtered.length - 1 ? "var(--mc-success)" : "var(--mc-text-muted)" }}
          />
          <span style={{ color: "var(--mc-text-muted)" }}>{event.label}:</span>
          <span>{new Date(event.date!).toLocaleString("en-GB")}</span>
        </div>
      ))}
    </div>
  );
}
