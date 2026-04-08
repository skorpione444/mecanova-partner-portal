"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { TrendingUp, Package2 } from "lucide-react";

const formatEUR = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

export default function ForecastPanel() {
  const [balance, setBalance] = useState(0);
  const [burnRate, setBurnRate] = useState(0);
  const [currentRevenue, setCurrentRevenue] = useState(0);
  const [bottlePrice, setBottlePrice] = useState(25); // EUR per bottle — editable
  const [projectedRevenue, setProjectedRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);

    // Fetch balance from Holvi
    let bal = 0;
    try {
      const res = await fetch("/api/holvi/balance");
      if (res.ok) {
        const json = await res.json();
        bal = json.balance ?? 0;
      }
    } catch {
      // not configured
    }

    // Fetch last 6 months transactions for burn + revenue
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // New tables not yet in generated types — remove cast after `npm run sb:pull`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data: txRows } = await db
      .from("bank_transactions")
      .select("transaction_date, amount, direction")
      .gte("transaction_date", sixMonthsAgo.toISOString().split("T")[0]);

    const rows = (txRows ?? []) as { transaction_date: string; amount: number; direction: string }[];

    // Burn = avg last 3 completed months of outgoing
    const now = new Date();
    const burnMonths: number[] = [0, 0, 0];
    const revenueMonths: number[] = [0, 0, 0];
    for (let i = 1; i <= 3; i++) {
      const bd = new Date(now.getFullYear(), now.getMonth() - i, 1);
      for (const r of rows) {
        const [ry, rm] = r.transaction_date.split("-").map(Number);
        if (ry === bd.getFullYear() && rm === bd.getMonth() + 1) {
          if (r.direction === "out") burnMonths[i - 1] += Number(r.amount);
          else revenueMonths[i - 1] += Number(r.amount);
        }
      }
    }

    const avgBurn = burnMonths.reduce((s, v) => s + v, 0) / 3;
    const avgRevenue = revenueMonths.reduce((s, v) => s + v, 0) / 3;

    // Fallback balance from transactions if Holvi not available
    if (bal === 0) {
      for (const r of rows) {
        bal += r.direction === "in" ? Number(r.amount) : -Number(r.amount);
      }
    }

    setBalance(bal);
    setBurnRate(avgBurn);
    setCurrentRevenue(avgRevenue);
    setProjectedRevenue(avgRevenue);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="mc-skeleton h-24" />
        <div className="mc-skeleton h-48" />
      </div>
    );
  }

  const netMonthlyBurn = Math.max(burnRate - projectedRevenue, 0);
  const runwayMonths = netMonthlyBurn > 0 ? balance / netMonthlyBurn : 99;
  const cappedRunway = Math.min(runwayMonths, 36);

  // Break-even: bottles needed = net costs / price per bottle
  const bottlesNeeded = bottlePrice > 0 ? Math.ceil(burnRate / bottlePrice) : 0;

  // Runway projection: monthly snapshots
  const projectionBuckets = Array.from({ length: Math.ceil(cappedRunway) + 1 }, (_, i) => {
    const remaining = balance - netMonthlyBurn * i;
    return { month: i, balance: Math.max(remaining, 0) };
  });
  const maxBalance = Math.max(...projectionBuckets.map((b) => b.balance), 1);

  return (
    <div className="space-y-6">
      {/* Key numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="mc-card p-5">
          <p
            className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-2"
            style={{ color: "var(--mc-text-muted)" }}
          >
            Current Balance
          </p>
          <p
            className="text-xl font-medium"
            style={{ fontFamily: "var(--font-jost), Jost, sans-serif", color: "var(--mc-text-primary)" }}
          >
            {formatEUR(balance)}
          </p>
        </div>
        <div className="mc-card p-5">
          <p
            className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-2"
            style={{ color: "var(--mc-text-muted)" }}
          >
            Avg Monthly Burn
          </p>
          <p
            className="text-xl font-medium"
            style={{ fontFamily: "var(--font-jost), Jost, sans-serif", color: "var(--mc-error)" }}
          >
            {formatEUR(burnRate)}
          </p>
        </div>
        <div className="mc-card p-5">
          <p
            className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-2"
            style={{ color: "var(--mc-text-muted)" }}
          >
            Projected Runway
          </p>
          <p
            className="text-xl font-medium"
            style={{
              fontFamily: "var(--font-jost), Jost, sans-serif",
              color:
                runwayMonths > 6
                  ? "var(--mc-success)"
                  : runwayMonths >= 3
                    ? "var(--mc-warning)"
                    : "var(--mc-error)",
            }}
          >
            {runwayMonths >= 36 ? "36+ months" : `${runwayMonths.toFixed(1)} months`}
          </p>
          <p className="text-[10px] mt-1" style={{ color: "var(--mc-text-muted)" }}>
            at {formatEUR(netMonthlyBurn)}/mo net burn
          </p>
        </div>
      </div>

      {/* Scenario slider */}
      <div className="mc-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4" style={{ color: "var(--mc-cream-subtle)" }} strokeWidth={1.5} />
          <h3
            className="text-xs font-semibold tracking-[0.08em] uppercase"
            style={{ color: "var(--mc-text-muted)" }}
          >
            Revenue Scenario Slider
          </h3>
        </div>

        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <label
              className="text-[10px] font-semibold tracking-[0.08em] uppercase"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Projected Monthly Revenue
            </label>
            <span
              className="text-sm font-medium"
              style={{ fontFamily: "var(--font-jost), Jost, sans-serif", color: "var(--mc-success)" }}
            >
              {formatEUR(projectedRevenue)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(burnRate * 2, 10000)}
            step={100}
            value={projectedRevenue}
            onChange={(e) => setProjectedRevenue(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--mc-success)" }}
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>€0</span>
            <span className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
              Break-even ({formatEUR(burnRate)})
            </span>
            <span className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
              {formatEUR(burnRate * 2)}
            </span>
          </div>
        </div>

        <div
          className="p-3 flex items-center gap-3"
          style={{ background: "var(--mc-surface-warm)" }}
        >
          <span className="text-[11px]" style={{ color: "var(--mc-text-muted)" }}>
            At this revenue level:
          </span>
          <span
            className="text-sm font-medium"
            style={{
              fontFamily: "var(--font-jost), Jost, sans-serif",
              color:
                runwayMonths >= 36
                  ? "var(--mc-success)"
                  : runwayMonths > 6
                    ? "var(--mc-success)"
                    : runwayMonths >= 3
                      ? "var(--mc-warning)"
                      : "var(--mc-error)",
            }}
          >
            {runwayMonths >= 36 ? "Profitable" : `${runwayMonths.toFixed(1)} months runway`}
          </span>
          {projectedRevenue >= burnRate && (
            <span
              className="text-[10px] font-semibold px-2 py-0.5"
              style={{ background: "var(--mc-success-bg)", color: "var(--mc-success)" }}
            >
              BREAK-EVEN
            </span>
          )}
        </div>
      </div>

      {/* Runway projection chart */}
      <div className="mc-card p-5">
        <h3
          className="text-xs font-semibold tracking-[0.08em] uppercase mb-4"
          style={{ color: "var(--mc-text-muted)" }}
        >
          Cash Runway Projection
        </h3>

        <div className="flex items-end gap-1" style={{ height: 120 }}>
          {projectionBuckets.map((b) => (
            <div
              key={b.month}
              className="flex-1 transition-all duration-300"
              style={{
                height: `${Math.max((b.balance / maxBalance) * 120, b.balance > 0 ? 2 : 0)}px`,
                background:
                  b.balance / balance > 0.5
                    ? "var(--mc-success)"
                    : b.balance / balance > 0.2
                      ? "var(--mc-warning)"
                      : "var(--mc-error)",
                opacity: 0.75,
              }}
              title={`Month ${b.month}: ${formatEUR(b.balance)}`}
            />
          ))}
        </div>

        <div className="flex justify-between mt-2">
          <span className="text-[9px]" style={{ color: "var(--mc-text-muted)" }}>Now</span>
          <span className="text-[9px]" style={{ color: "var(--mc-text-muted)" }}>
            Month {Math.ceil(cappedRunway)}
          </span>
        </div>
      </div>

      {/* Break-even calculator */}
      <div className="mc-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package2 className="w-4 h-4" style={{ color: "var(--mc-cream-subtle)" }} strokeWidth={1.5} />
          <h3
            className="text-xs font-semibold tracking-[0.08em] uppercase"
            style={{ color: "var(--mc-text-muted)" }}
          >
            Break-Even Calculator
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-end">
          <div>
            <label
              className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-1 block"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Monthly costs
            </label>
            <p
              className="text-lg font-medium"
              style={{ fontFamily: "var(--font-jost), Jost, sans-serif", color: "var(--mc-error)" }}
            >
              {formatEUR(burnRate)}
            </p>
          </div>

          <div>
            <label
              className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-1 block"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Revenue per bottle (EUR)
            </label>
            <input
              type="number"
              className="mc-input w-full"
              value={bottlePrice || ""}
              min={1}
              onChange={(e) => setBottlePrice(Number(e.target.value) || 0)}
            />
          </div>

          <div>
            <label
              className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-1 block"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Bottles / month to break even
            </label>
            <p
              className="text-2xl font-medium"
              style={{
                fontFamily: "var(--font-jost), Jost, sans-serif",
                color: "var(--mc-cream)",
              }}
            >
              {bottlesNeeded.toLocaleString("de-DE")}
            </p>
          </div>
        </div>

        {burnRate > 0 && bottlePrice > 0 && (
          <p className="mt-4 text-[11px]" style={{ color: "var(--mc-text-muted)" }}>
            At {formatEUR(bottlePrice)}/bottle, selling {bottlesNeeded} bottles/month covers the{" "}
            {formatEUR(burnRate)} average monthly cost.
          </p>
        )}
      </div>
    </div>
  );
}
