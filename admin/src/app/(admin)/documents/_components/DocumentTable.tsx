"use client";

import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_AUDIENCE_LABELS,
} from "@mecanova/shared";
import type { Document, DocumentAudience } from "@mecanova/shared";
import {
  ExternalLink,
  Trash2,
  Eye,
  EyeOff,
  Star,
  Shield,
  AlertTriangle,
} from "lucide-react";

export type DocRowEnriched = Document & {
  partner_name: string | null;
  product_name: string | null;
  download_url: string | null;
};

const AUDIENCE_COLORS: Record<DocumentAudience, string> = {
  all: "var(--mc-success)",
  distributor: "var(--mc-info)",
  client: "var(--mc-warning)",
  internal: "var(--mc-error)",
};

export type DerivedStatus = "active" | "draft" | "expiring_soon" | "expired";

const STATUS_COLORS: Record<DerivedStatus, string> = {
  active: "var(--mc-success)",
  draft: "var(--mc-text-muted)",
  expiring_soon: "var(--mc-warning)",
  expired: "var(--mc-error)",
};

const STATUS_LABELS: Record<DerivedStatus, string> = {
  active: "Active",
  draft: "Draft",
  expiring_soon: "Expiring",
  expired: "Expired",
};

/** Resolve the displayed status by combining stored status with expires_at. */
export function deriveStatus(doc: Pick<Document, "status" | "expires_at">): DerivedStatus {
  if (doc.status === "draft") return "draft";
  if (!doc.expires_at) return "active";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(doc.expires_at);
  if (expiry < today) return "expired";
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 60);
  if (expiry <= soon) return "expiring_soon";
  return "active";
}

function formatExpiry(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type Props = {
  documents: DocRowEnriched[];
  onToggleShared: (id: string, current: boolean) => void;
  onToggleHighlight: (id: string, current: boolean) => void;
  onDelete: (id: string, filePath: string) => void;
  showCounterparty?: boolean;
};

export default function DocumentTable({
  documents,
  onToggleShared,
  onToggleHighlight,
  onDelete,
  showCounterparty = false,
}: Props) {
  return (
    <div className="mc-card overflow-hidden">
      <table className="mc-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Type</th>
            <th>Audience</th>
            {showCounterparty && <th>Counterparty</th>}
            <th>Partner</th>
            <th>Expires</th>
            <th>Status</th>
            <th>Flags</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const derived = deriveStatus(doc);
            const expiryColor =
              derived === "expired"
                ? "var(--mc-error)"
                : derived === "expiring_soon"
                  ? "var(--mc-warning)"
                  : "var(--mc-text-muted)";
            return (
              <tr key={doc.id}>
                <td>
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--mc-text-primary)" }}
                  >
                    {doc.title}
                  </span>
                </td>
                <td>
                  <span
                    className="text-[10px] font-medium tracking-wide uppercase"
                    style={{ color: "var(--mc-text-tertiary)" }}
                  >
                    {DOCUMENT_TYPE_LABELS[doc.type] || doc.type}
                  </span>
                </td>
                <td>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
                    style={{
                      background: `color-mix(in srgb, ${AUDIENCE_COLORS[doc.audience]} 10%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${AUDIENCE_COLORS[doc.audience]} 25%, transparent)`,
                      color: AUDIENCE_COLORS[doc.audience],
                    }}
                  >
                    <Shield className="w-2.5 h-2.5" />
                    {DOCUMENT_AUDIENCE_LABELS[doc.audience]}
                  </span>
                </td>
                {showCounterparty && (
                  <td>
                    <span className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
                      {doc.counterparty || "—"}
                    </span>
                  </td>
                )}
                <td>
                  <span className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
                    {doc.partner_name || "—"}
                  </span>
                </td>
                <td>
                  <span
                    className="inline-flex items-center gap-1 text-xs"
                    style={{ color: expiryColor }}
                  >
                    {derived === "expired" || derived === "expiring_soon" ? (
                      <AlertTriangle className="w-3 h-3" />
                    ) : null}
                    {formatExpiry(doc.expires_at)}
                  </span>
                </td>
                <td>
                  <span
                    className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
                    style={{
                      background: `color-mix(in srgb, ${STATUS_COLORS[derived]} 10%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${STATUS_COLORS[derived]} 25%, transparent)`,
                      color: STATUS_COLORS[derived],
                    }}
                  >
                    {STATUS_LABELS[derived]}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleShared(doc.id, doc.is_shared)}
                      className="inline-flex items-center gap-1 text-[10px] transition-colors"
                      style={{
                        color: doc.is_shared
                          ? "var(--mc-success)"
                          : "var(--mc-text-muted)",
                      }}
                      title={doc.is_shared ? "Visible to partners" : "Admin only"}
                    >
                      {doc.is_shared ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => onToggleHighlight(doc.id, doc.is_highlight)}
                      className="inline-flex items-center gap-1 text-[10px] transition-colors"
                      style={{
                        color: doc.is_highlight
                          ? "var(--mc-warning)"
                          : "var(--mc-text-muted)",
                      }}
                      title={doc.is_highlight ? "Portfolio highlight" : "Not highlighted"}
                    >
                      <Star
                        className="w-3.5 h-3.5"
                        fill={doc.is_highlight ? "currentColor" : "none"}
                      />
                    </button>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    {doc.download_url && (
                      <a
                        href={doc.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] transition-colors"
                        style={{ color: "var(--mc-cream-subtle)" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = "var(--mc-cream)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = "var(--mc-cream-subtle)")
                        }
                        title="Download"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => onDelete(doc.id, doc.file_path)}
                      className="text-[11px] transition-colors"
                      style={{ color: "var(--mc-text-muted)" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "var(--mc-error)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "var(--mc-text-muted)")
                      }
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
