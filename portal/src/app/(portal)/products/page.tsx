"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { PRODUCT_CATEGORIES, DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES } from "@mecanova/shared";
import type { UserRole } from "@mecanova/shared";
import {
  Package,
  Search,
  ExternalLink,
  Lock,
  FileText,
  ChevronDown,
  ChevronUp,
  Download,
  Star,
} from "lucide-react";

interface ProductVisible {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  abv: number | null;
  size_ml: number | null;
  sku: string | null;
  description: string | null;
  access: "full" | "preview";
  assets: {
    id: string;
    title: string;
    type: string;
    file_path: string;
    download_url: string | null;
    access: "full" | "preview";
  }[];
}

interface DocItem {
  id: string;
  title: string;
  type: string;
  product_name: string | null;
  created_at: string;
  file_path: string;
  access: "full" | "preview";
  is_highlight: boolean;
  download_url: string | null;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductVisible[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [accessFilter, setAccessFilter] = useState<string>("all");
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);

  // Documents tab state
  const [pageTab, setPageTab] = useState<"catalogue" | "documents">("catalogue");
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [docSearch, setDocSearch] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState<string>("all");
  const [downloading, setDownloading] = useState<string | null>(null);

  const supabase = createClient();

  const loadProducts = useCallback(async () => {
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

    const { data: allProducts } = await supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .order("name");

    if (!allProducts) {
      setProducts([]);
      setLoading(false);
      return;
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

    // Load ALL documents (both product-linked and general)
    const { data: allDocs } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });

    // Build product name map
    const productNameMap = new Map<string, string>();
    for (const p of allProducts) {
      productNameMap.set(p.id, p.name);
    }

    // Build product-linked docs map for product assets
    const docsByProduct = new Map<string, typeof allDocs>();
    for (const doc of allDocs || []) {
      if (!doc.product_id) continue;
      const existing = docsByProduct.get(doc.product_id) || [];
      existing.push(doc);
      docsByProduct.set(doc.product_id, existing);
    }

    // Build the documents list for the Documents tab
    const docItems: DocItem[] = [];
    for (const doc of allDocs || []) {
      if (doc.audience === "internal") continue;
      if (userRole === "client" && doc.audience === "distributor") continue;

      let access: "full" | "preview" = "preview";
      if (userRole === "distributor") {
        if (doc.audience === "all" || doc.audience === "distributor") {
          if (!doc.product_id || assignedProductIds.has(doc.product_id)) {
            access = "full";
          }
        } else if (!doc.is_highlight) {
          continue;
        }
      } else if (userRole === "client") {
        if (doc.audience === "all" || doc.audience === "client") {
          if (!doc.product_id || assignedProductIds.has(doc.product_id)) {
            access = "full";
          }
        } else if (!doc.is_highlight) {
          continue;
        }
      }

      docItems.push({
        id: doc.id,
        title: doc.title,
        type: doc.type,
        product_name: doc.product_id ? productNameMap.get(doc.product_id) || null : null,
        created_at: doc.created_at,
        file_path: doc.file_path,
        access,
        is_highlight: doc.is_highlight,
        download_url: null,
      });
    }
    setDocuments(docItems);

    // Build product cards
    const enriched: ProductVisible[] = [];
    for (const product of allProducts) {
      const hasFullAccess = assignedProductIds.has(product.id);
      const access: "full" | "preview" = hasFullAccess ? "full" : "preview";

      const productDocs = docsByProduct.get(product.id) || [];
      const assets: ProductVisible["assets"] = [];

      for (const doc of productDocs) {
        if (doc.audience === "internal") continue;
        if (userRole === "client" && doc.audience === "distributor") continue;

        const docAccess: "full" | "preview" = hasFullAccess ? "full" : "preview";

        assets.push({
          id: doc.id,
          title: doc.title,
          type: doc.type,
          file_path: doc.file_path,
          download_url: null,
          access: docAccess,
        });
      }

      enriched.push({
        id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        abv: product.abv,
        size_ml: product.size_ml,
        sku: product.sku,
        description: product.description,
        access,
        assets,
      });
    }

    setProducts(enriched);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleDownload = async (doc: DocItem) => {
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

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.brand || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
    const matchesAccess = accessFilter === "all" || p.access === accessFilter;
    return matchesSearch && matchesCategory && matchesAccess;
  });

