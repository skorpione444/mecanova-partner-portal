"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_CATEGORY_DESCRIPTIONS,
  DOCUMENT_TYPE_LABELS,
} from "@mecanova/shared";
import type {
  DocumentCategory,
  Document,
  Partner,
  Product,
} from "@mecanova/shared";
import UploadDialog from "./_components/UploadDialog";
import { deriveStatus } from "./_components/DocumentTable";
import {
  FileText,
  Plus,
  ArrowRight,
  Scale,
  FileSignature,
  TrendingUp,
  Truck,
  Megaphone,
  AlertTriangle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const CATEGORY_ICONS: Record<DocumentCategory, LucideIcon> = {
  legal: Scale,
  contracts: FileSignature,
  sales: TrendingUp,
  operations: Truck,
  marketing: Megaphone,
};

type DocSummary = Pick<Document, "id" | "category" | "expires_at" | "status">;
type RecentDoc = Pick<
  Document,
  "id" | "title" | "type" | "category" | "created_at" | "file_path"
> & { download_url: string | null };

export default function DocumentsPage() {
  const [summaries, setSummaries] = useState<DocSummary[]>([]);
  const [recent, setRecent] = useState<RecentDoc[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const [summaryRes, recentRes, partnersRes, productsRes] = await Promise.all([
      supabase.from("documents").select("id, category, expires_at, status"),
      supabase
        .from("documents")
        .select("id, title, type, category, created_at, file_path")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("partners").select("id, name").order("name"),
      supabase.from("products").select("id, name").order("name"),
    ]);

    setSummaries((summaryRes.data || []) as DocSummary[]);
    setPartners((partnersRes.data || []) as Partner[]);
    setProducts((productsRes.data || []) as Product[]);

    const recentRaw = (recentRes.data || []) as Omit<RecentDoc, "download_url">[];
    const enriched = await Promise.all(
      recentRaw.map(async (d) => {
        const { data } = await supabase.storage
          .from("documents")
          .createSignedUrl(d.file_path, 3600);
        return { ...d, download_url: data?.signedUrl || null };
      })
    );
    setRecent(enriched);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const out: Record<
      DocumentCategory,
      { total: number; expiring: number; expired: number }
    > = {
      legal: { total: 0, expiring: 0, expired: 0 },
      contracts: { total: 0, expiring: 0, expired: 0 },
      sales: { total: 0, expiring: 0, expired: 0 },
      operations: { total: 0, expiring: 0, expired: 0 },
      marketing: { total: 0, expiring: 0, expired: 0 },
    };
    for (const d of summaries) {
      out[d.category].total += 1;
      const derived = deriveStatus(d);
      if (derived === "expiring_soon") out[d.category].expiring += 1;
      if (derived === "expired") out[d.category].expired += 1;
    }
    return out;
  }, [summaries]);

  if (loading) {
    return (
      <div>
        <div className="mc-skeleton h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="mc-skeleton h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Documents"
        description={`${summaries.length} documents across ${DOCUMENT_CATEGORIES.length} categories`}
        icon={FileText}
        actions={
          <button
            onClick={() => setShowUpload((v) => !v)}
            className="mc-btn mc-btn-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            Upload Document
          </button>
        }
      />

      {showUpload && (
        <UploadDialog
          partners={partners}
          products={products}
          onUploaded={() => {
            setShowUpload(false);
            load();
          }}
          onCancel={() => setShowUpload(false)}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {DOCUMENT_CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat];
          const s = stats[cat];
          return (
            <Link
              key={cat}
              href={`/documents/${cat}`}
              className="mc-card p-5 transition-colors hover:!border-[var(--mc-cream-subtle)] group"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="flex items-center justify-center w-9 h-9"
                  style={{
                    background: "color-mix(in srgb, var(--mc-cream) 8%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--mc-cream) 15%, transparent)",
                  }}
                >
                  <Icon className="w-4 h-4" style={{ color: "var(--mc-cream)" }} />
                </div>
                <ArrowRight
                  className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                  style={{ color: "var(--mc-text-muted)" }}
                />
              </div>
              <div
                className="text-sm font-semibold mb-1"
                style={{ color: "var(--mc-text-primary)" }}
              >
                {DOCUMENT_CATEGORY_LABELS[cat]}
              </div>
              <div
                className="text-[11px] mb-4"
                style={{ color: "var(--mc-text-muted)" }}
              >
                {DOCUMENT_CATEGORY_DESCRIPTIONS[cat]}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--mc-text-secondary)" }}
                >
                  {s.total} {s.total === 1 ? "document" : "documents"}
                </span>
                {s.expiring > 0 && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
                    style={{
                      background: "color-mix(in srgb, var(--mc-warning) 10%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--mc-warning) 25%, transparent)",
                      color: "var(--mc-warning)",
                    }}
                  >
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {s.expiring} expiring
                  </span>
                )}
                {s.expired > 0 && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
                    style={{
                      background: "color-mix(in srgb, var(--mc-error) 10%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--mc-error) 25%, transparent)",
                      color: "var(--mc-error)",
                    }}
                  >
                    {s.expired} expired
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <div>
        <h3
          className="text-xs font-semibold tracking-[0.08em] uppercase mb-3"
          style={{ color: "var(--mc-text-muted)" }}
        >
          Recent uploads
        </h3>
        {recent.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description="Upload your first document to get started"
          />
        ) : (
          <div className="mc-card overflow-hidden">
            <table className="mc-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Uploaded</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recent.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <span
                        className="text-xs font-medium"
                        style={{ color: "var(--mc-text-primary)" }}
                      >
                        {d.title}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/documents/${d.category}`}
                        className="text-[10px] font-medium tracking-wide uppercase transition-colors"
                        style={{ color: "var(--mc-cream-subtle)" }}
                      >
                        {DOCUMENT_CATEGORY_LABELS[d.category]}
                      </Link>
                    </td>
                    <td>
                      <span
                        className="text-[10px] font-medium tracking-wide uppercase"
                        style={{ color: "var(--mc-text-tertiary)" }}
                      >
                        {DOCUMENT_TYPE_LABELS[d.type] || d.type}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
                        {new Date(d.created_at).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </td>
                    <td>
                      {d.download_url && (
                        <a
                          href={d.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px]"
                          style={{ color: "var(--mc-cream-subtle)" }}
                        >
                          Open
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
