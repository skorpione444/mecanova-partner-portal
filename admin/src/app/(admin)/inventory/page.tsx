"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import type { InventoryStatus } from "@mecanova/shared";
import { INVENTORY_STATUS_LABELS } from "@mecanova/shared";
import { Warehouse, Search, Save, History } from "lucide-react";

type InventoryRow = InventoryStatus & {
  distributor_name: string;
  product_name: string;
};

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [movements, setMovements] = useState<
    {
      id: string;
      distributor_name: string;
      product_name: string;
      movement_type: string;
      qty_delta: number;
      created_at: string;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [saving, setSaving] = useState(false);
  const [showMovements, setShowMovements] = useState(false);
  const supabase = createClient();

  const loadInventory = useCallback(async () => {
    setLoading(true);

    const [invRes, movRes] = await Promise.all([
      supabase.from("inventory_status").select("*"),
      supabase
        .from("inventory_movements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const invData = invRes.data || [];
    const movData = movRes.data || [];

    // Collect all IDs
    const distIds = new Set<string>();
    const prodIds = new Set<string>();
    invData.forEach((i) => {
      distIds.add(i.distributor_id);
      prodIds.add(i.product_id);
    });
    movData.forEach((m) => {
      distIds.add(m.distributor_id);
      prodIds.add(m.product_id);
    });

    const [distsRes, prodsRes] = await Promise.all([
      distIds.size > 0
        ? supabase
            .from("partners")
            .select("id, name")
            .in("id", [...distIds])
        : Promise.resolve({ data: [] }),
      prodIds.size > 0
        ? supabase
            .from("products")
            .select("id, name")
            .in("id", [...prodIds])
        : Promise.resolve({ data: [] }),
    ]);

    const distMap = new Map(
      (distsRes.data || []).map((d) => [d.id, d.name])
    );
    const prodMap = new Map(
      (prodsRes.data || []).map((p) => [p.id, p.name])
    );

    setInventory(
      invData.map((i) => ({
        ...i,
        distributor_name: distMap.get(i.distributor_id) || "Unknown",
        product_name: prodMap.get(i.product_id) || "Unknown",
      }))
    );

    setMovements(
      movData.map((m) => ({
        id: m.id,
        distributor_name: distMap.get(m.distributor_id) || "Unknown",
        product_name: prodMap.get(m.product_id) || "Unknown",
        movement_type: m.movement_type,
        qty_delta: m.qty_delta,
        created_at: m.created_at,
      }))
    );

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const handleSaveQty = async (row: InventoryRow) => {
    if (!editQty) return;
    setSaving(true);

    const newQty = parseInt(editQty);
    const delta = newQty - row.on_hand_qty;

    await Promise.all([
      supabase
        .from("inventory_status")
        .update({
          on_hand_qty: newQty,
          status: newQty <= 0 ? "out" : newQty < 10 ? "limited" : "in_stock",
          updated_at: new Date().toISOString(),
        })
        .eq("product_id", row.product_id)
        .eq("distributor_id", row.distributor_id),
      supabase.from("inventory_movements").insert({
        distributor_id: row.distributor_id,
        product_id: row.product_id,
        movement_type: "admin_adjustment",
        qty_delta: delta,
      }),
    ]);

    setEditing(null);
    setEditQty("");
    setSaving(false);
    loadInventory();
  };

  const filtered = inventory.filter((i) => {
    const matchesSearch =
      i.distributor_name.toLowerCase().includes(search.toLowerCase()) ||
      i.product_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || i.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div>
        <div className="mc-skeleton h-8 w-48 mb-6" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="mc-skeleton h-14" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        description={`${inventory.length} stock records across distributors`}
        icon={Warehouse}
        actions={
          <button
            onClick={() => setShowMovements(!showMovements)}
            className="mc-btn mc-btn-ghost"
          >
            <History className="w-3.5 h-3.5" />
            {showMovements ? "Stock Levels" : "Movement Log"}
          </button>
        }
      />

      {!showMovements ? (
        <>
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
                placeholder="Search product or distributor..."
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mc-input mc-select w-auto min-w-[140px]"
            >
              <option value="all">All Status</option>
              <option value="in_stock">In Stock</option>
              <option value="limited">Limited</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={Warehouse}
              title="No inventory records"
              description="Inventory records will appear when products are allocated to distributors"
            />
          ) : (
            <div className="mc-card overflow-hidden">
              <table className="mc-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Distributor</th>
                    <th>On Hand</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const key = `${row.product_id}-${row.distributor_id}`;
                    const isEditing = editing === key;
                    return (
                      <tr key={key}>
                        <td>
                          <span
                            className="text-xs font-medium"
                            style={{ color: "var(--mc-text-primary)" }}
                          >
                            {row.product_name}
                          </span>
                        </td>
                        <td>{row.distributor_name}</td>
                        <td>
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={editQty}
                                onChange={(e) => setEditQty(e.target.value)}
                                className="mc-input w-20"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveQty(row)}
                                disabled={saving}
                                className="mc-btn mc-btn-primary"
                                style={{ padding: "4px 8px" }}
                              >
                                <Save className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <span
                              className="text-sm font-medium cursor-pointer"
                              style={{ color: "var(--mc-text-primary)" }}
                              onClick={() => {
                                setEditing(key);
                                setEditQty(row.on_hand_qty.toString());
                              }}
                              title="Click to edit"
                            >
                              {row.on_hand_qty}
                            </span>
                          )}
                        </td>
                        <td>
                          <span
                            className="inline-flex px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
                            style={{
                              background:
                                row.status === "in_stock"
                                  ? "var(--mc-success-bg)"
                                  : row.status === "limited"
                                  ? "var(--mc-warning-bg)"
                                  : "var(--mc-error-bg)",
                              border: `1px solid ${
                                row.status === "in_stock"
                                  ? "var(--mc-success-light)"
                                  : row.status === "limited"
                                  ? "var(--mc-warning-light)"
                                  : "var(--mc-error-light)"
                              }`,
                              color:
                                row.status === "in_stock"
                                  ? "var(--mc-success)"
                                  : row.status === "limited"
                                  ? "var(--mc-warning)"
                                  : "var(--mc-error)",
                            }}
                          >
                            {INVENTORY_STATUS_LABELS[row.status]}
                          </span>
                        </td>
                        <td>
                          {new Date(row.updated_at).toLocaleDateString(
                            "en-GB",
                            { day: "2-digit", month: "short" }
                          )}
                        </td>
                        <td>
                          {row.note && (
                            <span
                              className="text-[10px]"
                              style={{ color: "var(--mc-text-muted)" }}
                              title={row.note}
                            >
                              📝
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        /* Movement Log */
        <div className="mc-card overflow-hidden">
          <table className="mc-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Distributor</th>
                <th>Type</th>
                <th>Qty Change</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-8 text-xs"
                    style={{ color: "var(--mc-text-muted)" }}
                  >
                    No movement history
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {new Date(m.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td>{m.product_name}</td>
                    <td>{m.distributor_name}</td>
                    <td>
                      <span
                        className="text-[10px] font-medium tracking-wide uppercase"
                        style={{ color: "var(--mc-text-tertiary)" }}
                      >
                        {m.movement_type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          color:
                            m.qty_delta > 0
                              ? "var(--mc-success)"
                              : "var(--mc-error)",
                        }}
                      >
                        {m.qty_delta > 0 ? "+" : ""}
                        {m.qty_delta}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

