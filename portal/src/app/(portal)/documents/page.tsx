"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
} from "@mecanova/shared";
import type { UserRole } from "@mecanova/shared";
import {
  FileText,
  Search,
  Download,
  ExternalLink,
  Lock,
  Star,
  Package,
} from "lucide-react";

interface DocVisible {
  id: string;
  title: string;
  type: string;
  audience: string;
  is_highlight: boolean;
  product_id: string | null;
  product_name: string | null;
  file_path: string;
  created_at: string;
  download_url: string | null;
  access: "full" | "preview";
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocVisible[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [accessFilter, setAccessFilter] = useState<string>("all");
  const [role, setRole] = useState<UserRole | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const supabase = createClient();

  const loadDocuments = useCallback(async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, partner_id")
      .eq("user_id", user.id)
      .single();

    if (!profile) return;

    const userRole = profile.role as UserRole;
    const userPartnerId = profile.partner_id;
    setRole(userRole);

    const { data: docs } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (!docs) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    const productIds = [...new Set(docs.map((d) => d.product_id).filter(Boolean))] as string[];
    let productMap = new Map<string, string>();
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from("products")
        .select("id, name")
        .in("id", productIds);
      productMap = new Map((products || []).map((p) => [p.id, p.name]));
    }

    let assignedProductIds = new Set<string>();
    if (userRole === "distributor" && userPartnerId) {
      const { data: inv } = await supabase
        .from("inventory_status")
        .select("product_id")
        .eq("distributor_id", userPartnerId);
      assignedProductIds = new Set((inv || []).map((i) => i.product_id));
    } else if (userRole === "client" && userPartnerId) {
      const { data: cd } = await supabase
        .from("client_distributors")
        .select("distributor_id")
        .eq("client_id", userPartnerId);
      const distIds = (cd || []).map((c) => c.distributor_id);
      if (distIds.length > 0) {
        const { data: inv } = await supabase
          .from("inventory_status")
          .select("product_id")
          .in("distributor_id", distIds);
        assignedProductIds = new Set((inv || []).map((i) => i.product_id));
      }
    }

    const enriched: DocVisible[] = [];
    for (const doc of docs) {
      let access: "full" | "preview" = "preview";

      if (userRole === "distributor") {
        if (doc.audience === "all" || doc.audience === "distributor") {
          if (!doc.product_id || assignedProductIds.has(doc.product_id)) {
            access = "full";
          } else {
            access = "preview";
          }
        } else if (doc.is_highlight) {
          access = "preview";
        } else {
          continue;
        }
      } else if (userRole === "client") {
        if (doc.audience === "all" || doc.audience === "client") {
          if (!doc.product_id || assignedProductIds.has(doc.product_id)) {
            access = "full";
          } else {
            access = "preview";
          }
        } else if (doc.is_highlight) {
          access = "preview";
        } else {
          continue;
        }
      }

      let download_url: string | null = null;
      if (access === "full" && doc.file_path) {
        const { data: signedData } = await supabase.storage
          .from("documents")
          .createSignedUrl(doc.file_path, 3600);
        download_url = signedData?.signedUrl || null;
      }

      enriched.push({
        id: doc.id,
        title: doc.title,
        type: doc.type,
        audience: doc.audience,
        is_highlight: doc.is_highlight,
        product_id: doc.product_id,
        product_name: doc.product_id ? productMap.get(doc.product_id) || null : null,
        file_path: doc.file_path,
        created_at: doc.created_at,
        download_url,
        access,
      });
    }

    setDocuments(enriched);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleDownload = async (doc: DocVisible) => {
    if (!doc.file_path) return;
    setDownloading(doc.id);
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .download(doc.file_path);
      if (error || !data) {
        alert("Download failed. Please try again.");
        setDownloading(null);
        return;
      }
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      const ext = doc.file_path.split(".").pop() || "pdf";
      a.download = `${doc.title}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Download failed. Please try again.");
    }
    setDownloading(null);
  };

  const availableTypes = [...new Set(documents.map((d) => d.type))];

  const filtered = documents.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      (d.product_name || "").toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || d.type === typeFilter;
    const matchesAccess = accessFilter === "all" || d.access === accessFilter;
    return matchesSearch && matchesType && matchesAccess;
  });

  if (loading) {
    return (
      <div>
        <div className="mc-skeleton h-8 w-48 mb-6" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="mc-skeleton h-14" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Documents"
        description={`${documents.length} documents available${role === "client" ? " · Contact your distributor for additional materials" : ""}`}
        icon={FileText}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: "var(--mc-text-muted)" }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mc-input pl-9"
            placeholder="Search by title or product..."
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="mc-input mc-select w-auto min-w-[160px]"
        >
          <option value="all">All Types</option>
          {DOCUMENT_TYPES.filter((t) => availableTypes.includes(t)).map((t) => (
            <option key={t} value={t}>
              {DOCUMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={accessFilter}
          onChange={(e) => setAccessFilter(e.target.value)}
          className="mc-input mc-select w-auto min-w-[140px]"
        >
          <option value="all">All Access</option>
          <option value="full">Full Access</option>
          <option value="preview">Preview Only</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents found"
          description={
            search || typeFilter !== "all" || accessFilter !== "all"
              ? "Try adjusting your filters"
              : "No documents have been shared with you yet"
          }
        />
      ) : (
        <div className="grid gap-3 mc-stagger">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="mc-card p-4 flex items-center gap-4"
              style={{ opacity: doc.access === "preview" ? 0.7 : 1 }}
            >
              {/* Icon */}
              <div
                className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                style={{
                  background: doc.access === "full"
                    ? "rgba(107, 143, 110, 0.08)"
                    : "rgba(196, 163, 90, 0.08)",
                  border: `1px solid ${doc.access === "full" ? "var(--mc-success-light)" : "var(--mc-warning-light)"}`,
                }}
              >
                <FileText
                  className="w-5 h-5"
                  style={{ color: doc.access === "full" ? "var(--mc-success)" : "var(--mc-warning)" }}
                  strokeWidth={1.5}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: "var(--mc-text-primary)" }}
                  >
                    {doc.title}
                  </span>
                  {doc.is_highlight && (
                    <Star className="w-3 h-3 flex-shrink-0" style={{ color: "var(--mc-warning)" }} fill="currentColor" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span
                    className="inline-flex px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase"
                    style={{
                      background: "rgba(236, 223, 204, 0.06)",
                      border: "1px solid var(--mc-border)",
                      color: "var(--mc-text-tertiary)",
                    }}
                  >
                    {DOCUMENT_TYPE_LABELS[doc.type] || doc.type}
                  </span>
                  {doc.product_name && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        background: "var(--mc-info-bg)",
                        border: "1px solid var(--mc-info-light)",
                        color: "var(--mc-info)",
                      }}
                    >
                      <Package className="w-2.5 h-2.5" />
                      {doc.product_name}
                    </span>
                  )}
                  <span className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
                    {new Date(doc.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {doc.access === "full" ? (
                  <>
                    <button
                      onClick={() => handleDownload(doc)}
                      disabled={downloading === doc.id}
                      className="mc-btn mc-btn-ghost text-xs py-1.5 px-3"
                      title="Download file"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {downloading === doc.id ? "..." : "Download"}
                    </button>
                    {doc.download_url && (
                      <a
                        href={doc.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 transition-colors"
                        style={{ color: "var(--mc-text-muted)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-text-muted)")}
                        title="Open in new tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </>
                ) : (
                  <span
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5"
                    style={{
                      color: "var(--mc-warning)",
                      background: "var(--mc-warning-bg)",
                      border: "1px solid var(--mc-warning-light)",
                    }}
                  >
                    <Lock className="w-3 h-3" />
                    Preview
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
