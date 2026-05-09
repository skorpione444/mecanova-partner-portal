"use client";

import { useEffect, useState, useCallback, useMemo, use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_TO_CATEGORY,
  DOCUMENT_AUDIENCES,
  DOCUMENT_AUDIENCE_LABELS,
} from "@mecanova/shared";
import type {
  DocumentCategory,
  Document,
  Partner,
  Product,
} from "@mecanova/shared";
import UploadDialog from "../_components/UploadDialog";
import DocumentTable, {
  type DocRowEnriched,
  deriveStatus,
} from "../_components/DocumentTable";
import {
  FileText,
  Plus,
  Search,
  ChevronLeft,
  Scale,
  FileSignature,
  TrendingUp,
  Truck,
  Megaphone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const CATEGORY_ICONS: Record<DocumentCategory, LucideIcon> = {
  legal: Scale,
  contracts: FileSignature,
  sales: TrendingUp,
  operations: Truck,
  marketing: Megaphone,
};

type StatusFilter = "all" | "active" | "draft" | "expiring" | "expired";

export default function CategoryDocumentsPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: rawCategory } = use(params);

  if (!DOCUMENT_CATEGORIES.includes(rawCategory as DocumentCategory)) {
    notFound();
  }
  const category = rawCategory as DocumentCategory;
  const Icon = CATEGORY_ICONS[category];

  const [documents, setDocuments] = useState<DocRowEnriched[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [audienceFilter, setAudienceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const supabase = createClient();

  const typesInCategory = useMemo(
    () => DOCUMENT_TYPES.filter((t) => DOCUMENT_TYPE_TO_CATEGORY[t] === category),
    [category]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [docsRes, partnersRes, productsRes] = await Promise.all([
      supabase
        .from("documents")
        .select("*")
        .eq("category", category)
        .order("created_at", { ascending: false }),
      supabase.from("partners").select("id, name").order("name"),
      supabase.from("products").select("id, name").order("name"),
    ]);

    const docs = (docsRes.data || []) as Document[];
    const allPartners = (partnersRes.data || []) as Partner[];
    const allProducts = (productsRes.data || []) as Product[];

    setPartners(allPartners);
    setProducts(allProducts);

    const partnerMap = new Map(allPartners.map((p) => [p.id, p.name]));
    const productMap = new Map(allProducts.map((p) => [p.id, p.name]));

    const enriched = await Promise.all(
      docs.map(async (d) => {
        let download_url: string | null = null;
        if (d.file_path) {
          const { data: signedData } = await supabase.storage
            .from("documents")
            .createSignedUrl(d.file_path, 3600);
          download_url = signedData?.signedUrl || null;
        }
        return {
          ...d,
          partner_name: d.partner_id ? partnerMap.get(d.partner_id) || null : null,
          product_name: d.product_id ? productMap.get(d.product_id) || null : null,
          download_url,
        };
      })
    );

    setDocuments(enriched);
    setLoading(false);
  }, [supabase, category]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (docId: string, filePath: string) => {
    if (!confirm("Delete this document?")) return;
    await supabase.storage.from("documents").remove([filePath]);
    await supabase.from("documents").delete().eq("id", docId);
    load();
  };

  const toggleShared = async (docId: string, current: boolean) => {
    await supabase.from("documents").update({ is_shared: !current }).eq("id", docId);
    load();
  };

  const toggleHighlight = async (docId: string, current: boolean) => {
    await supabase.from("documents").update({ is_highlight: !current }).eq("id", docId);
    load();
  };

  const filtered = documents.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      (d.counterparty || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.partner_name || "").toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || d.type === typeFilter;
    const matchesAudience =
      audienceFilter === "all" || d.audience === audienceFilter;
    const derived = deriveStatus(d);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "expiring" && derived === "expiring_soon") ||
      derived === statusFilter;
    return matchesSearch && matchesType && matchesAudience && matchesStatus;
  });

  const showCounterparty = category === "legal" || category === "contracts";

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
      <Link
        href="/documents"
        className="inline-flex items-center gap-1 text-[11px] mb-4 transition-colors"
        style={{ color: "var(--mc-text-muted)" }}
      >
        <ChevronLeft className="w-3 h-3" />
        All categories
      </Link>

      <PageHeader
        title={DOCUMENT_CATEGORY_LABELS[category]}
        description={`${documents.length} ${documents.length === 1 ? "document" : "documents"}`}
        icon={Icon}
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
          defaultCategory={category}
          partners={partners}
          products={products}
          onUploaded={() => {
            setShowUpload(false);
            load();
          }}
          onCancel={() => setShowUpload(false)}
        />
      )}

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
            placeholder="Search title, counterparty, partner..."
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="mc-input mc-select w-auto min-w-[150px]"
        >
          <option value="all">All Types</option>
          {typesInCategory.map((t) => (
            <option key={t} value={t}>
              {DOCUMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="mc-input mc-select w-auto min-w-[140px]"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="expiring">Expiring</option>
          <option value="expired">Expired</option>
          <option value="draft">Draft</option>
        </select>
        <select
          value={audienceFilter}
          onChange={(e) => setAudienceFilter(e.target.value)}
          className="mc-input mc-select w-auto min-w-[150px]"
        >
          <option value="all">All Audiences</option>
          {DOCUMENT_AUDIENCES.map((a) => (
            <option key={a} value={a}>
              {DOCUMENT_AUDIENCE_LABELS[a]}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Icon}
          title="No documents found"
          description={
            search || typeFilter !== "all" || statusFilter !== "all" || audienceFilter !== "all"
              ? "Try adjusting your filters"
              : `Upload your first ${DOCUMENT_CATEGORY_LABELS[category].toLowerCase()} document`
          }
        />
      ) : (
        <DocumentTable
          documents={filtered}
          onToggleShared={toggleShared}
          onToggleHighlight={toggleHighlight}
          onDelete={handleDelete}
          showCounterparty={showCounterparty}
        />
      )}
    </div>
  );
}
