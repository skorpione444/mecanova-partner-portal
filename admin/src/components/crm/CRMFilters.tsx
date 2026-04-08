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
}

const PARTNER_TYPES: { value: PartnerType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "distributor", label: "Distributor" },
  { value: "client", label: "Buyer" },
  { value: "supplier", label: "Supplier" },
];

const CRM_STATUSES: { value: CRMStatus | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "uncontacted", label: "Uncontacted" },
  { value: "contacted", label: "Contacted" },
  { value: "negotiating", label: "Negotiating" },
  { value: "customer", label: "Customer" },
  { value: "inactive", label: "Inactive" },
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

export default function CRMFilters({
  filters,
  onChange,
  prospectCount,
  partnerCount,
}: CRMFiltersProps) {
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
            onClick={() => onChange({ ...filters, source: s.value })}
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

      <div
        style={{
          width: 1,
          height: 20,
          background: "var(--mc-border)",
          flexShrink: 0,
        }}
      />

      {/* Partner type */}
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

      <div
        style={{
          width: 1,
          height: 20,
          background: "var(--mc-border)",
          flexShrink: 0,
        }}
      />

      {/* CRM Status */}
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {CRM_STATUSES.map((s) => (
          <FilterChip
            key={s.value}
            active={filters.crmStatus === s.value}
            onClick={() => onChange({ ...filters, crmStatus: s.value })}
          >
            {s.label}
          </FilterChip>
        ))}
      </div>
    </div>
  );
}
