"use client";

import { useState } from "react";
import type { Product } from "@mecanova/shared";
import { PRODUCT_CATEGORIES } from "@mecanova/shared";
import { Search, ChevronDown, ChevronRight, Package } from "lucide-react";

type ProductWithSupplier = Product & { supplier_name?: string };

interface Props {
  products: ProductWithSupplier[];
  suppliers: { id: string; name: string }[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
}

type StatusFilter = "all" | "active" | "inactive";

const CATEGORY_LABELS: Record<string, string> = {
  tequila: "Tequila",
  mezcal: "Mezcal",
  raicilla: "Raicilla",
  other: "Other",
};

interface Group {
  key: string;
  label: string;
  products: ProductWithSupplier[];
}

export default function ProductsSidebar({ products, suppliers, selectedId, loading, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.brand || "").toLowerCase().includes(q) ||
      (p.sku || "").toLowerCase().includes(q);

    const matchesSupplier =
      supplierFilter === "all" || p.supplier_id === supplierFilter;

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" ? p.active : !p.active);

    return matchesSearch && matchesSupplier && matchesStatus;
  });

  const allGroups: Group[] = PRODUCT_CATEGORIES.map((c) => ({
    key: c,
    label: CATEGORY_LABELS[c] ?? c,
    products: filtered.filter((p) => p.category === c),
  }));

  const visibleGroups = allGroups.filter((g) => g.products.length > 0);

  const toggleGroup = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div
      style={{
        width: 300,
        flexShrink: 0,
        borderRight: "1px solid var(--mc-border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Search */}
      <div style={{ padding: "12px 12px 10px", borderBottom: "1px solid var(--mc-border)" }}>
        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3"
            style={{ color: "var(--mc-text-muted)" }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mc-input w-full"
            style={{ paddingLeft: 28, fontSize: "0.6875rem", height: 32 }}
            placeholder="Search products…"
          />
        </div>
      </div>

      {/* Supplier + status filter */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--mc-border)",
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          alignItems: "center",
        }}
      >
        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="mc-input"
          style={{ fontSize: "0.5625rem", height: 22, padding: "0 6px", flex: 1, minWidth: 64 }}
        >
          <option value="all">All Suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="mc-input"
          style={{ fontSize: "0.5625rem", height: 22, padding: "0 6px", minWidth: 64, marginLeft: "auto" }}
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Groups */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: 12 }} className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="mc-skeleton h-8" />
            ))}
          </div>
        ) : visibleGroups.length === 0 ? (
          <div
            style={{ padding: 24, textAlign: "center", color: "var(--mc-text-muted)", fontSize: "0.6875rem" }}
          >
            No products found
          </div>
        ) : (
          visibleGroups.map((group) => {
            const isCollapsed = !!collapsed[group.key];
            return (
              <div key={group.key}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.key)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "7px 12px",
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid var(--mc-border)",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(236,223,204,0.03)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {isCollapsed ? (
                      <ChevronRight className="w-3 h-3" style={{ color: "var(--mc-text-muted)" }} />
                    ) : (
                      <ChevronDown className="w-3 h-3" style={{ color: "var(--mc-text-muted)" }} />
                    )}
                    <span
                      style={{
                        fontSize: "0.5625rem",
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--mc-text-muted)",
                      }}
                    >
                      {group.label}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "0.5625rem",
                      padding: "0 4px",
                      background: "var(--mc-surface-elevated)",
                      border: "1px solid var(--mc-border)",
                      color: "var(--mc-text-muted)",
                    }}
                  >
                    {group.products.length}
                  </span>
                </button>

                {/* Product rows */}
                {!isCollapsed &&
                  group.products.map((p) => {
                    const isSelected = p.id === selectedId;
                    const isInactive = !p.active;

                    return (
                      <button
                        key={p.id}
                        onClick={() => onSelect(p.id)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "9px 12px",
                          background: isSelected ? "rgba(236,223,204,0.08)" : "transparent",
                          border: "none",
                          borderLeft: isSelected ? "2px solid var(--mc-cream)" : "2px solid transparent",
                          borderBottom: "1px solid var(--mc-border)",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected)
                            e.currentTarget.style.background = "rgba(236,223,204,0.04)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = "transparent";
                        }}
                      >
                        {/* Icon */}
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "rgba(236, 223, 204, 0.04)",
                            border: "1px solid var(--mc-border)",
                          }}
                        >
                          <Package className="w-3 h-3" style={{ color: "var(--mc-cream-subtle)" }} />
                        </div>

                        {/* Name + brand */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              fontSize: "0.6875rem",
                              fontWeight: 500,
                              color: isSelected ? "var(--mc-cream)" : "var(--mc-text-primary)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              margin: 0,
                            }}
                          >
                            {p.name}
                          </p>
                          {p.brand && (
                            <p
                              style={{
                                fontSize: "0.5625rem",
                                color: "var(--mc-text-muted)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                margin: 0,
                              }}
                            >
                              {p.brand}
                            </p>
                          )}
                        </div>

                        {/* Status dot */}
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            flexShrink: 0,
                            background: isInactive ? "var(--mc-error)" : "var(--mc-success)",
                            opacity: 0.7,
                          }}
                        />
                      </button>
                    );
                  })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
