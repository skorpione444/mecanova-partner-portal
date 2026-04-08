"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import type { Product, ProductAsset } from "@mecanova/shared";
import {
  Package,
  ArrowLeft,
  Edit,
  ToggleLeft,
  ToggleRight,
  Factory,
  FileText,
  Image,
  ExternalLink,
} from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  tequila: "Tequila",
  mezcal: "Mezcal",
  raicilla: "Raicilla",
  other: "Other",
};

const ASSET_TYPE_LABELS: Record<string, string> = {
  bottle_shot: "Bottle Shot",
  label_pdf: "Label PDF",
  spec_sheet: "Spec Sheet",
  brand_deck: "Brand Deck",
};

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [product, setProduct] = useState<Product & { supplier_name?: string } | null>(null);
  const [assets, setAssets] = useState<ProductAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: productData } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (!productData) {
      router.push("/products");
      return;
    }

    let supplierName: string | undefined;
    if (productData.supplier_id) {
      const { data: supplierData } = await supabase
        .from("partners")
        .select("name")
        .eq("id", productData.supplier_id)
        .single();
      supplierName = supplierData?.name || undefined;
    }

    setProduct({ ...productData, supplier_name: supplierName });

    // Product assets
    const { data: assetData } = await supabase
      .from("product_assets")
      .select("*")
      .eq("product_id", id)
      .order("type");
    setAssets(assetData || []);

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async () => {
    if (!product) return;
    setToggling(true);
    await supabase.from("products").update({ active: !product.active }).eq("id", id);
    setProduct({ ...product, active: !product.active });
    setToggling(false);
  };

  if (loading) {
    return (
      <div>
        <div className="mc-skeleton h-6 w-48 mb-6" />
        <div className="mc-skeleton h-48" />
      </div>
    );
  }

  if (!product) return null;

  return (
    <div>
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-[11px] tracking-wide mb-4 transition-colors"
        style={{ color: "var(--mc-text-muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-text-muted)")}
      >
        <ArrowLeft className="w-3 h-3" />
        Back to Products
      </Link>

      <PageHeader
        title={product.name}
        description={`${product.brand || "No brand"} — ${CATEGORY_LABELS[product.category] ?? product.category}`}
        icon={Package}
        actions={
          <div className="flex gap-2">
            <button
              onClick={toggleActive}
              disabled={toggling}
              className={`mc-btn ${product.active ? "mc-btn-danger" : "mc-btn-success"}`}
            >
              {product.active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
              {product.active ? "Deactivate" : "Activate"}
            </button>
            <Link href={`/products/${id}/edit`} className="mc-btn mc-btn-ghost">
              <Edit className="w-3.5 h-3.5" />
              Edit
            </Link>
          </div>
        }
      />

      <div className="space-y-5">
          {/* Product Details */}
          <div className="mc-card p-5">
            <h3
              className="text-xs font-semibold tracking-[0.08em] uppercase mb-4"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Product Details
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="mc-label">Category</p>
                <span
                  className="inline-flex px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
                  style={{
                    background: "var(--mc-surface-elevated)",
                    border: "1px solid var(--mc-border)",
                    color: "var(--mc-text-muted)",
                  }}
                >
                  {CATEGORY_LABELS[product.category] ?? product.category}
                </span>
              </div>
              <div>
                <p className="mc-label">ABV</p>
                <p className="text-sm">{product.abv ? `${product.abv}%` : "—"}</p>
              </div>
              <div>
                <p className="mc-label">Bottle Size</p>
                <p className="text-sm">{product.size_ml ? `${product.size_ml} ml` : "—"}</p>
              </div>
              <div>
                <p className="mc-label">Case Size</p>
                <p className="text-sm">{product.case_size ? `${product.case_size} bottles` : "—"}</p>
              </div>
              <div>
                <p className="mc-label">SKU</p>
                <p className="text-sm font-mono">{product.sku || "—"}</p>
              </div>
              <div>
                <p className="mc-label">Status</p>
                <span
                  className="inline-flex px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
                  style={{
                    background: product.active ? "var(--mc-success-bg)" : "var(--mc-error-bg)",
                    border: `1px solid ${product.active ? "var(--mc-success-light)" : "var(--mc-error-light)"}`,
                    color: product.active ? "var(--mc-success)" : "var(--mc-error)",
                  }}
                >
                  {product.active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            {/* Supplier */}
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--mc-border)" }}>
              <p className="mc-label mb-1.5">Supplier</p>
              {product.supplier_name && product.supplier_id ? (
                <Link
                  href={`/partners/${product.supplier_id}`}
                  className="inline-flex items-center gap-2 px-3 py-2 transition-all"
                  style={{
                    background: "var(--mc-surface-elevated)",
                    border: "1px solid var(--mc-border)",
                    color: "var(--mc-cream-subtle)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--mc-cream)";
                    e.currentTarget.style.borderColor = "var(--mc-cream-subtle)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--mc-cream-subtle)";
                    e.currentTarget.style.borderColor = "var(--mc-border)";
                  }}
                >
                  <Factory className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs font-medium">{product.supplier_name}</span>
                  <ExternalLink className="w-3 h-3 ml-2 flex-shrink-0 opacity-40" />
                </Link>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm" style={{ color: "var(--mc-text-muted)" }}>
                    No supplier assigned
                  </p>
                  <Link
                    href={`/products/${id}/edit`}
                    className="text-[10px] underline"
                    style={{ color: "var(--mc-cream-subtle)" }}
                  >
                    Assign one
                  </Link>
                </div>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--mc-border)" }}>
                <p className="mc-label">Description / Tasting Notes</p>
                <p className="text-sm mt-1" style={{ color: "var(--mc-text-secondary)" }}>
                  {product.description}
                </p>
              </div>
            )}
          </div>

          {/* Product Assets */}
          <div className="mc-card p-5">
            <h3
              className="text-xs font-semibold tracking-[0.08em] uppercase mb-4"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Product Assets
            </h3>
            {assets.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
                No assets attached to this product
              </p>
            ) : (
              <div className="space-y-2">
                {assets.map((asset) => (
                  <a
                    key={asset.id}
                    href={asset.file_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2 group transition-all"
                    style={{
                      background: "var(--mc-surface-elevated)",
                      border: "1px solid var(--mc-border)",
                      color: "var(--mc-text-secondary)",
                      textDecoration: "none",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--mc-cream-subtle)";
                      e.currentTarget.style.color = "var(--mc-cream)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--mc-border)";
                      e.currentTarget.style.color = "var(--mc-text-secondary)";
                    }}
                  >
                    {asset.type === "bottle_shot" ? (
                      <Image className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--mc-text-muted)" }} />
                    ) : (
                      <FileText className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--mc-text-muted)" }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">
                        {ASSET_TYPE_LABELS[asset.type] ?? asset.type}
                      </p>
                      {asset.title && (
                        <p className="text-[10px] truncate" style={{ color: "var(--mc-text-muted)" }}>
                          {asset.title}
                        </p>
                      )}
                    </div>
                    <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-30 group-hover:opacity-60 transition-opacity" />
                  </a>
                ))}
              </div>
            )}
          </div>
      </div>
    </div>
  );
}
