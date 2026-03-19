"use client";

import { useState, useCallback, useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import ResearchResultCard from "@/components/research/ResearchResultCard";
import ResearchResultsTable from "@/components/research/ResearchResultsTable";
import DeepDivePanel from "@/components/research/DeepDivePanel";
import ResearchHistory from "@/components/research/ResearchHistory";
import ResearchFilters from "@/components/research/ResearchFilters";
import {
  Search,
  LayoutGrid,
  List,
  Clock,
  MapPin,
  Truck,
  Target,
  Building2,
  Loader2,
} from "lucide-react";
import type { ResearchResult, DeepDiveResult, PostSearchFilters } from "@/lib/research-types";
import { RESEARCH_TEMPLATES } from "@/lib/research-types";

const DEFAULT_FILTERS: PostSearchFilters = {
  types: new Set(),
  minScore: 1,
  hasWebsite: false,
  hasPhone: false,
  activeTags: [],
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  MapPin,
  Truck,
  Target,
  Building2,
};

const LOADING_MESSAGES = [
  "Searching the web...",
  "Analyzing results...",
  "Generating insights...",
  "Scoring relevance...",
  "Crafting outreach ideas...",
];

export default function ResearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(0);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [sortBy, setSortBy] = useState("relevanceScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showHistory, setShowHistory] = useState(false);
  const [deepDiveTarget, setDeepDiveTarget] = useState<ResearchResult | null>(null);
  const [deepDiveData, setDeepDiveData] = useState<DeepDiveResult | null>(null);
  const [deepDiveLoading, setDeepDiveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PostSearchFilters>({ ...DEFAULT_FILTERS, types: new Set() });

  const handleTagClick = useCallback((tag: string) => {
    setFilters((prev) => ({
      ...prev,
      activeTags: prev.activeTags.includes(tag)
        ? prev.activeTags.filter((t) => t !== tag)
        : [...prev.activeTags, tag],
    }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS, types: new Set() });
  }, []);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setLoadingMessage(0);

    // Cycle loading messages
    const interval = setInterval(() => {
      setLoadingMessage((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 3000);

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Research request failed");
      }

      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  }, [query, loading]);

  const handleDeepDive = useCallback(async (result: ResearchResult) => {
    setDeepDiveTarget(result);
    setDeepDiveData(null);
    setDeepDiveLoading(true);

    try {
      const res = await fetch("/api/research/deep-dive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: result.name,
          businessType: result.type,
          existingDetails: result.keyDetails,
        }),
      });

      if (!res.ok) throw new Error("Deep-dive failed");

      const data = await res.json();
      setDeepDiveData(data.result);
    } catch {
      setDeepDiveData(null);
    } finally {
      setDeepDiveLoading(false);
    }
  }, []);

  const handleSort = useCallback(
    (key: string) => {
      if (sortBy === key) {
        setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(key);
        setSortDir(key === "relevanceScore" ? "desc" : "asc");
      }
    },
    [sortBy]
  );

  const handleTemplateClick = useCallback((prompt: string) => {
    setQuery(prompt);
  }, []);

  const handleLoadSession = useCallback((sessionResults: ResearchResult[], sessionQuery: string) => {
    setResults(sessionResults);
    setQuery(sessionQuery);
  }, []);

  // Filter + sort results
  const filteredResults = useMemo(() => {
    let filtered = results;
    if (filters.types.size > 0)
      filtered = filtered.filter((r) => filters.types.has(r.type));
    if (filters.minScore > 1)
      filtered = filtered.filter((r) => r.relevanceScore >= filters.minScore);
    if (filters.hasWebsite)
      filtered = filtered.filter((r) => !!r.website);
    if (filters.hasPhone)
      filtered = filtered.filter((r) => !!r.phone);
    if (filters.activeTags.length > 0)
      filtered = filtered.filter((r) =>
        filters.activeTags.every((t) => r.categoryTags?.includes(t))
      );
    return filtered;
  }, [results, filters]);

  const sortedResults = useMemo(() => {
    return [...filteredResults].sort((a, b) => {
      const aVal = a[sortBy as keyof ResearchResult] ?? "";
      const bVal = b[sortBy as keyof ResearchResult] ?? "";
      const cmp = typeof aVal === "number" && typeof bVal === "number"
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredResults, sortBy, sortDir]);

  return (
    <div>
      <PageHeader
        title="Research"
        description="AI-powered business intelligence"
        icon={Search}
        actions={
          <button
            onClick={() => setShowHistory(true)}
            className="mc-btn mc-btn-ghost flex items-center gap-2 text-[11px]"
          >
            <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
            History
          </button>
        }
      />

      {/* Search section */}
      <div className="mc-card p-5 mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="What would you like to research? e.g. 'Find cocktail bars in Berlin that serve mezcal'"
            className="mc-input flex-1 text-sm"
            disabled={loading}
          />
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="mc-btn mc-btn-primary flex items-center gap-2 px-5"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" strokeWidth={1.5} />
            )}
            Search
          </button>
        </div>

        {/* Template chips */}
        <div className="flex flex-wrap gap-2 mt-3">
          {RESEARCH_TEMPLATES.map((tmpl) => {
            const Icon = ICON_MAP[tmpl.icon] || Search;
            return (
              <button
                key={tmpl.label}
                onClick={() => handleTemplateClick(tmpl.prompt)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] tracking-wide transition-all duration-200"
                style={{
                  background: "rgba(236, 223, 204, 0.04)",
                  border: "1px solid var(--mc-border)",
                  color: "var(--mc-text-muted)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(236, 223, 204, 0.08)";
                  e.currentTarget.style.color = "var(--mc-cream-muted)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(236, 223, 204, 0.04)";
                  e.currentTarget.style.color = "var(--mc-text-muted)";
                }}
              >
                <Icon className="w-3 h-3" strokeWidth={1.5} />
                {tmpl.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="mc-card p-8 mb-6 mc-animate-fade">
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-10 h-10">
              <div
                className="absolute inset-0 border animate-spin"
                style={{ borderColor: "transparent", borderTopColor: "var(--mc-cream)" }}
              />
              <Search
                className="absolute inset-0 m-auto w-4 h-4"
                strokeWidth={1.5}
                style={{ color: "var(--mc-cream-muted)" }}
              />
            </div>
            <p
              className="text-xs tracking-wide transition-all duration-500"
              style={{ color: "var(--mc-text-tertiary)" }}
            >
              {LOADING_MESSAGES[loadingMessage]}
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="mc-card p-4 mb-6"
          style={{ borderColor: "var(--mc-error)" }}
        >
          <p className="text-xs" style={{ color: "var(--mc-error)" }}>
            {error}
          </p>
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <>
          {/* Filter bar */}
          <ResearchFilters
            filters={filters}
            onChange={setFilters}
            onReset={handleResetFilters}
          />

          {/* Results header */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs" style={{ color: "var(--mc-text-tertiary)" }}>
              <span
                className="font-semibold"
                style={{ color: "var(--mc-text-primary)" }}
              >
                {filteredResults.length === results.length
                  ? results.length
                  : `${filteredResults.length} of ${results.length}`}
              </span>{" "}
              results{filteredResults.length !== results.length ? "" : " found"}
            </p>
            <div className="flex items-center gap-2">
              {/* Sort dropdown */}
              <select
                value={`${sortBy}-${sortDir}`}
                onChange={(e) => {
                  const [key, dir] = e.target.value.split("-");
                  setSortBy(key);
                  setSortDir(dir as "asc" | "desc");
                }}
                className="mc-select text-[10px] py-1 px-2"
              >
                <option value="relevanceScore-desc">Highest score</option>
                <option value="relevanceScore-asc">Lowest score</option>
                <option value="name-asc">Name A–Z</option>
                <option value="name-desc">Name Z–A</option>
                <option value="type-asc">Type A–Z</option>
                <option value="city-asc">City A–Z</option>
              </select>

              {/* View toggle */}
              <div
                className="flex"
                style={{ border: "1px solid var(--mc-border)" }}
              >
                <button
                  onClick={() => setViewMode("cards")}
                  className="p-1.5 transition-colors"
                  style={{
                    background: viewMode === "cards" ? "rgba(236, 223, 204, 0.1)" : "transparent",
                    color: viewMode === "cards" ? "var(--mc-cream)" : "var(--mc-text-muted)",
                  }}
                >
                  <LayoutGrid className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className="p-1.5 transition-colors"
                  style={{
                    background: viewMode === "table" ? "rgba(236, 223, 204, 0.1)" : "transparent",
                    color: viewMode === "table" ? "var(--mc-cream)" : "var(--mc-text-muted)",
                  }}
                >
                  <List className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </div>

          {/* Results view */}
          {viewMode === "cards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mc-stagger">
              {sortedResults.map((result, i) => (
                <ResearchResultCard
                  key={`${result.name}-${i}`}
                  result={result}
                  onDeepDive={handleDeepDive}
                  onTagClick={handleTagClick}
                />
              ))}
            </div>
          ) : (
            <ResearchResultsTable
              results={sortedResults}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
              onDeepDive={handleDeepDive}
              onTagClick={handleTagClick}
            />
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && !error && results.length === 0 && (
        <div className="text-center py-16">
          <Search
            className="w-8 h-8 mx-auto mb-3"
            strokeWidth={1}
            style={{ color: "var(--mc-text-muted)" }}
          />
          <p
            className="text-sm mb-1"
            style={{
              fontFamily: "var(--font-jost), Jost, sans-serif",
              color: "var(--mc-text-secondary)",
            }}
          >
            Start researching
          </p>
          <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
            Enter a query or pick a template above to discover potential clients, distributors, and competitors
          </p>
        </div>
      )}

      {/* Deep dive panel */}
      {deepDiveTarget && (
        <DeepDivePanel
          data={deepDiveData}
          loading={deepDiveLoading}
          businessName={deepDiveTarget.name}
          onClose={() => {
            setDeepDiveTarget(null);
            setDeepDiveData(null);
          }}
        />
      )}

      {/* History panel */}
      {showHistory && (
        <ResearchHistory
          onLoadSession={handleLoadSession}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
