"use client";

import { Phone, Mail, Users, FileText, Paperclip, Download, Trash2 } from "lucide-react";
import type { CRMInteraction, CRMInteractionType } from "@mecanova/shared";

interface InteractionLogProps {
  interactions: CRMInteraction[];
  onDelete?: (id: string) => Promise<void>;
}

const TYPE_CONFIG: Record<
  CRMInteractionType,
  { icon: React.ElementType; color: string; label: string }
> = {
  call: { icon: Phone, color: "var(--mc-success)", label: "Call" },
  email: { icon: Mail, color: "var(--mc-info)", label: "Email" },
  meeting: { icon: Users, color: "var(--mc-warning)", label: "Meeting" },
  note: { icon: FileText, color: "var(--mc-text-muted)", label: "Note" },
  file: { icon: Paperclip, color: "var(--mc-cream-dark)", label: "File" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

async function downloadFile(filePath: string, fileName: string) {
  try {
    const res = await fetch(`/api/crm/files?path=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    if (data.url) {
      const a = document.createElement("a");
      a.href = data.url;
      a.download = fileName;
      a.target = "_blank";
      a.click();
    }
  } catch {
    // Silently fail — user will see nothing happened
  }
}

export default function InteractionLog({ interactions, onDelete }: InteractionLogProps) {
  if (interactions.length === 0) {
    return (
      <div
        style={{
          padding: "24px 0",
          textAlign: "center",
          color: "var(--mc-text-muted)",
          fontSize: "0.8125rem",
        }}
      >
        No interactions logged yet.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {interactions.map((item, index) => {
        const config = TYPE_CONFIG[item.interaction_type];
        const Icon = config.icon;
        const isLast = index === interactions.length - 1;

        return (
          <div key={item.id} style={{ display: "flex", gap: 12, position: "relative" }}>
            {/* Timeline line */}
            {!isLast && (
              <div
                style={{
                  position: "absolute",
                  left: 15,
                  top: 30,
                  bottom: 0,
                  width: 1,
                  background: "var(--mc-border)",
                }}
              />
            )}

            {/* Icon */}
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "var(--mc-graphite)",
                border: `1px solid var(--mc-border)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                zIndex: 1,
              }}
            >
              <Icon style={{ width: 12, height: 12, color: config.color }} strokeWidth={1.5} />
            </div>

            {/* Content */}
            <div style={{ flex: 1, paddingBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--mc-text-primary)", flex: 1 }}>
                  {item.summary}
                </span>
                <span
                  style={{
                    fontSize: "0.6rem",
                    color: "var(--mc-text-muted)",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    flexShrink: 0,
                  }}
                >
                  {config.label}
                </span>
                {onDelete && (
                  <button
                    onClick={() => onDelete(item.id)}
                    title="Delete interaction"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--mc-text-muted)",
                      padding: 2,
                      lineHeight: 0,
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-error)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-text-muted)")}
                  >
                    <Trash2 style={{ width: 11, height: 11 }} strokeWidth={1.5} />
                  </button>
                )}
              </div>

              {item.body && (
                <p style={{ fontSize: "0.75rem", color: "var(--mc-text-tertiary)", margin: "4px 0", lineHeight: 1.5 }}>
                  {item.body}
                </p>
              )}

              {/* Downloadable file attachment */}
              {item.file_name && item.file_path && (
                <button
                  onClick={() => downloadFile(item.file_path!, item.file_name!)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    marginTop: 5,
                    padding: "3px 9px",
                    background: "var(--mc-graphite)",
                    border: "1px solid var(--mc-border)",
                    fontSize: "0.6875rem",
                    color: "var(--mc-info)",
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--mc-info)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--mc-border)")}
                >
                  <Download style={{ width: 10, height: 10 }} strokeWidth={1.5} />
                  {item.file_name}
                </button>
              )}

              <p style={{ fontSize: "0.6rem", color: "var(--mc-text-muted)", marginTop: 5, letterSpacing: "0.05em" }}>
                {formatDate(item.occurred_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
