import { Check, Clock, X as XIcon } from "lucide-react";

interface TimelineEvent {
  label: string;
  timestamp: string | null;
  status: string;
}

interface TimelineProps {
  events: TimelineEvent[];
  currentStatus: string;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString("de-DE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_COLORS: Record<string, string> = {
  created: "#7D7468",
  submitted: "#c4a35a",
  accepted: "#5a8ab0",
  fulfilled: "#6b8f6e",
  rejected: "#c45a5a",
  cancelled: "#5C5449",
};

export default function Timeline({ events, currentStatus }: TimelineProps) {
  const active = events.filter((e) => e.timestamp !== null);

  if (active.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-8"
        style={{ color: "#5C5449" }}
      >
        <Clock className="w-4 h-4 mr-2" strokeWidth={1.5} />
        <span className="text-xs tracking-wide uppercase">
          No timeline events yet
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-0 mc-stagger">
      {active.map((event, idx) => {
        const isCurrent = event.status === currentStatus;
        const isLast = idx === active.length - 1;
        const isNegative =
          event.status === "rejected" || event.status === "cancelled";
        const color = STATUS_COLORS[event.status] || "#7D7468";

        return (
          <div key={event.status} className="flex items-start group">
            {/* Timeline rail */}
            <div className="flex flex-col items-center mr-4 flex-shrink-0">
              <div
                className={`flex items-center justify-center transition-all duration-300 ${
                  isCurrent ? "w-6 h-6" : "w-4 h-4"
                }`}
                style={{
                  background: isCurrent ? color : "transparent",
                  border: isCurrent ? "none" : `1px solid ${color}`,
                }}
              >
                {isCurrent &&
                  (isNegative ? (
                    <XIcon
                      className="w-3 h-3"
                      strokeWidth={2.5}
                      style={{ color: "#111111" }}
                    />
                  ) : (
                    <Check
                      className="w-3 h-3"
                      strokeWidth={2.5}
                      style={{ color: "#111111" }}
                    />
                  ))}
              </div>
              {!isLast && (
                <div
                  className="w-px h-10 mt-1"
                  style={{ background: "#2A2A2A" }}
                />
              )}
            </div>

            {/* Content */}
            <div className="pb-5 pt-0.5">
              <p
                className={`text-sm ${
                  isCurrent ? "font-medium" : "font-normal"
                }`}
                style={{
                  color: isCurrent ? "#ecdfcc" : "#A89F91",
                  fontFamily: "var(--font-manrope), Manrope, sans-serif",
                }}
              >
                {event.label}
              </p>
              <p
                className="text-xs mt-0.5"
                style={{
                  color: "#5C5449",
                  fontFamily:
                    "var(--font-jetbrains), JetBrains Mono, monospace",
                  fontSize: "0.6875rem",
                }}
              >
                {formatTimestamp(event.timestamp!)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
