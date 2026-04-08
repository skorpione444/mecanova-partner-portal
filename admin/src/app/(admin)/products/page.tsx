"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import type { Product } from "@mecanova/shared";
import { PRODUCT_CATEGORIES } from "@mecanova/shared";
import { Package, Plus, Search, ArrowRight, Factory } from "lucide-react";

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 10px",
        fontSize: "0.6875rem",
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        border: "1px solid",
        borderColor: active ? "var(--mc-cream)" : "var(--mc-border)",
        background: active ? "rgba(236,223,204,0.08)" : "transparent",
        color: active ? "var(--mc-cream)" : "var(--mc-text-muted)",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
        letterSpacing: active ? "0.02em" : "0",
      }}
    >
      {children}
    </button>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  tequila: "Tequila",
  mezcal: "Mezcal",
  raicilla: "Raicilla",
  other: "Other",
};

type ProductWithSupplier = Product & { supplier_name?: string };

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductWithSupplier[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const supabase = createClient();

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("products").select("*").order("name");

    if (!data) {
      setProducts([]);
      setLoading(false);
      return;
    }

    const supplierIds = [...new Set(data.map((p) => p.supplier_id).filter(Boolean))] as string[];
    let supplierMap = new Map<string, string>();
    if (supplierIds.length > 0) {
      const { data: sups } = await supabase
        .from("partners")
        .select("id, name")
        .in("id", supplierIds);
      supplierMap = new Map((sups || []).map((s) => [s.id, s.name]));
    }

    setProducts(
      data.map((p) => ({
        ...p,
        supplier_name: p.supplier_id ? supplierMap.get(p.supplier_id) : undefined,
      }))
    );
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSuppliers = useCallback(async () => {
    const { data } = await supabase
      .from("partners")
      .select("id, name")
      .eq("partner_type", "supplier")
      .order("name");
    setSuppliers(data || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadProducts();
    loadSuppliers();
  }, [loadProducts, loadSuppliers]);

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.brand || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
    const matchesSupplier =
      supplierFilter === "all" || p.supplier_id === supplierFilter;
    const matchesActive =
      activeFilter === "all" ||
      (activeFilter === "active" && p.active) ||
      (activeFilter === "inactive" && !p.active);
    return matchesSearch && matchesCategory && matchesSupplier && matchesActive;
  });

  if (loading) {
    return (
      <div>
        <div className="mc-skeleton h-8 w-48 mb-6" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="mc-skeleton h-16" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Products"
        description={`${products.length} product${products.length !== 1 ? "s" : ""} in catalogue`}
        icon={Package}
        actions={
          <Link href="/products/new" className="mc-btn mc-btn-primary">
            <Plus className="w-3.5 h-3.5" />
            Add Product
          </Link>
        }
      />

      {/* Search */}
      <div className="relative mb-3">
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

      {/* Filter chips */}
      <div
        className="flex items-center gap-4 mb-5 overflow-x-auto"
        style={{
          padding: "8px 12px",
          background: "var(--mc-surface-warm)",
          borderBottom: "1px solid var(--mc-border)",
        }}
      >
        {/* Suppliers */}
        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          style={{
            fontSize: "0.6875rem",
            padding: "4px 24px 4px 10px",
            border: "1px solid",
            borderColor: supplierFilter !== "all" ? "var(--mc-cream)" : "var(--mc-border)",
            background: supplierFilter !== "all" ? "rgba(236,223,204,0.08)" : "transparent",
            color: supplierFilter !== "all" ? "var(--mc-cream)" : "var(--mc-text-muted)",
            cursor: "pointer",
            flexShrink: 0,
            outline: "none",
            appearance: "auto",
          }}
        >
          <option value="all">All Suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <div style={{ width: 1, height: 20, background: "var(--mc-border)", flexShrink: 0 }} />

        {/* Category */}
        <div className="flex gap-1 flex-shrink-0">
          <FilterChip active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>
            All
          </FilterChip>
          {PRODUCT_CATEGORIES.map((c) => (
            <FilterChip key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)}>
              {CATEGORY_LABELS[c] ?? c}
            </FilterChip>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: "var(--mc-border)", flexShrink: 0 }} />

        {/* Status */}
        <div className="flex gap-1 flex-shrink-0">
          <FilterChip active={activeFilter === "all"} onClick={() => setActiveFilter("all")}>All</FilterChip>
          <FilterChip active={activeFilter === "active"} onClick={() => setActiveFilter("active")}>Active</FilterChip>
          <FilterChip active={activeFilter === "inactive"} onClick={() => setActiveFilter("inactive")}>Inactive</FilterChip>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products found"
          description={
            search || categoryFilter !== "all" || supplierFilter !== "all"
              ? "Try adjusting your filters"
              : "Add your first product to the catalogue"
          }
          action={
            !search && categoryFilter === "all" && supplierFilter === "all" ? (
              <Link href="/products/new" className="mc-btn mc-btn-primary">
                <Plus className="w-3.5 h-3.5" />
                Add Product
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="mc-card overflow-hidden">
          <table className="mc-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Supplier</th>
                <th>Category</th>
                <th>ABV / Size</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div>
                      <p className="text-xs font-medium" style={{ color: "var(--mc-text-primary)" }}>
                        {product.name}
                      </p>
                      {product.brand && (
                        <p className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
                          {product.brand}
                        </p>
                      )}
                    </div>
                  </td>
                  <td>
                    {product.supplier_id && product.supplier_name ? (
                      <Link
                        href={`/partners/${product.supplier_id}`}
                        className="flex items-center gap-1 text-xs transition-colors"
                        style={{ color: "var(--mc-cream-subtle)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-cream-subtle)")}
                      >
                        <Factory className="w-3 h-3 flex-shrink-0" />
                        {product.supplier_name}
                      </Link>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--mc-text-muted)" }}>—</span>
                    )}
                  </td>
                  <td>
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
                  </td>
                  <td>
                    <span className="text-xs" style={{ color: "var(--mc-text-secondary)" }}>
                      {[
                        product.abv ? `${product.abv}%` : null,
                        product.size_ml ? `${product.size_ml}ml` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </span>
                  </td>
                  <td>
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
                  </td>
                  <td>
                    <Link
                      href={`/products/${product.id}`}
                      className="inline-flex items-center gap-1 text-[11px] transition-colors"
                      style={{ color: "var(--mc-cream-subtle)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-cream-subtle)")}
                    >
                      View <ArrowRight className="w-3 h-3" />
                    </Link>
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
