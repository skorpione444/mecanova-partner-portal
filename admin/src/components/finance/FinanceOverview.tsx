"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import RunwayGauge from "@/components/RunwayGauge";
import SparklineCSS from "@/components/SparklineCSS";
import StatCard from "@/components/StatCard";
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  BarChart3,
  Clock,
} from "lucide-react";

interface MonthlyBucket {
  label: string;
  income: number;
  costs: number;
}

interface OverviewData {
  balance: number | null;
  balanceSource: "holvi" | "transactions" | null;
  plThisMonth: number;
  incomeThisMonth: number;
  costsThisMonth: number;
  burnRate: number; // avg monthly spend last 3 months
  runwayMonths: number;
  trend: MonthlyBucket[];
  uncategorizedCount: number;
  overdueInvoicesCount: number;
  lastSynced: string | null;
}

const formatEUR = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

function buildMonthBuckets(
  rows: { transaction_date: string; amount: number; direction: string }[]
): MonthlyBucket[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const label = d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });

    let income = 0;
    let costs = 0;
    for (const r of rows) {
      const [rYear, rMonth] = r.transaction_date.split("-").map(Number);
      if (rYear === year && rMonth === month) {
        if (r.direction === "in") income += r.amount;
        else costs += r.amount;
      }
    }
    return { label, income, costs };
  });
}

