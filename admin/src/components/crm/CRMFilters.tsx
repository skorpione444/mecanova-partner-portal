"use client";

import type { CRMStatus, PartnerType } from "@mecanova/shared";

export interface CRMFilterState {
  partnerType: PartnerType | "all";
  crmStatus: CRMStatus | "all";
  source: "all" | "prospects" | "partners";
}

interface CRMFiltersProps {
  filters: CRMFilterState;
  onChange: (filters: CRMFilterState) => void;
  prospectCount: number;
  partnerCount: number;
  ordersFilterActive: boolean;
  onOrdersFilterChange: (active: boolean) => void;
  openOrderCount: number;
}

const PARTNER_TYPES: { value: PartnerType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "distributor", label: "Distributor" },
  { value: "client", label: "Buyer" },
  { value: "supplier", label: "Supplier" },
];

// All 5 statuses — for "all" and "prospects" sources
const ALL_STATUSES: { value: CRMStatus | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "uncontacted", label: "Uncontacted" },
  { value: "contacted", label: "Contacted" },
  { value: "negotiating", label: "Negotiating" },
  { value: "customer", label: "Customer" },
  { value: "inactive", label: "Inactive" },
];

// Only the statuses partners can have
const PARTNER_STATUSES: { value: CRMStatus | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "customer", label: "Customer" },
  { value: "inactive", label: "Inactive" },
];

// Statuses that only apply to prospects
const PROSPECT_ONLY_STATUSES: Array<CRMStatus | "all"> = [
  "uncontacted",
  "contacted",
  "negotiating",
];

const SOURCES: { value: CRMFilterState["source"]; label: string }[] = [
  { value: "all", label: "All" },
  { value: "prospects", label: "Prospects" },
  { value: "partners", label: "Partners" },
];

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 10px",
        fontSize: "0.6875rem",
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        border: "1px solid",
        borderColor: active ? "var(--mc-cream)" : "var(--mc-border)",
        background: active ? "rgba(236,223,204,0.08)" : "transparent",
        color: active ? "var(--mc-cream)" : "var(--mc-text-muted)",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
        letterSpacing: active ? "0.02em" : "0",
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 20,
        background: "var(--mc-border)",
        flexShrink: 0,
      }}
    />
  );
}

export default function CRMFilters({
  filters,
  onChange,
  prospectCount,
  partnerCount,
  ordersFilterActive,
  onOrdersFilterChange,
  openOrderCount,
}: CRMFiltersProps) {
  const handleSourceChange = (source: CRMFilterState["source"]) => {
    const next: CRMFilterState = { ...filters, source };
    // Switching to Partners: reset any prospect-only status
    if (source === "partners" && PROSPECT_ONLY_STATUSES.includes(filters.crmStatus)) {
      next.crmStatus = "all";
    }
    onChange(next);
  };

  const statusOptions =
    filters.source === "partners" ? PARTNER_STATUSES : ALL_STATUSES;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "8px 16px",
        background: "var(--mc-surface-warm)",
        borderBottom: "1px solid var(--mc-border)",
        overflowX: "auto",
        flexShrink: 0,
      }}
    >
      {/* Source */}
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {SOURCES.map((s) => (
          <FilterChip
            key={s.value}
            active={filters.source === s.value}
            onClick={() => handleSourceChange(s.value)}
          >
            {s.label}
            {s.value === "prospects" && (
              <span
                style={{
                  marginLeft: 5,
                  fontSize: "0.6rem",
                  background: "var(--mc-graphite)",
                  padding: "1px 5px",
                  borderRadius: 99,
                }}
              >
                {prospectCount}
              </span>
            )}
            {s.value === "partners" && (
              <span
                style={{
                  marginLeft: 5,
                  fontSize: "0.6rem",
                  background: "var(--mc-graphite)",
                  padding: "1px 5px",
                  borderRadius: 99,
                }}
              >
                {partnerCount}
              </span>
            )}
          </FilterChip>
        ))}
      </div>

      <Divider />

      {/* Partner / Prospect type — always visible */}
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {PARTNER_TYPES.map((v) => (
          <FilterChip
            key={v.value}
            active={filters.partnerType === v.value}
            onClick={() => onChange({ ...filters, partnerType: v.value })}
          >
            {v.label}
          </FilterChip>
        ))}
      </div>

      <Divider />

      {/* CRM Status — options shrink to Customer + Inactive when Partners is selected */}
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {statusOptions.map((s) => (
          <FilterChip
            key={s.value}
            active={filters.crmStatus === s.value}
            onClick={() => onChange({ ...filters, crmStatus: s.value })}
          >
            {s.label}
          </FilterChip>
        ))}
      </div>

      <Divider />

      {/* Orders — highlight partners with at least one open order in red */}
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <FilterChip
          active={ordersFilterActive}
          onClick={() => onOrdersFilterChange(!ordersFilterActive)}
        >
          Orders
          <span
            style={{
              marginLeft: 5,
              fontSize: "0.6rem",
              background: "var(--mc-graphite)",
              padding: "1px 5px",
              borderRadius: 99,
            }}
          >
            {openOrderCount}
          </span>
        </FilterChip>
      </div>
    </div>
  );
}
