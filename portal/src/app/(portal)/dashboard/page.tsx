"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  FileText,
  ShoppingCart,
  Receipt,
  AlertCircle,
  Warehouse,
  AlertTriangle,
  Truck,
} from "lucide-react";

export default function DashboardPage() {
  const [profile, setProfile] = useState<{
    full_name: string | null;
    role: string;
    partner_id: string | null;
  } | null>(null);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [distributorName, setDistributorName] = useState<string | null>(null);
  const [openInvoiceCount, setOpenInvoiceCount] = useState<number>(0);
  const [inventoryStats, setInventoryStats] = useState<{
    productsTracked: number;
    totalBottles: number;
    totalCases: number;
    lowStockCount: number;
    availableCount: number;
    outOfStockCount: number;
  } | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, role, partner_id")
        .eq("user_id", user.id)
        .single();

      if (prof) {
        setProfile(prof);
        if (prof.partner_id) {
          const { data: partner } = await supabase
            .from("partners")
            .select("name")
            .eq("id", prof.partner_id)
            .single();
          if (partner) setPartnerName(partner.name);

          if (prof.role === "client") {
            const { data: cd } = await supabase
              .from("client_distributors")
              .select("distributor_id")
              .eq("client_id", prof.partner_id)
              .eq("is_default", true)
              .single();
            if (cd) {
              const { data: dist } = await supabase
                .from("partners")
                .select("name")
                .eq("id", cd.distributor_id)
                .single();
              if (dist) setDistributorName(dist.name);

              // Load client inventory stats from their distributor
              const { data: invRows } = await supabase
                .from("inventory_status")
                .select("product_id, on_hand_qty, status")
                .eq("distributor_id", cd.distributor_id);

              if (invRows) {
                const availableCount = invRows.filter(r => r.status === "in_stock" || r.status === "limited").length;
                const outOfStockCount = invRows.filter(r => r.status === "out").length;

                setInventoryStats({
                  productsTracked: invRows.length,
                  totalBottles: 0,
                  totalCases: 0,
                  lowStockCount: 0,
                  availableCount,
                  outOfStockCount,
                });
              }
            }
          }

          // Load distributor inventory stats
          if (prof.role === "distributor") {
            const { data: invRows } = await supabase
              .from("inventory_status")
              .select("product_id, on_hand_qty, status")
              .eq("distributor_id", prof.partner_id);

            if (invRows) {
              const { data: prods } = await supabase
                .from("products")
                .select("id, case_size")
                .eq("active", true);
              const prodMap = new Map((prods || []).map(p => [p.id, p.case_size || 6]));

              const totalCases = invRows.reduce((sum, r) => sum + r.on_hand_qty, 0);
              const totalBottles = invRows.reduce((sum, r) => sum + r.on_hand_qty * (prodMap.get(r.product_id) || 6), 0);
              const lowStockCount = invRows.filter(r => r.status === "limited" || r.status === "out").length;

              setInventoryStats({
                productsTracked: invRows.length,
                totalBottles,
                totalCases,
                lowStockCount,
                availableCount: 0,
                outOfStockCount: 0,
              });
            }
          }

          // Count open invoices
          const invoiceCol =
            prof.role === "distributor" ? "distributor_id" : "client_id";
          const { count } = await supabase
            .from("invoices")
            .select("id", { count: "exact", head: true })
            .eq(invoiceCol, prof.partner_id)
            .in("status", ["sent", "overdue"]);
          setOpenInvoiceCount(count ?? 0);
        }
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const greeting = profile?.full_name
    ? `Welcome back, ${profile.full_name}`
    : "Welcome to Mecanova";

  return (
    <div>
      <PageHeader
        title={greeting}
        description={
          partnerName
            ? `${partnerName}${distributorName ? ` · Distributor: ${distributorName}` : ""}`
            : undefined
        }
        icon={LayoutDashboard}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mc-stagger">
        {/* Open Invoices Widget */}
        <Link
          href="/invoices"
          className="mc-card p-5 group transition-all hover:translate-y-[-1px]"
          style={{ cursor: "pointer" }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Receipt
              className="w-5 h-5"
              style={{ color: "var(--mc-cream-subtle)" }}
              strokeWidth={1.5}
            />
            <span
              className="text-sm font-medium"
              style={{ color: "var(--mc-text-primary)" }}
            >
              Open Invoices
            </span>
          </div>
          <div className="flex items-end justify-between">
            <span
              className="text-xl font-semibold tracking-tight"
              style={{
                color:
                  openInvoiceCount > 0
                    ? "var(--mc-warning)"
                    : "var(--mc-text-primary)",
              }}
            >
              {openInvoiceCount}
            </span>
            {openInvoiceCount > 0 && (
              <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--mc-warning)" }}>
                <AlertCircle className="w-3 h-3" />
                needs attention
              </span>
            )}
          </div>
        </Link>

        <Link
          href="/products"
          className="mc-card p-5 group transition-all hover:translate-y-[-1px]"
          style={{ cursor: "pointer" }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Package
              className="w-5 h-5"
              style={{ color: "var(--mc-cream-subtle)" }}
              strokeWidth={1.5}
            />
            <span
              className="text-sm font-medium"
              style={{ color: "var(--mc-text-primary)" }}
            >
              Products
            </span>
          </div>
          <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
            Browse the product catalogue and download assets
          </p>
        </Link>

        <Link
          href="/orders"
          className="mc-card p-5 group transition-all hover:translate-y-[-1px]"
          style={{ cursor: "pointer" }}
        >
          <div className="flex items-center gap-3 mb-2">
            <ShoppingCart
              className="w-5 h-5"
              style={{ color: "var(--mc-cream-subtle)" }}
              strokeWidth={1.5}
            />
            <span
              className="text-sm font-medium"
              style={{ color: "var(--mc-text-primary)" }}
            >
              Orders
            </span>
          </div>
          <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
            Create and track your orders
          </p>
        </Link>

        {/* 4th card: Buy Products for distributors, Documents for clients */}
        {profile?.role === "distributor" ? (
          <Link
            href="/supply-orders/new"
            className="mc-card p-5 group transition-all hover:translate-y-[-1px]"
            style={{ cursor: "pointer" }}
          >
            <div className="flex items-center gap-3 mb-2">
              <Truck
                className="w-5 h-5"
                style={{ color: "var(--mc-cream-subtle)" }}
                strokeWidth={1.5}
              />
              <span
                className="text-sm font-medium"
                style={{ color: "var(--mc-text-primary)" }}
              >
                Buy Products
              </span>
            </div>
            <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
              Order products from Mecanova
            </p>
          </Link>
        ) : (
          <Link
            href="/products"
            className="mc-card p-5 group transition-all hover:translate-y-[-1px]"
            style={{ cursor: "pointer" }}
          >
            <div className="flex items-center gap-3 mb-2">
              <FileText
                className="w-5 h-5"
                style={{ color: "var(--mc-cream-subtle)" }}
                strokeWidth={1.5}
              />
              <span
                className="text-sm font-medium"
                style={{ color: "var(--mc-text-primary)" }}
              >
                Documents
              </span>
            </div>
            <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
              Access presentations, fact sheets, and compliance documents
            </p>
          </Link>
        )}
      </div>

      {/* Inventory Overview */}
      {inventoryStats && (
        <div className="mt-6">
          <h2
            className="text-xs font-semibold tracking-[0.08em] uppercase mb-3"
            style={{ color: "var(--mc-text-muted)" }}
          >
            {profile?.role === "distributor" ? "Inventory Overview" : "Product Availability"}
          </h2>
          {profile?.role === "client" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link href="/products" className="mc-card p-4 transition-all hover:translate-y-[-1px]">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4" style={{ color: "var(--mc-success)" }} strokeWidth={1.5} />
                  <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: "var(--mc-text-muted)" }}>
                    Available Products
                  </span>
                </div>
                <span className="text-xl font-semibold" style={{ color: "var(--mc-success)" }}>
                  {inventoryStats.availableCount}
                </span>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--mc-text-muted)" }}>
                  in stock at your distributor
                </p>
              </Link>
              <div className="mc-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4" style={{ color: inventoryStats.outOfStockCount > 0 ? "var(--mc-error)" : "var(--mc-cream-subtle)" }} strokeWidth={1.5} />
                  <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: "var(--mc-text-muted)" }}>
                    Out of Stock
                  </span>
                </div>
                <span className="text-xl font-semibold" style={{ color: inventoryStats.outOfStockCount > 0 ? "var(--mc-error)" : "var(--mc-text-primary)" }}>
                  {inventoryStats.outOfStockCount}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link href="/inventory" className="mc-card p-4 transition-all hover:translate-y-[-1px]">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4" style={{ color: "var(--mc-cream-subtle)" }} strokeWidth={1.5} />
                  <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: "var(--mc-text-muted)" }}>
                    Products Tracked
                  </span>
                </div>
                <span className="text-xl font-semibold" style={{ color: "var(--mc-text-primary)" }}>
                  {inventoryStats.productsTracked}
                </span>
              </Link>
              <div className="mc-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Warehouse className="w-4 h-4" style={{ color: "var(--mc-cream-subtle)" }} strokeWidth={1.5} />
                  <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: "var(--mc-text-muted)" }}>
                    Total Stock
                  </span>
                </div>
                <span className="text-xl font-semibold" style={{ color: "var(--mc-text-primary)" }}>
                  {inventoryStats.totalBottles.toLocaleString()}
                  <span className="text-xs font-normal ml-1.5" style={{ color: "var(--mc-text-muted)" }}>
                    btl ({inventoryStats.totalCases.toLocaleString()} cs)
                  </span>
                </span>
              </div>
              <div className="mc-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4" style={{ color: inventoryStats.lowStockCount > 0 ? "var(--mc-warning)" : "var(--mc-cream-subtle)" }} strokeWidth={1.5} />
                  <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: "var(--mc-text-muted)" }}>
                    Low / Out of Stock
                  </span>
                </div>
                <span className="text-xl font-semibold" style={{ color: inventoryStats.lowStockCount > 0 ? "var(--mc-warning)" : "var(--mc-text-primary)" }}>
                  {inventoryStats.lowStockCount}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