  const availableDocTypes = [...new Set(documents.map((d) => d.type))];

  const filteredDocs = documents.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(docSearch.toLowerCase()) ||
      (d.product_name || "").toLowerCase().includes(docSearch.toLowerCase());
    const matchesType = docTypeFilter === "all" || d.type === docTypeFilter;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div>
        <div className="mc-skeleton h-8 w-48 mb-6" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="mc-skeleton h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={pageTab === "catalogue" ? "Products" : "Documents"}
        description={
          pageTab === "catalogue"
            ? `${products.filter((p) => p.access === "full").length} products available · ${products.filter((p) => p.access === "preview").length} preview`
            : `${documents.length} documents available${role === "client" ? " · Contact your distributor for additional materials" : ""}`
        }
        icon={pageTab === "catalogue" ? Package : FileText}
      />

      {/* Tab switcher */}
      <div className="flex mb-5" style={{ border: "1px solid var(--mc-border)" }}>
        <button
          onClick={() => setPageTab("catalogue")}
          className="px-4 py-1.5 text-[11px] font-medium tracking-wide transition-colors"
          style={{
            background: pageTab === "catalogue" ? "var(--mc-cream-subtle)" : "transparent",
            color: pageTab === "catalogue" ? "var(--mc-black)" : "var(--mc-text-muted)",
          }}
        >
          <Package className="w-3 h-3 inline-block mr-1.5" />
          Catalogue
        </button>
        <button
          onClick={() => setPageTab("documents")}
          className="px-4 py-1.5 text-[11px] font-medium tracking-wide transition-colors"
          style={{
            background: pageTab === "documents" ? "var(--mc-cream-subtle)" : "transparent",
            color: pageTab === "documents" ? "var(--mc-black)" : "var(--mc-text-muted)",
          }}
        >
          <FileText className="w-3 h-3 inline-block mr-1.5" />
          Documents
        </button>
      </div>

