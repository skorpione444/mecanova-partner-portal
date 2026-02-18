"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import type { Product } from "@mecanova/shared";
import { PRODUCT_CATEGORIES } from "@mecanova/shared";
import { Package, Plus, Search, ArrowRight } from "lucide-react";

type ProductWithSupplier = Product & { supplier_name?: string };

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductWithSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const supabase = createClient();

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("name");

    if (!data) {
      setProducts([]);
      setLoading(false);
      return;
    }

    // Resolve supplier names
    const supplierIds = [...new Set(data.map((p) => p.supplier_id).filter(Boolean))] as string[];
    let supplierMap = new Map<string, string>();
    if (supplierIds.length > 0) {
      const { data: suppliers } = await supabase
        .from("partners")
        .select("id, name")
        .in("id", supplierIds);
      supplierMap = new Map((suppliers || []).map((s) => [s.id, s.name]));
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

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.brand || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || p.category === categoryFilter;
    const matchesActive =
      activeFilter === "all" ||
      (activeFilter === "active" && p.active) ||
      (activeFilter === "inactive" && !p.active);
    return matchesSearch && matchesCategory && matchesActive;
  });

  if (loading) {
    return (
      <div>
        <div className="mc-skeleton h-8 w-48 mb-6" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="mc-skeleton h-16" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Products"
        description={`${products.length} products in catalogue`}
        icon={Package}
        actions={
          <Link href="/products/new" className="mc-btn mc-btn-primary">
            <Plus className="w-3.5 h-3.5" />
            Add Product
          </Link>
        }
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
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
          className="mc-input mc-select w-auto min-w-[120px]"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products found"
          description={
            search || categoryFilter !== "all"
              ? "Try adjusting your filters"
              : "Add your first product to the catalogue"
          }
          action={
            !search && categoryFilter === "all" ? (
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
                <th>ABV</th>
                <th>Size</th>
                <th>SKU</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div>
                      <p
                        className="text-xs font-medium"
                        style={{ color: "var(--mc-text-primary)" }}
                      >
                        {product.name}
                      </p>
                      {product.brand && (
                        <p
                          className="text-[10px]"
                          style={{ color: "var(--mc-text-muted)" }}
                        >
                          {product.brand}
                        </p>
                      )}
                    </div>
                  </td>
                  <td>
                    <span
                      className="text-xs"
                      style={{ color: product.supplier_name ? "var(--mc-text-secondary)" : "var(--mc-text-muted)" }}
                    >
                      {product.supplier_name || "—"}
                    </span>
                  </td>
                  <td>
                    <span
                      className="text-[10px] font-medium tracking-wide uppercase"
                      style={{ color: "var(--mc-text-tertiary)" }}
                    >
                      {product.category}
                    </span>
                  </td>
                  <td>{product.abv ? `${product.abv}%` : "—"}</td>
                  <td>{product.size_ml ? `${product.size_ml}ml` : "—"}</td>
                  <td>
                    <span
                      className="text-xs font-mono"
                      style={{ color: "var(--mc-text-muted)" }}
                    >
                      {product.sku || "—"}
                    </span>
                  </td>
                  <td>
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
                  </td>
                  <td>
                    <Link
                      href={`/products/${product.id}`}
                      className="inline-flex items-center gap-1 text-[11px] transition-colors"
                      style={{ color: "var(--mc-cream-subtle)" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "var(--mc-cream)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color =
                          "var(--mc-cream-subtle)")
                      }
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



