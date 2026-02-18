import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
  readonly action?: React.ReactNode;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 mc-card">
      <div
        className="w-12 h-12 flex items-center justify-center mb-4"
        style={{
          background: "rgba(236, 223, 204, 0.06)",
          border: "1px solid var(--mc-border)",
        }}
      >
        <Icon
          className="w-6 h-6"
          style={{ color: "var(--mc-cream-subtle)" }}
          strokeWidth={1.5}
        />
      </div>
      <h3
        className="text-sm font-medium mb-1"
        style={{ color: "var(--mc-text-secondary)" }}
      >
        {title}
      </h3>
      <p
        className="text-xs text-center max-w-xs mb-4"
        style={{ color: "var(--mc-text-muted)" }}
      >
        {description}
      </p>
      {action}
    </div>
  );
}



