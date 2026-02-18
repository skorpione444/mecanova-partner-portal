"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import type { Product, InventoryStatus } from "@mecanova/shared";
import { INVENTORY_STATUS_LABELS } from "@mecanova/shared";
import {
  Package,
  ArrowLeft,
  Edit,
  Warehouse,
  ToggleLeft,
  ToggleRight,
  Factory,
} from "lucide-react";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [product, setProduct] = useState<Product & { supplier_name?: string } | null>(null);
  const [inventory, setInventory] = useState<
    (InventoryStatus & { distributor_name: string })[]
  >([]);
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

    // Fetch supplier name if linked
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

    // Load inventory across distributors
    const { data: invData } = await supabase
      .from("inventory_status")
      .select("*")
      .eq("product_id", id);

    if (invData && invData.length > 0) {
      const distIds = invData.map((i) => i.distributor_id);
      const { data: dists } = await supabase
        .from("partners")
        .select("id, name")
        .in("id", distIds);
      const distMap = new Map((dists || []).map((d) => [d.id, d.name]));

      setInventory(
        invData.map((i) => ({
          ...i,
          distributor_name: distMap.get(i.distributor_id) || "Unknown",
        }))
      );
    }

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async () => {
    if (!product) return;
    setToggling(true);
    await supabase
      .from("products")
      .update({ active: !product.active })
      .eq("id", id);
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
        onMouseEnter={(e) =>
          (e.currentTarget.style.color = "var(--mc-cream)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.color = "var(--mc-text-muted)")
        }
      >
        <ArrowLeft className="w-3 h-3" />
        Back to Products
      </Link>

      <PageHeader
        title={product.name}
        description={`${product.brand || "No brand"} — ${product.category}`}
        icon={Package}
        actions={
          <div className="flex gap-2">
            <button
              onClick={toggleActive}
              disabled={toggling}
              className={`mc-btn ${
                product.active ? "mc-btn-danger" : "mc-btn-success"
              }`}
            >
              {product.active ? (
                <ToggleRight className="w-3.5 h-3.5" />
              ) : (
                <ToggleLeft className="w-3.5 h-3.5" />
              )}
              {product.active ? "Deactivate" : "Activate"}
            </button>
            <Link
              href={`/products/${id}/edit`}
              className="mc-btn mc-btn-ghost"
            >
              <Edit className="w-3.5 h-3.5" />
              Edit
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Product details */}
        <div className="lg:col-span-2">
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
                <p className="text-sm capitalize">{product.category}</p>
              </div>
              <div>
                <p className="mc-label">ABV</p>
                <p className="text-sm">
                  {product.abv ? `${product.abv}%` : "—"}
                </p>
              </div>
              <div>
                <p className="mc-label">Bottle Size</p>
                <p className="text-sm">
                  {product.size_ml ? `${product.size_ml}ml` : "—"}
                </p>
              </div>
              <div>
                <p className="mc-label">Case Size</p>
                <p className="text-sm">
                  {product.case_size
                    ? `${product.case_size} bottles`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="mc-label">SKU</p>
                <p className="text-sm font-mono">
                  {product.sku || "—"}
                </p>
              </div>
              <div>
                <p className="mc-label">Status</p>
                <span
                  className="inline-flex px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
                  style={{
                    background: product.active
                      ? "var(--mc-success-bg)"
                      : "var(--mc-error-bg)",
                    border: `1px solid ${
                      product.active
                        ? "var(--mc-success-light)"
                        : "var(--mc-error-light)"
                    }`,
                    color: product.active
                      ? "var(--mc-success)"
                      : "var(--mc-error)",
                  }}
                >
                  {product.active ? "Active" : "Inactive"}
                </span>
              </div>
              <div>
                <p className="mc-label">Supplier</p>
                {product.supplier_name ? (
                  <Link
                    href={`/partners/${product.supplier_id}`}
                    className="text-sm flex items-center gap-1.5 transition-colors"
                    style={{ color: "var(--mc-cream-subtle)" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "var(--mc-cream)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "var(--mc-cream-subtle)")
                    }
                  >
                    <Factory className="w-3 h-3" />
                    {product.supplier_name}
                  </Link>
                ) : (
                  <p className="text-sm" style={{ color: "var(--mc-text-muted)" }}>
                    Not assigned
                  </p>
                )}
              </div>
            </div>
            {product.description && (
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--mc-border)" }}>
                <p className="mc-label">Description</p>
                <p className="text-sm" style={{ color: "var(--mc-text-secondary)" }}>
                  {product.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Inventory sidebar */}
        <div>
          <div className="mc-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Warehouse
                className="w-4 h-4"
                style={{ color: "var(--mc-text-muted)" }}
              />
              <h3
                className="text-xs font-semibold tracking-[0.08em] uppercase"
                style={{ color: "var(--mc-text-muted)" }}
              >
                Inventory by Distributor
              </h3>
            </div>
            {inventory.length === 0 ? (
              <p
                className="text-xs"
                style={{ color: "var(--mc-text-muted)" }}
              >
                No inventory records
              </p>
            ) : (
              <div className="space-y-3">
                {inventory.map((inv) => (
                  <div
                    key={`${inv.product_id}-${inv.distributor_id}`}
                    className="py-2 px-3"
                    style={{
                      background: "var(--mc-surface-warm)",
                      border: "1px solid var(--mc-border-light)",
                    }}
                  >
                    <p
                      className="text-xs font-medium mb-1"
                      style={{ color: "var(--mc-text-primary)" }}
                    >
                      {inv.distributor_name}
                    </p>
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[10px]"
                        style={{ color: "var(--mc-text-muted)" }}
                      >
                        {inv.on_hand_qty} cases
                      </span>
                      <span
                        className="inline-flex px-1.5 py-0.5 text-[9px] font-medium tracking-wide uppercase"
                        style={{
                          background:
                            inv.status === "in_stock"
                              ? "var(--mc-success-bg)"
                              : inv.status === "limited"
                              ? "var(--mc-warning-bg)"
                              : "var(--mc-error-bg)",
                          color:
                            inv.status === "in_stock"
                              ? "var(--mc-success)"
                              : inv.status === "limited"
                              ? "var(--mc-warning)"
                              : "var(--mc-error)",
                        }}
                      >
                        {INVENTORY_STATUS_LABELS[inv.status]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

