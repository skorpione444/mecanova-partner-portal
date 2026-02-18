"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import type { Document as DocRow, Partner, Product } from "@mecanova/shared";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from "@mecanova/shared";
import type { DocumentType } from "@mecanova/shared";
import {
  FileText,
  Search,
  Plus,
  Upload,
  ExternalLink,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";

type DocRowEnriched = DocRow & {
  partner_name: string | null;
  product_name: string | null;
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocRowEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showUpload, setShowUpload] = useState(false);

  // Upload form state
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<DocumentType>("compliance");
  const [partnerId, setPartnerId] = useState("");
  const [productId, setProductId] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [partners, setPartners] = useState<Partner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const supabase = createClient();

  const loadDocuments = useCallback(async () => {
    setLoading(true);

    const [docsRes, partnersRes, productsRes] = await Promise.all([
      supabase.from("documents").select("*").order("created_at", { ascending: false }),
      supabase.from("partners").select("id, name").order("name"),
      supabase.from("products").select("id, name").order("name"),
    ]);

    const docs = docsRes.data || [];
    const allPartners = partnersRes.data || [];
    const allProducts = productsRes.data || [];

    setPartners(allPartners as Partner[]);
    setProducts(allProducts as Product[]);

    const partnerMap = new Map(allPartners.map((p) => [p.id, p.name]));
    const productMap = new Map(allProducts.map((p) => [p.id, p.name]));

    setDocuments(
      docs.map((d) => ({
        ...d,
        partner_name: d.partner_id ? partnerMap.get(d.partner_id) || null : null,
        product_name: d.product_id ? productMap.get(d.product_id) || null : null,
      }))
    );

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async () => {
    if (!file || !title.trim()) return;
    setUploading(true);
    setUploadError(null);

    // Upload to Supabase Storage
    const ext = file.name.split(".").pop() || "pdf";
    const path = `documents/${Date.now()}_${title.replace(/\s+/g, "_")}.${ext}`;

    const { error: storageError } = await supabase.storage
      .from("documents")
      .upload(path, file);

    if (storageError) {
      setUploadError(storageError.message);
      setUploading(false);
      return;
    }

    // Create document record
    const { error: insertError } = await supabase.from("documents").insert({
      title: title.trim(),
      type: docType,
      file_path: path,
      partner_id: partnerId || null,
      product_id: productId || null,
      is_shared: isShared,
    });

    if (insertError) {
      setUploadError(insertError.message);
      setUploading(false);
      return;
    }

    // Reset form
    setTitle("");
    setDocType("compliance");
    setPartnerId("");
    setProductId("");
    setIsShared(false);
    setFile(null);
    setShowUpload(false);
    setUploading(false);
    loadDocuments();
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Delete this document?")) return;
    await supabase.from("documents").delete().eq("id", docId);
    loadDocuments();
  };

  const toggleShared = async (docId: string, currentShared: boolean) => {
    await supabase
      .from("documents")
      .update({ is_shared: !currentShared })
      .eq("id", docId);
    loadDocuments();
  };

  const filtered = documents.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      (d.partner_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.product_name || "").toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || d.type === typeFilter;
    return matchesSearch && matchesType;
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
        description={`${documents.length} documents`}
        icon={FileText}
        actions={
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="mc-btn mc-btn-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            Upload Document
          </button>
        }
      />

      {/* Upload form */}
      {showUpload && (
        <div className="mc-card p-5 mb-5 mc-animate-fade">
          <h3
            className="text-xs font-semibold tracking-[0.08em] uppercase mb-4"
            style={{ color: "var(--mc-text-muted)" }}
          >
            Upload New Document
          </h3>
          {uploadError && (
            <div
              className="mb-4 px-3 py-2 text-xs"
              style={{
                background: "var(--mc-error-bg)",
                border: "1px solid var(--mc-error-light)",
                color: "var(--mc-error)",
              }}
            >
              {uploadError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="mc-label">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mc-input"
                placeholder="Document title"
              />
            </div>
            <div>
              <label className="mc-label">Type *</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocumentType)}
                className="mc-input mc-select"
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {DOCUMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mc-label">File *</label>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="mc-input text-xs"
              />
            </div>
            <div>
              <label className="mc-label">Partner (optional)</label>
              <select
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                className="mc-input mc-select"
              >
                <option value="">None</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mc-label">Product (optional)</label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="mc-input mc-select"
              >
                <option value="">None</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isShared}
                  onChange={(e) => setIsShared(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-xs" style={{ color: "var(--mc-text-secondary)" }}>
                  Shared with partners
                </span>
              </label>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleUpload}
              disabled={uploading || !title.trim() || !file}
              className="mc-btn mc-btn-primary"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading ? "Uploading..." : "Upload"}
            </button>
            <button
              onClick={() => setShowUpload(false)}
              className="mc-btn mc-btn-ghost"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
            placeholder="Search documents..."
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="mc-input mc-select w-auto min-w-[150px]"
        >
          <option value="all">All Types</option>
          {DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {DOCUMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents found"
          description={
            search || typeFilter !== "all"
              ? "Try adjusting your filters"
              : "Upload your first document"
          }
        />
      ) : (
        <div className="mc-card overflow-hidden">
          <table className="mc-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Partner</th>
                <th>Product</th>
                <th>Shared</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
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
                      className="text-xs"
                      style={{ color: "var(--mc-text-muted)" }}
                    >
                      {doc.partner_name || "—"}
                    </span>
                  </td>
                  <td>
                    <span
                      className="text-xs"
                      style={{ color: "var(--mc-text-muted)" }}
                    >
                      {doc.product_name || "—"}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => toggleShared(doc.id, doc.is_shared)}
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
                  </td>
                  <td>
                    {new Date(doc.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <a
                        href={doc.file_path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] transition-colors"
                        style={{ color: "var(--mc-cream-subtle)" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = "var(--mc-cream)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color =
                            "var(--mc-cream-subtle)")
                        }
                        title="Download"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="text-[11px] transition-colors"
                        style={{ color: "var(--mc-text-muted)" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = "var(--mc-error)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color =
                            "var(--mc-text-muted)")
                        }
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}