      {pageTab === "catalogue" ? (
        <>
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
                placeholder="Search products..."
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="mc-input mc-select w-auto min-w-[140px]"
            >
              <option value="all">All Categories</option>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
            <select
              value={accessFilter}
              onChange={(e) => setAccessFilter(e.target.value)}
              className="mc-input mc-select w-auto min-w-[130px]"
            >
              <option value="all">All Access</option>
              <option value="full">Full Access</option>
              <option value="preview">Preview Only</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No products found"
              description={
                search || categoryFilter !== "all"
                  ? "Try adjusting your filters"
                  : "No products are available yet"
              }
            />
          ) : (
            <div className="grid gap-3 mc-stagger">
              {filtered.map((product) => (
                <div key={product.id} className="mc-card overflow-hidden">
                  <div
                    className="p-4 flex items-center gap-4 cursor-pointer"
                    onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}
                    style={{ opacity: product.access === "preview" ? 0.65 : 1 }}
                  >
                    <div
                      className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                      style={{
                        background: product.access === "full"
                          ? "rgba(107, 143, 110, 0.08)"
                          : "rgba(196, 163, 90, 0.08)",
                        border: `1px solid ${product.access === "full" ? "var(--mc-success-light)" : "var(--mc-warning-light)"}`,
                      }}
                    >
                      <Package
                        className="w-5 h-5"
                        style={{ color: product.access === "full" ? "var(--mc-success)" : "var(--mc-warning)" }}
                        strokeWidth={1.5}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: "var(--mc-text-primary)" }}>
                          {product.name}
                        </span>
                        {product.brand && (
                          <span className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
                            {product.brand}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] font-medium tracking-wide uppercase" style={{ color: "var(--mc-text-tertiary)" }}>
                          {product.category}
                        </span>
                        {product.abv && (
                          <span className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
                            {product.abv}%
                          </span>
                        )}
                        {product.size_ml && (
                          <span className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
                            {product.size_ml}ml
                          </span>
                        )}
                        {product.sku && (
                          <span className="text-[10px] font-mono" style={{ color: "var(--mc-text-muted)" }}>
                            {product.sku}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      {product.assets.length > 0 && (
                        <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--mc-text-muted)" }}>
                          <FileText className="w-3 h-3" />
                          {product.assets.length}
                        </span>
                      )}
                      {product.access === "preview" && (
                        <span
                          className="flex items-center gap-1 text-[10px] px-2 py-0.5"
                          style={{
                            color: "var(--mc-warning)",
                            background: "var(--mc-warning-bg)",
                            border: "1px solid var(--mc-warning-light)",
                          }}
                        >
                          <Lock className="w-2.5 h-2.5" />
                          Preview
                        </span>
                      )}
                      {expandedProduct === product.id ? (
                        <ChevronUp className="w-4 h-4" style={{ color: "var(--mc-text-muted)" }} />
                      ) : (
                        <ChevronDown className="w-4 h-4" style={{ color: "var(--mc-text-muted)" }} />
                      )}
                    </div>
                  </div>

                  {expandedProduct === product.id && (
                    <div
                      className="px-4 pb-4 mc-animate-fade"
                      style={{ borderTop: "1px solid var(--mc-border-light)" }}
                    >
                      {product.description && (
                        <p className="text-xs mt-3 mb-3" style={{ color: "var(--mc-text-secondary)" }}>
                          {product.description}
                        </p>
                      )}

                      {product.assets.length > 0 ? (
                        <div className="space-y-2 mt-3">
                          <p className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: "var(--mc-text-muted)" }}>
                            Documents & Assets
                          </p>
                          {product.assets.map((asset) => (
                            <div
                              key={asset.id}
                              className="flex items-center gap-3 px-3 py-2"
                              style={{
                                background: "var(--mc-surface-warm)",
                                border: "1px solid var(--mc-border-light)",
                              }}
                            >
                              <FileText className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--mc-text-muted)" }} />
                              <span className="text-xs flex-1" style={{ color: "var(--mc-text-secondary)" }}>
                                {asset.title}
                              </span>
                              <span className="text-[10px] tracking-wide uppercase" style={{ color: "var(--mc-text-muted)" }}>
                                {DOCUMENT_TYPE_LABELS[asset.type] || asset.type}
                              </span>
                              {asset.access === "full" ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDownload({ id: asset.id, title: asset.title, file_path: asset.file_path, access: "full" } as DocItem); }}
                                  className="text-[10px] flex items-center gap-1 transition-colors"
                                  style={{ color: "var(--mc-cream-subtle)" }}
                                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
                                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-cream-subtle)")}
                                >
                                  <Download className="w-3 h-3" />
                                </button>
                              ) : (
                                <Lock className="w-3 h-3" style={{ color: "var(--mc-warning)" }} />
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs mt-3" style={{ color: "var(--mc-text-muted)" }}>
                          No documents available for this product.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Documents tab content */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                style={{ color: "var(--mc-text-muted)" }}
              />
              <input
                type="text"
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                className="mc-input pl-9"
                placeholder="Search by title or product..."
              />
            </div>
            <select
              value={docTypeFilter}
              onChange={(e) => setDocTypeFilter(e.target.value)}
              className="mc-input mc-select w-auto min-w-[160px]"
            >
              <option value="all">All Types</option>
              {DOCUMENT_TYPES.filter((t) => availableDocTypes.includes(t)).map((t) => (
                <option key={t} value={t}>
                  {DOCUMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {filteredDocs.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents found"
              description={
                docSearch || docTypeFilter !== "all"
                  ? "Try adjusting your filters"
                  : "No documents have been shared with you yet"
              }
            />
          ) : (
            <div className="grid gap-3 mc-stagger">
              {filteredDocs.map((doc) => (
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
        </>
      )}
    </div>
  );
}
