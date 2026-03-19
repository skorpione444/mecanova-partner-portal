import { useState } from "react";
import { SlidersHorizontal, X, RotateCcw } from "lucide-react";
import type { PostSearchFilters } from "@/lib/research-types";

const TYPE_OPTIONS = [
  { value: "bar", label: "Bar" },
  { value: "restaurant", label: "Restaurant" },
  { value: "hotel", label: "Hotel" },
  { value: "distributor", label: "Distributor" },
  { value: "competitor", label: "Competitor" },
  { value: "other", label: "Other" },
];

interface ResearchFiltersProps {
  filters: PostSearchFilters;
  onChange: (filters: PostSearchFilters) => void;
  onReset: () => void;
}

function activeFilterCount(f: PostSearchFilters): number {
  let count = 0;
  if (f.types.size > 0) count += f.types.size;
  if (f.minScore > 1) count++;
  if (f.hasWebsite) count++;
  if (f.hasPhone) count++;
  count += f.activeTags.length;
  return count;
}

export default function ResearchFilters({
  filters,
  onChange,
  onReset,
}: ResearchFiltersProps) {
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(filters);

  const toggleType = (type: string) => {
    const next = new Set(filters.types);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    onChange({ ...filters, types: next });
  };

  const removeTag = (tag: string) => {
    onChange({
      ...filters,
      activeTags: filters.activeTags.filter((t) => t !== tag),
    });
  };

  return (
    <div className="mb-4">
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-[11px] tracking-wide transition-colors"
        style={{ color: count > 0 ? "var(--mc-cream)" : "var(--mc-text-muted)" }}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />
        Filters
        {count > 0 && (
          <span
            className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[9px] font-bold"
            style={{
              background: "var(--mc-cream)",
              color: "#000",
            }}
          >
            {count}
          </span>
        )}
      </button>

      {/* Expanded filter bar */}
      {open && (
        <div
          className="mc-card p-4 mt-2 flex flex-wrap items-center gap-4"
        >
          {/* Type chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-[9px] font-semibold tracking-[0.08em] uppercase mr-1"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Type
            </span>
            {TYPE_OPTIONS.map((opt) => {
              const active = filters.types.has(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleType(opt.value)}
                  className="px-2 py-1 text-[10px] tracking-wide transition-all"
                  style={{
                    background: active ? "rgba(236, 223, 204, 0.15)" : "rgba(236, 223, 204, 0.04)",
                    border: `1px solid ${active ? "var(--mc-cream-muted)" : "var(--mc-border)"}`,
                    color: active ? "var(--mc-cream)" : "var(--mc-text-muted)",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="w-px h-5" style={{ background: "var(--mc-border)" }} />

          {/* Min score */}
          <div className="flex items-center gap-1.5">
            <span
              className="text-[9px] font-semibold tracking-[0.08em] uppercase"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Min score
            </span>
            <select
              value={filters.minScore}
              onChange={(e) =>
                onChange({ ...filters, minScore: Number(e.target.value) })
              }
              className="mc-select text-[10px] py-1 px-2"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {/* Divider */}
          <div className="w-px h-5" style={{ background: "var(--mc-border)" }} />

          {/* Contact toggles */}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.hasWebsite}
              onChange={(e) =>
                onChange({ ...filters, hasWebsite: e.target.checked })
              }
              className="mc-checkbox"
            />
            <span className="text-[10px]" style={{ color: "var(--mc-text-secondary)" }}>
              Has website
            </span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.hasPhone}
              onChange={(e) =>
                onChange({ ...filters, hasPhone: e.target.checked })
              }
              className="mc-checkbox"
            />
            <span className="text-[10px]" style={{ color: "var(--mc-text-secondary)" }}>
              Has phone
            </span>
          </label>

          {/* Active tag pills */}
          {filters.activeTags.length > 0 && (
            <>
              <div className="w-px h-5" style={{ background: "var(--mc-border)" }} />
              <div className="flex items-center gap-1.5 flex-wrap">
                {filters.activeTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => removeTag(tag)}
                    className="flex items-center gap-1 px-2 py-0.5 text-[10px] transition-colors"
                    style={{
                      background: "rgba(236, 223, 204, 0.12)",
                      border: "1px solid var(--mc-cream-muted)",
                      color: "var(--mc-cream)",
                    }}
                  >
                    {tag}
                    <X className="w-2.5 h-2.5" strokeWidth={2} />
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Reset */}
          {count > 0 && (
            <>
              <div className="w-px h-5" style={{ background: "var(--mc-border)" }} />
              <button
                onClick={onReset}
                className="flex items-center gap-1 text-[10px] tracking-wide transition-colors"
                style={{ color: "var(--mc-text-muted)" }}
              >
                <RotateCcw className="w-3 h-3" strokeWidth={1.5} />
                Reset
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
