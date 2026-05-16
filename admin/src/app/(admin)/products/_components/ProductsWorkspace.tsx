"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import type { Product } from "@mecanova/shared";
import { Package, Plus } from "lucide-react";
import ProductsSidebar from "./ProductsSidebar";
import ProductDetailPanel from "./ProductDetailPanel";
import ProductFormModal from "./ProductFormModal";

interface Props {
  selectedId: string | null;
}

type ProductWithSupplier = Product & { supplier_name?: string };

export default function ProductsWorkspace({ selectedId }: Props) {
  const [products, setProducts] = useState<ProductWithSupplier[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<string | null>(selectedId);
  const [showCreate, setShowCreate] = useState(false);
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

  // Deep-link / route prop change → reflect as selection.
  useEffect(() => {
    setSel(selectedId);
  }, [selectedId]);

  // Browser back/forward keeps selection in sync without a route remount.
  useEffect(() => {
    const onPop = () => {
      const m = window.location.pathname.match(/^\/products\/([^/]+)/);
      setSel(m ? decodeURIComponent(m[1]) : null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Client-side selection: update the address bar but do NOT trigger a Next
  // route navigation (which would remount the workspace and refetch).
  const handleSelect = useCallback((id: string) => {
    setSel(id);
    if (window.location.pathname !== `/products/${id}`) {
      window.history.pushState(null, "", `/products/${id}`);
    }
  }, []);

  // Patch a single product in place (no full refetch) after an edit, or
  // fall back to a full reload when no product object is provided.
  const handleProductChanged = useCallback(
    (p?: Product) => {
      if (p) {
        setProducts((prev) =>
          prev
            .map((x) => (x.id === p.id ? { ...x, ...p } : x))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      } else {
        loadProducts();
      }
    },
    [loadProducts]
  );

  const activeCount = products.filter((p) => p.active).length;
  const inactiveCount = products.length - activeCount;

  return (
    <div
      className="mc-fullheight-page"
      style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      <PageHeader
        title="Products"
        description={`${activeCount} active${inactiveCount > 0 ? `, ${inactiveCount} inactive` : ""}`}
        icon={Package}
        actions={
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="mc-btn mc-btn-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Product
          </button>
        }
      />

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <ProductsSidebar
          products={products}
          suppliers={suppliers}
          selectedId={sel}
          loading={loading}
          onSelect={handleSelect}
        />

        {sel ? (
          <ProductDetailPanel id={sel} onProductChanged={handleProductChanged} />
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <EmptyState
              icon={Package}
              title="Select a product"
              description="Choose a product from the list on the left to view its details"
            />
          </div>
        )}
      </div>

      {showCreate && (
        <ProductFormModal
          mode="create"
          onClose={() => setShowCreate(false)}
          onSaved={(p) => {
            setProducts((prev) =>
              [...prev, p].sort((a, b) => a.name.localeCompare(b.name))
            );
            setShowCreate(false);
            handleSelect(p.id);
          }}
        />
      )}
    </div>
  );
}
