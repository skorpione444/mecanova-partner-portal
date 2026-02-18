import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  readonly title: string;
  readonly description?: string;
  readonly icon?: LucideIcon;
  readonly actions?: React.ReactNode;
}

export default function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <div
            className="w-9 h-9 flex items-center justify-center"
            style={{
              background: "rgba(236, 223, 204, 0.06)",
              border: "1px solid var(--mc-border)",
            }}
          >
            <Icon
              className="w-[18px] h-[18px]"
              style={{ color: "var(--mc-cream)" }}
              strokeWidth={1.5}
            />
          </div>
        )}
        <div>
          <h1
            className="text-lg font-medium"
            style={{
              fontFamily: "var(--font-jost), Jost, sans-serif",
              color: "var(--mc-text-primary)",
            }}
          >
            {title}
          </h1>
          {description && (
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--mc-text-tertiary)" }}
            >
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}



