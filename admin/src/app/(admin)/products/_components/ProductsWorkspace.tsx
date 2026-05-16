"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import type { Product } from "@mecanova/shared";
import { Package, Plus } from "lucide-react";
import ProductsSidebar from "./ProductsSidebar";
import ProductDetailPanel from "./ProductDetailPanel";

interface Props {
  selectedId: string | null;
}

type ProductWithSupplier = Product & { supplier_name?: string };

export default function ProductsWorkspace({ selectedId }: Props) {
  const [products, setProducts] = useState<ProductWithSupplier[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
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

  const activeCount = products.filter((p) => p.active).length;
  const inactiveCount = products.length - activeCount;

  return (
    <div
      className="mc-fullheight-page"
      style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      {/* Header */}
      <PageHeader
        title="Products"
        description={`${activeCount} active${inactiveCount > 0 ? `, ${inactiveCount} inactive` : ""}`}
        icon={Package}
        actions={
          <Link href="/products/new" className="mc-btn mc-btn-primary">
            <Plus className="w-3.5 h-3.5" />
            Add Product
          </Link>
        }
      />

      {/* Split view */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <ProductsSidebar
          products={products}
          suppliers={suppliers}
          selectedId={selectedId}
          loading={loading}
        />

        {selectedId ? (
          <ProductDetailPanel id={selectedId} onProductChanged={loadProducts} />
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
    </div>
  );
}
