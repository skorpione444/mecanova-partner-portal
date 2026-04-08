"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import FinanceOverview from "@/components/finance/FinanceOverview";
import CostBreakdown from "@/components/finance/CostBreakdown";
import RevenuePanel from "@/components/finance/RevenuePanel";
import BankFeed from "@/components/finance/BankFeed";
import ForecastPanel from "@/components/finance/ForecastPanel";
import {
  DollarSign,
  LayoutDashboard,
  TrendingDown,
  TrendingUp,
  ArrowLeftRight,
  BarChart3,
} from "lucide-react";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "costs", label: "Costs", icon: TrendingDown },
  { id: "revenue", label: "Revenue", icon: TrendingUp },
  { id: "bank-feed", label: "Bank Feed", icon: ArrowLeftRight },
  { id: "forecast", label: "Forecast", icon: BarChart3 },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  return (
    <div>
      <PageHeader
        title="Finance"
        description="P&L, cash runway, transaction feed, and projections powered by Holvi"
        icon={DollarSign}
      />

      {/* Tab bar */}
      <div
        className="flex gap-1 mb-6 overflow-x-auto"
        style={{ borderBottom: "1px solid var(--mc-border)" }}
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold tracking-[0.06em] uppercase whitespace-nowrap transition-colors"
              style={{
                color: isActive ? "var(--mc-cream)" : "var(--mc-text-muted)",
                borderBottom: isActive
                  ? "2px solid var(--mc-cream)"
                  : "2px solid transparent",
                marginBottom: "-1px",
                background: "transparent",
              }}
              onMouseEnter={(e) => {
                if (!isActive)
                  e.currentTarget.style.color = "var(--mc-text-secondary)";
              }}
              onMouseLeave={(e) => {
                if (!isActive)
                  e.currentTarget.style.color = "var(--mc-text-muted)";
              }}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <FinanceOverview />}
      {activeTab === "costs" && <CostBreakdown />}
      {activeTab === "revenue" && <RevenuePanel />}
      {activeTab === "bank-feed" && <BankFeed />}
      {activeTab === "forecast" && <ForecastPanel />}
    </div>
  );
}