export default function FinanceOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    // New tables not yet in generated types — remove cast after `npm run sb:pull`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // Fetch balance from Holvi API
    let balance: number | null = null;
    let balanceSource: OverviewData["balanceSource"] = null;
    try {
      const res = await fetch("/api/holvi/balance");
      if (res.ok) {
        const json = await res.json();
        balance = json.balance;
        balanceSource = "holvi";
      }
    } catch {
      // Holvi not configured — fall through
    }

    // Fetch last 6 months of transactions for trend + P&L
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [txRes, uncatRes, overdueRes, syncRes] = await Promise.all([
      db
        .from("bank_transactions")
        .select("transaction_date, amount, direction, cost_type")
        .gte("transaction_date", sixMonthsAgo.toISOString().split("T")[0])
        .order("transaction_date", { ascending: true }),
      db
        .from("bank_transactions")
        .select("id", { count: "exact", head: true })
        .eq("cost_type", "uncategorized"),
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("status", "overdue"),
      db
        .from("holvi_sync_log")
        .select("synced_at")
        .eq("status", "success")
        .order("synced_at", { ascending: false })
        .limit(1),
    ]);

    const txRows = (txRes.data ?? []) as {
      transaction_date: string;
      amount: number;
      direction: string;
      cost_type: string;
    }[];

    // Current month P&L
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth() + 1;
    let incomeThisMonth = 0;
    let costsThisMonth = 0;

    // Last 3 months for burn rate (excluding current month)
    const burnMonthlyTotals: number[] = [0, 0, 0];

    for (const r of txRows) {
      const [rYear, rMonth] = r.transaction_date.split("-").map(Number);
      if (rYear === thisYear && rMonth === thisMonth) {
        if (r.direction === "in") incomeThisMonth += Number(r.amount);
        else costsThisMonth += Number(r.amount);
      }
      // Burn rate: last 3 completed months
      for (let i = 1; i <= 3; i++) {
        const bd = new Date(now.getFullYear(), now.getMonth() - i, 1);
        if (rYear === bd.getFullYear() && rMonth === bd.getMonth() + 1 && r.direction === "out") {
          burnMonthlyTotals[i - 1] += Number(r.amount);
        }
      }
    }

    const burnRate =
      burnMonthlyTotals.filter((v) => v > 0).length > 0
        ? burnMonthlyTotals.reduce((s, v) => s + v, 0) /
          Math.max(burnMonthlyTotals.filter((v) => v > 0).length, 1)
        : 0;

    // Fallback balance from transactions if Holvi not configured
    if (balance === null && txRows.length > 0) {
      let running = 0;
      for (const r of txRows) {
        running += r.direction === "in" ? Number(r.amount) : -Number(r.amount);
      }
      balance = running;
      balanceSource = "transactions";
    }

    const runwayMonths =
      burnRate > 0 && balance !== null
        ? Math.round((balance / burnRate) * 10) / 10
        : 0;

    const trend = buildMonthBuckets(txRows);
    const lastSynced = syncRes.data?.[0]?.synced_at ?? null;

    setData({
      balance,
      balanceSource,
      plThisMonth: incomeThisMonth - costsThisMonth,
      incomeThisMonth,
      costsThisMonth,
      burnRate,
      runwayMonths,
      trend,
      uncategorizedCount: uncatRes.count ?? 0,
      overdueInvoicesCount: overdueRes.count ?? 0,
      lastSynced,
    });
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="mc-skeleton h-28" />
          ))}
        </div>
        <div className="mc-skeleton h-48" />
      </div>
    );
  }

  if (!data) return null;

  const runwayColor: "success" | "warning" | "error" =
    data.runwayMonths > 6 ? "success" : data.runwayMonths >= 3 ? "warning" : "error";

  const plColor = data.plThisMonth >= 0 ? "var(--mc-success)" : "var(--mc-error)";
  const balanceNum = data.balance ?? 0;

  // 6-month chart scaling
  const maxVal = Math.max(...data.trend.flatMap((b) => [b.income, b.costs]), 1);

  return (
    <div className="space-y-6">
      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cash Balance */}
        <div className="mc-card p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p
                className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-2"
                style={{ color: "var(--mc-text-muted)" }}
              >
                Cash Balance
              </p>
              <p
                className="text-xl font-medium"
                style={{
                  fontFamily: "var(--font-jost), Jost, sans-serif",
                  color: "var(--mc-text-primary)",
                }}
              >
                {formatEUR(balanceNum)}
              </p>
              <p className="text-[10px] mt-1" style={{ color: "var(--mc-text-muted)" }}>
                {data.balanceSource === "holvi" ? "Live from Holvi" : data.balanceSource === "transactions" ? "Computed from transactions" : "No data"}
              </p>
            </div>
            <div
              className="w-9 h-9 flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(236,223,204,0.08)" }}
            >
              <Wallet className="w-[18px] h-[18px]" style={{ color: "var(--mc-cream)" }} strokeWidth={1.5} />
            </div>
          </div>
        </div>

        {/* P&L This Month */}
        <div className="mc-card p-5">
          <div className="flex items-start justify-between mb-1">
            <div>
              <p
                className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-2"
                style={{ color: "var(--mc-text-muted)" }}
              >
                P&L This Month
              </p>
              <p
                className="text-xl font-medium"
                style={{ fontFamily: "var(--font-jost), Jost, sans-serif", color: plColor }}
              >
                {data.plThisMonth >= 0 ? "+" : ""}
                {formatEUR(data.plThisMonth)}
              </p>
              <p className="text-[10px] mt-1" style={{ color: "var(--mc-text-muted)" }}>
                {formatEUR(data.incomeThisMonth)} in · {formatEUR(data.costsThisMonth)} out
              </p>
            </div>
            <div
              className="w-9 h-9 flex items-center justify-center flex-shrink-0"
              style={{
                background: data.plThisMonth >= 0 ? "var(--mc-success-bg)" : "var(--mc-error-bg)",
              }}
            >
              {data.plThisMonth >= 0 ? (
                <TrendingUp className="w-[18px] h-[18px]" style={{ color: "var(--mc-success)" }} strokeWidth={1.5} />
              ) : (
                <TrendingDown className="w-[18px] h-[18px]" style={{ color: "var(--mc-error)" }} strokeWidth={1.5} />
              )}
            </div>
          </div>
        </div>

        {/* Burn Rate */}
        <StatCard
          label="Burn Rate"
          value={formatEUR(data.burnRate)}
          icon={TrendingDown}
          trend="Avg last 3 months"
          color="warning"
        />

        {/* Runway */}
        <div className="mc-card p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p
                className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-2"
                style={{ color: "var(--mc-text-muted)" }}
              >
                Cash Runway
              </p>
              <p
                className="text-xl font-medium"
                style={{
                  fontFamily: "var(--font-jost), Jost, sans-serif",
                  color:
                    runwayColor === "success"
                      ? "var(--mc-success)"
                      : runwayColor === "warning"
                        ? "var(--mc-warning)"
                        : "var(--mc-error)",
                }}
              >
                {data.runwayMonths} mo
              </p>
            </div>
            <div
              className="w-9 h-9 flex items-center justify-center flex-shrink-0"
              style={{
                background:
                  runwayColor === "success"
                    ? "var(--mc-success-bg)"
                    : runwayColor === "warning"
                      ? "var(--mc-warning-bg)"
                      : "var(--mc-error-bg)",
              }}
            >
              <BarChart3
                className="w-[18px] h-[18px]"
                style={{
                  color:
                    runwayColor === "success"
                      ? "var(--mc-success)"
                      : runwayColor === "warning"
                        ? "var(--mc-warning)"
                        : "var(--mc-error)",
                }}
                strokeWidth={1.5}
              />
            </div>
          </div>
          <RunwayGauge months={data.runwayMonths} />
        </div>
      </div>

      {/* 6-Month Revenue vs Costs chart */}
      <div className="mc-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <h3
            className="text-xs font-semibold tracking-[0.08em] uppercase"
            style={{ color: "var(--mc-text-muted)" }}
          >
            Revenue vs Costs — Last 6 Months
          </h3>
          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5" style={{ background: "var(--mc-success)" }} />
              <span className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>Revenue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5" style={{ background: "var(--mc-cream-subtle)" }} />
              <span className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>Costs</span>
            </div>
          </div>
        </div>
        <div className="flex items-end gap-3" style={{ height: 120 }}>
          {data.trend.map((bucket) => (
            <div key={bucket.label} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end gap-0.5" style={{ height: 96 }}>
                <div
                  className="flex-1 transition-all duration-500"
                  style={{
                    height: `${Math.max((bucket.income / maxVal) * 96, bucket.income > 0 ? 2 : 0)}px`,
                    background: "var(--mc-success)",
                    opacity: 0.8,
                  }}
                />
                <div
                  className="flex-1 transition-all duration-500"
                  style={{
                    height: `${Math.max((bucket.costs / maxVal) * 96, bucket.costs > 0 ? 2 : 0)}px`,
                    background: "var(--mc-cream-subtle)",
                    opacity: 0.6,
                  }}
                />
              </div>
              <span className="text-[9px]" style={{ color: "var(--mc-text-muted)" }}>
                {bucket.label}
              </span>
            </div>
          ))}
        </div>
        {/* Sparkline of net P&L */}
        {data.trend.some((b) => b.income > 0 || b.costs > 0) && (
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--mc-border-light)" }}>
            <p className="text-[9px] font-semibold tracking-[0.08em] uppercase mb-1.5" style={{ color: "var(--mc-text-muted)" }}>
              Net P&L trend
            </p>
            <SparklineCSS
              data={data.trend.map((b) => Math.max(b.income - b.costs, 0))}
              color="var(--mc-success)"
              height={20}
            />
          </div>
        )}
      </div>

      {/* Alert cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          className="mc-card p-4 flex items-center gap-3"
          style={{
            borderColor:
              data.uncategorizedCount > 0 ? "var(--mc-warning)" : "var(--mc-border)",
          }}
        >
          <div
            className="w-8 h-8 flex items-center justify-center flex-shrink-0"
            style={{ background: data.uncategorizedCount > 0 ? "var(--mc-warning-bg)" : "var(--mc-surface-warm)" }}
          >
            <AlertTriangle
              className="w-4 h-4"
              style={{ color: data.uncategorizedCount > 0 ? "var(--mc-warning)" : "var(--mc-text-muted)" }}
              strokeWidth={1.5}
            />
          </div>
          <div>
            <p
              className="text-xs font-semibold"
              style={{ color: data.uncategorizedCount > 0 ? "var(--mc-warning)" : "var(--mc-text-primary)" }}
            >
              {data.uncategorizedCount} uncategorized
            </p>
            <p className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
              transactions need tagging
            </p>
          </div>
        </div>

        <div
          className="mc-card p-4 flex items-center gap-3"
          style={{
            borderColor:
              data.overdueInvoicesCount > 0 ? "var(--mc-error)" : "var(--mc-border)",
          }}
        >
          <div
            className="w-8 h-8 flex items-center justify-center flex-shrink-0"
            style={{ background: data.overdueInvoicesCount > 0 ? "var(--mc-error-bg)" : "var(--mc-surface-warm)" }}
          >
            <Clock
              className="w-4 h-4"
              style={{ color: data.overdueInvoicesCount > 0 ? "var(--mc-error)" : "var(--mc-text-muted)" }}
              strokeWidth={1.5}
            />
          </div>
          <div>
            <p
              className="text-xs font-semibold"
              style={{ color: data.overdueInvoicesCount > 0 ? "var(--mc-error)" : "var(--mc-text-primary)" }}
            >
              {data.overdueInvoicesCount} overdue invoice{data.overdueInvoicesCount !== 1 ? "s" : ""}
            </p>
            <p className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
              require follow-up
            </p>
          </div>
        </div>

        <div className="mc-card p-4 flex items-center gap-3">
          <div
            className="w-8 h-8 flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--mc-surface-warm)" }}
          >
            <RefreshCw className="w-4 h-4" style={{ color: "var(--mc-text-muted)" }} strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs font-semibold" style={{ color: "var(--mc-text-primary)" }}>
              Last sync
            </p>
            <p className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
              {data.lastSynced
                ? new Date(data.lastSynced).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Never synced"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
