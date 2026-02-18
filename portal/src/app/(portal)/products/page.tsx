"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Product,
  InventoryStatus,
  InventoryStatusEnum,
} from "@/lib/supabase/types";
import { Search, Package, Wine } from "lucide-react";

interface ProductWithInventory extends Product {
  inventory?: Pick<InventoryStatus, "status" | "on_hand_qty" | "updated_at">;
}

const INVENTORY_LABELS: Record<InventoryStatusEnum, string> = {
  in_stock: "In Stock",
  limited: "Limited",
  out: "Out of Stock",
};

const INVENTORY_CONFIG: Record<
  InventoryStatusEnum,
  { bg: string; text: string; border: string; dot: string }
> = {
  in_stock: {
    bg: "var(--mc-success-bg)",
    text: "var(--mc-success)",
    border: "var(--mc-success)",
    dot: "var(--mc-success)",
  },
  limited: {
    bg: "var(--mc-warning-bg)",
    text: "var(--mc-warning)",
    border: "var(--mc-warning)",
    dot: "var(--mc-warning)",
  },
  out: {
    bg: "var(--mc-error-bg)",
    text: "var(--mc-error)",
    border: "var(--mc-error)",
    dot: "var(--mc-error)",
  },
};

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductWithInventory[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, partner_id")
        .eq("user_id", user.id)
        .single();

      const { data: productsData } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("name");

      if (!productsData || productsData.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      let distributorId: string | null = null;

      if (profile?.role === "distributor" && profile.partner_id) {
        distributorId = profile.partner_id;
      } else if (profile?.role === "client" && profile.partner_id) {
        const { data: cdData } = await supabase
          .from("client_distributors")
          .select("distributor_id, is_default")
          .eq("client_id", profile.partner_id);

        if (cdData && cdData.length > 0) {
          const defaultDist = cdData.find((cd) => cd.is_default);
          distributorId = defaultDist
            ? defaultDist.distributor_id
            : cdData[0].distributor_id;
        }
      }

      let inventoryMap = new Map<
        string,
        Pick<InventoryStatus, "status" | "on_hand_qty" | "updated_at">
      >();

      if (distributorId) {
        const productIds = productsData.map((p) => p.id);
        const { data: invData } = await supabase
          .from("inventory_status")
          .select("product_id, status, on_hand_qty, updated_at")
          .eq("distributor_id", distributorId)
          .in("product_id", productIds);

        if (invData) {
          invData.forEach((inv) => {
            inventoryMap.set(inv.product_id, {
              status: inv.status,
              on_hand_qty: inv.on_hand_qty,
              updated_at: inv.updated_at,
            });
          });
        }
      }

      const merged: ProductWithInventory[] = productsData.map((p) => ({
        ...p,
        inventory: inventoryMap.get(p.id),
      }));

      setProducts(merged);
      setLoading(false);
    };

    load();
  }, [supabase]);

  const filtered = search.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.brand && p.brand.toLowerCase().includes(search.toLowerCase())) ||
          p.category.toLowerCase().includes(search.toLowerCase())
      )
    : products;

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <div className="mc-skeleton h-8 w-36 mb-3" />
          <div className="mc-skeleton h-5 w-64" />
        </div>
        <div className="mc-skeleton h-11 w-80" />
        <div className="mc-card overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-6 py-4"
              style={{ borderBottom: "1px solid var(--mc-border)" }}
            >
              <div className="mc-skeleton w-10 h-10" />
              <div className="flex-1">
                <div className="mc-skeleton h-4 w-40 mb-2" />
                <div className="mc-skeleton h-3 w-24" />
              </div>
              <div className="mc-skeleton h-6 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1
          className="text-3xl font-semibold tracking-tight"
          style={{
            fontFamily: "var(--font-jost), sans-serif",
            color: "var(--mc-text-primary)",
          }}
        >
          Products
        </h1>
        <p
          className="mt-2 text-sm"
          style={{
            color: "var(--mc-text-tertiary)",
            fontFamily: "var(--font-manrope), sans-serif",
          }}
        >
          Product catalogue and current availability
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: "var(--mc-text-muted)" }}
          strokeWidth={1.5}
        />
        <input
          type="text"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mc-input pl-10"
        />
      </div>

      {/* Product table */}
      {filtered.length === 0 ? (
        <div className="mc-card p-16 text-center">
          <Wine
            className="w-10 h-10 mx-auto mb-4"
            style={{ color: "var(--mc-text-muted)" }}
            strokeWidth={1}
          />
          <p
            className="text-base font-medium mb-1"
            style={{
              color: "var(--mc-text-secondary)",
              fontFamily: "var(--font-jost), sans-serif",
            }}
          >
            No products found
          </p>
          <p className="text-sm" style={{ color: "var(--mc-text-muted)" }}>
            {search ? "Try adjusting your search terms" : "Products will appear here when available"}
          </p>
        </div>
      ) : (
        <div className="mc-card overflow-hidden">
          <table className="mc-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Size</th>
                <th>ABV</th>
                <th>Availability</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id} className="group">
                  <td>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                        style={{
                          background: "var(--mc-secondary)",
                          border: "1px solid var(--mc-border)",
                        }}
                      >
                        <Package
                          className="w-4 h-4"
                          style={{ color: "var(--mc-text-muted)" }}
                          strokeWidth={1.5}
                        />
                      </div>
                      <div>
                        <p
                          className="text-sm font-medium"
                          style={{ color: "var(--mc-text-primary)" }}
                        >
                          {product.name}
                        </p>
                        {product.brand && (
                          <p
                            className="text-xs"
                            style={{ color: "var(--mc-text-muted)" }}
                          >
                            {product.brand}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      className="text-sm capitalize"
                      style={{ color: "var(--mc-text-secondary)" }}
                    >
                      {product.category}
                    </span>
                  </td>
                  <td>
                    <span
                      className="text-sm"
                      style={{
                        color: "var(--mc-text-secondary)",
                        fontFamily: "var(--font-jetbrains), monospace",
                        fontSize: "0.8125rem",
                      }}
                    >
                      {product.size_ml ? `${product.size_ml}ml` : "—"}
                    </span>
                  </td>
                  <td>
                    <span
                      className="text-sm"
                      style={{
                        color: "var(--mc-text-secondary)",
                        fontFamily: "var(--font-jetbrains), monospace",
                        fontSize: "0.8125rem",
                      }}
                    >
                      {product.abv ? `${product.abv}%` : "—"}
                    </span>
                  </td>
                  <td>
                    {product.inventory ? (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium"
                        style={{
                          background: INVENTORY_CONFIG[product.inventory.status].bg,
                          color: INVENTORY_CONFIG[product.inventory.status].text,
                          border: `1px solid ${INVENTORY_CONFIG[product.inventory.status].border}`,
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            background: INVENTORY_CONFIG[product.inventory.status].dot,
                          }}
                        />
                        {INVENTORY_LABELS[product.inventory.status]}
                        {product.inventory.on_hand_qty !== null && (
                          <span style={{ color: "var(--mc-text-muted)", fontWeight: 400 }}>
                            ({product.inventory.on_hand_qty})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span
                        className="text-sm"
                        style={{ color: "var(--mc-text-muted)" }}
                      >
                        —
                      </span>
                    )}
                  </td>
                  <td>
                    <span
                      className="text-xs"
                      style={{
                        color: "var(--mc-text-muted)",
                        fontFamily: "var(--font-jetbrains), monospace",
                        fontSize: "0.6875rem",
                      }}
                    >
                      {product.inventory?.updated_at
                        ? new Date(
                            product.inventory.updated_at
                          ).toLocaleDateString("de-DE")
                        : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p
        className="text-xs"
        style={{
          color: "var(--mc-text-muted)",
          fontFamily: "var(--font-manrope), sans-serif",
        }}
      >
        Availability reflects the latest confirmed allocation.
      </p>
    </div>
  );
}
