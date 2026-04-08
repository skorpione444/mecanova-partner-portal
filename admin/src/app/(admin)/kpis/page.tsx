"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import FunnelBar from "@/components/FunnelBar";
import CostBreakdownBar from "@/components/CostBreakdownBar";
import KPIInputPanel from "@/components/KPIInputPanel";
import {
  BarChart3,
  CalendarClock,
  Users,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  RefreshCw,
  Package,
  MapPin,
  Clock,
  ArrowRight,
} from "lucide-react";

interface KPIData {
  targetDate: string | null;
  daysToMarket: number | null;
  distributorPipeline: { contacted: number; in_conversation: number; committed: number };
  clientPipeline: { contacted: number; in_conversation: number; committed: number };
  landedCosts: {
    productId: string;
    productName: string;
    total: number;
    breakdown: { label: string; value: number }[];
  }[];
}

interface Product {
  id: string;
  name: string;
}

export default function KPIsPage() {
  const [data, setData] = useState<KPIData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadData = useCallback(async () => {
    // Fetch latest snapshot per kpi_type + products
    const [latestRes, productsRes] = await Promise.all([
      supabase
        .from("kpi_manual_entries")
        .select("*")
        .in("kpi_type", [
          "target_launch_date",
          "pipeline_distributor",
          "pipeline_client",
        ])
        .order("recorded_at", { ascending: false })
        .limit(50),
      supabase.from("products").select("id, name").eq("active", true),
    ]);

    const prods = productsRes.data || [];
    setProducts(prods);

    // Get latest per type
    const rows = latestRes.data || [];
    const latest: Record<string, (typeof rows)[0]> = {};
    for (const row of rows) {
      if (!latest[row.kpi_type]) latest[row.kpi_type] = row;
    }

    const targetJson = latest.target_launch_date?.value_json as Record<string, unknown> | null;
    const targetDateStr = targetJson?.date as string | undefined;
    let daysToMarket: number | null = null;
    if (targetDateStr) {
      const diff = new Date(targetDateStr).getTime() - Date.now();
      daysToMarket = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    const defaultPipeline = { contacted: 0, in_conversation: 0, committed: 0 };
    const distPipeline = (latest.pipeline_distributor?.value_json as KPIData["distributorPipeline"] | null) ?? defaultPipeline;
    const clientPipeline = (latest.pipeline_client?.value_json as KPIData["clientPipeline"] | null) ?? defaultPipeline;

    // Landed costs per product
    const { data: costRows } = await supabase
      .from("kpi_manual_entries")
      .select("*")
      .eq("kpi_type", "landed_cost")
      .order("recorded_at", { ascending: false })
      .limit(100);

    const costByProduct: Record<string, (typeof costRows extends (infer T)[] | null ? T : never)> = {};
    for (const row of costRows || []) {
      if (row.product_id && !costByProduct[row.product_id]) {
        costByProduct[row.product_id] = row;
      }
    }

    const prodMap = new Map(prods.map((p) => [p.id, p.name]));
    const landedCosts = Object.entries(costByProduct).map(([productId, row]) => {
      const json = row.value_json as Record<string, number> | null;
      const breakdown = json
        ? Object.entries(json).map(([label, value]) => ({
            label: label.charAt(0).toUpperCase() + label.slice(1),
            value: Number(value),
          }))
        : [];
      return {
        productId,
        productName: prodMap.get(productId) || "Unknown",
        total: Number(row.value_numeric ?? 0),
        breakdown,
      };
    });

    setData({
      targetDate: targetDateStr || null,
      daysToMarket,
      distributorPipeline: distPipeline,
      clientPipeline: clientPipeline,
      landedCosts,
    });
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaved = () => {
    setLoading(true);
    loadData();
  };

  const formatEUR = (n: number) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

  if (loading) {
    return (
      <div>
        <div className="mc-skeleton h-8 w-48 mb-6" />
        <div className="mc-skeleton h-14 mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {[1, 2].map((i) => (
            <div key={i} className="mc-skeleton h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="mc-skeleton h-40" />
          ))}
        </div>
      </div>
    );
  }

  const PHASE2_CARDS = [
    { label: "Revenue", icon: DollarSign },
    { label: "Gross Margin", icon: TrendingUp },
    { label: "Reorder Rate", icon: RefreshCw },
    { label: "Avg Order Value", icon: ShoppingCart },
    { label: "AR Aging", icon: Clock },
    { label: "Active Partners", icon: MapPin },
  ];

  return (
    <div>
      <PageHeader
        title="KPIs"
        description="Key performance indicators and business metrics"
        icon={BarChart3}
      />

      {/* Input Panel */}
      <KPIInputPanel products={products} onSaved={handleSaved} />

      {/* Section A — Launch Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 mc-stagger">
        {/* Finance pointer */}
        <a
          href="/finance"
          className="mc-card mc-card-interactive p-5 flex items-start justify-between"
        >
          <div>
            <p
              className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-2"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Cash & Runway
            </p>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--mc-text-primary)" }}
            >
              Moved to Finance
            </p>
            <p className="text-[11px] mt-1" style={{ color: "var(--mc-text-muted)" }}>
              Bank balance, burn rate, and runway are now live in the Finance dashboard.
            </p>
          </div>
          <div
            className="w-9 h-9 flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(236,223,204,0.08)" }}
          >
            <ArrowRight className="w-[18px] h-[18px]" style={{ color: "var(--mc-cream)" }} strokeWidth={1.5} />
          </div>
        </a>

        <div className="mc-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p
                className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-2"
                style={{ color: "var(--mc-text-muted)" }}
              >
                Days to Market
              </p>
              <p
                className="text-2xl font-medium"
                style={{
                  fontFamily: "var(--font-jost), Jost, sans-serif",
                  color: "var(--mc-info)",
                }}
              >
                {data?.daysToMarket !== null ? `${data?.daysToMarket} days` : "\u2014"}
              </p>
              {data?.targetDate && (
                <p className="text-[11px] mt-1" style={{ color: "var(--mc-text-tertiary)" }}>
                  Target: {new Date(data.targetDate).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
            <div
              className="w-9 h-9 flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--mc-info-bg)" }}
            >
              <CalendarClock
                className="w-[18px] h-[18px]"
                style={{ color: "var(--mc-info)" }}
                strokeWidth={1.5}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section B — Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="mc-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4" style={{ color: "var(--mc-cream-subtle)" }} strokeWidth={1.5} />
            <h3
              className="text-xs font-semibold tracking-[0.08em] uppercase"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Distributor Pipeline
            </h3>
            <span
              className="ml-auto text-xs font-mono"
              style={{ color: "var(--mc-text-tertiary)" }}
            >
              {(data?.distributorPipeline.contacted ?? 0) +
                (data?.distributorPipeline.in_conversation ?? 0) +
                (data?.distributorPipeline.committed ?? 0)}{" "}
              total
            </span>
          </div>
          <FunnelBar
            stages={[
              {
                label: "Contacted",
                count: data?.distributorPipeline.contacted ?? 0,
                color: "var(--mc-cream-faint)",
              },
              {
                label: "In Conversation",
                count: data?.distributorPipeline.in_conversation ?? 0,
                color: "var(--mc-warning)",
              },
              {
                label: "Committed",
                count: data?.distributorPipeline.committed ?? 0,
                color: "var(--mc-success)",
              },
            ]}
          />
          {(() => {
            const c = data?.distributorPipeline.contacted ?? 0;
            const conv = data?.distributorPipeline.in_conversation ?? 0;
            const comm = data?.distributorPipeline.committed ?? 0;
            if (c === 0) return null;
            return (
              <p className="text-[10px] mt-2" style={{ color: "var(--mc-text-muted)" }}>
                {c > 0 && `${Math.round((conv / c) * 100)}% contacted → conversation`}
                {conv > 0 && ` · ${Math.round((comm / conv) * 100)}% conversation → committed`}
              </p>
            );
          })()}
        </div>

        <div className="mc-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="w-4 h-4" style={{ color: "var(--mc-cream-subtle)" }} strokeWidth={1.5} />
            <h3
              className="text-xs font-semibold tracking-[0.08em] uppercase"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Client Pipeline Frankfurt
            </h3>
            <span
              className="ml-auto text-xs font-mono"
              style={{ color: "var(--mc-text-tertiary)" }}
            >
              {(data?.clientPipeline.contacted ?? 0) +
                (data?.clientPipeline.in_conversation ?? 0) +
                (data?.clientPipeline.committed ?? 0)}{" "}
              total
            </span>
          </div>
          <FunnelBar
            stages={[
              {
                label: "Contacted",
                count: data?.clientPipeline.contacted ?? 0,
                color: "var(--mc-cream-faint)",
              },
              {
                label: "In Conversation",
                count: data?.clientPipeline.in_conversation ?? 0,
                color: "var(--mc-warning)",
              },
              {
                label: "Committed",
                count: data?.clientPipeline.committed ?? 0,
                color: "var(--mc-success)",
              },
            ]}
          />
          {(() => {
            const c = data?.clientPipeline.contacted ?? 0;
            const conv = data?.clientPipeline.in_conversation ?? 0;
            const comm = data?.clientPipeline.committed ?? 0;
            if (c === 0) return null;
            return (
              <p className="text-[10px] mt-2" style={{ color: "var(--mc-text-muted)" }}>
                {c > 0 && `${Math.round((conv / c) * 100)}% contacted → conversation`}
                {conv > 0 && ` · ${Math.round((comm / conv) * 100)}% conversation → committed`}
              </p>
            );
          })()}
        </div>
      </div>

      {/* Section C — Unit Economics */}
      <div className="mc-card p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-4 h-4" style={{ color: "var(--mc-cream-subtle)" }} strokeWidth={1.5} />
          <h3
            className="text-xs font-semibold tracking-[0.08em] uppercase"
            style={{ color: "var(--mc-text-muted)" }}
          >
            Landed Cost per Bottle
          </h3>
        </div>

        {data?.landedCosts && data.landedCosts.length > 0 ? (
          <div className="space-y-4">
            {data.landedCosts.map((item) => (
              <div key={item.productId}>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--mc-text-primary)" }}
                  >
                    {item.productName}
                  </span>
                  <span
                    className="text-xs font-mono"
                    style={{ color: "var(--mc-text-muted)" }}
                  >
                    {formatEUR(item.total)}/bottle
                  </span>
                </div>
                <CostBreakdownBar costs={item.breakdown} total={item.total} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
            No landed cost data yet. Use &quot;Update Metrics&quot; to add cost breakdowns per product.
          </p>
        )}
      </div>

      {/* Section D — Post-Launch Metrics Placeholder */}
      <div>
        <h3
          className="text-xs font-semibold tracking-[0.08em] uppercase mb-3"
          style={{ color: "var(--mc-text-muted)" }}
        >
          Post-Launch Metrics
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {PHASE2_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="mc-card p-4"
                style={{ opacity: 0.45 }}
              >
                <div
                  className="w-8 h-8 flex items-center justify-center mb-2"
                  style={{ background: "var(--mc-surface-warm)" }}
                >
                  <Icon
                    className="w-4 h-4"
                    style={{ color: "var(--mc-text-muted)" }}
                    strokeWidth={1.5}
                  />
                </div>
                <p
                  className="text-[10px] font-semibold tracking-[0.06em] uppercase mb-1"
                  style={{ color: "var(--mc-text-muted)" }}
                >
                  {card.label}
                </p>
                <p
                  className="text-[9px]"
                  style={{ color: "var(--mc-text-muted)" }}
                >
                  Activates when orders begin
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
