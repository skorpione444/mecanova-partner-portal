import { useState } from "react";
import type { ResearchResult } from "@/lib/research-types";
import {
  ChevronDown,
  ChevronUp,
  Search,
  ExternalLink,
} from "lucide-react";

interface ResearchResultsTableProps {
  results: ResearchResult[];
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (key: string) => void;
  onDeepDive: (result: ResearchResult) => void;
  onTagClick?: (tag: string) => void;
}

function ScoreCell({ score }: { score: number }) {
  let bg = "var(--mc-error)";
  if (score >= 8) bg = "var(--mc-success)";
  else if (score >= 5) bg = "var(--mc-warning)";

  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 text-[10px] font-bold"
      style={{ background: bg, color: "#000" }}
    >
      {score}
    </span>
  );
}

const TYPE_LABELS: Record<string, string> = {
  bar: "Bar",
  restaurant: "Restaurant",
  distributor: "Distributor",
  competitor: "Competitor",
  hotel: "Hotel",
  other: "Other",
};

const COLUMNS = [
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
  { key: "relevanceScore", label: "Score" },
  { key: "city", label: "City" },
  { key: "phone", label: "Phone" },
  { key: "website", label: "Website" },
];

export default function ResearchResultsTable({
  results,
  sortBy,
  sortDir,
  onSort,
  onDeepDive,
  onTagClick,
}: ResearchResultsTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  return (
    <div className="mc-card overflow-hidden">
      <table className="mc-table w-full">
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className="cursor-pointer select-none"
                onClick={() => onSort(col.key)}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {sortBy === col.key &&
                    (sortDir === "asc" ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    ))}
                </div>
              </th>
            ))}
            <th className="w-20">Tags</th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody>
          {results.map((result, i) => {
            const rowKey = `${result.name}-${i}`;
            const isExpanded = expandedRow === rowKey;

            return (
              <>
                <tr
                  key={rowKey}
                  className="cursor-pointer"
                  onClick={() => setExpandedRow(isExpanded ? null : rowKey)}
                >
                  <td>
                    <span
                      className="font-medium text-xs"
                      style={{ color: "var(--mc-text-primary)" }}
                    >
                      {result.name}
                    </span>
                  </td>
                  <td>
                    <span
                      className="text-[9px] font-semibold tracking-[0.08em] uppercase px-1.5 py-0.5"
                      style={{
                        background: "rgba(236, 223, 204, 0.08)",
                        color: "var(--mc-cream-muted)",
                        border: "1px solid var(--mc-border)",
                      }}
                    >
                      {TYPE_LABELS[result.type] || result.type}
                    </span>
                  </td>
                  <td>
                    <ScoreCell score={result.relevanceScore} />
                  </td>
                  <td className="text-[11px]">{result.city || "—"}</td>
                  <td className="text-[11px]">{result.phone || "—"}</td>
                  <td className="text-[11px]">
                    {result.website ? (
                      <a
                        href={result.website.startsWith("http") ? result.website : `https://${result.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:underline"
                        style={{ color: "var(--mc-cream-muted)" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3" />
                        Link
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      {result.categoryTags?.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className={`text-[8px] px-1 py-0.5 transition-colors${onTagClick ? " cursor-pointer hover:!bg-[rgba(236,223,204,0.12)] hover:!border-[var(--mc-cream-muted)]" : ""}`}
                          style={{
                            background: "rgba(236, 223, 204, 0.04)",
                            color: "var(--mc-text-muted)",
                            border: "1px solid var(--mc-border)",
                          }}
                          onClick={
                            onTagClick
                              ? (e) => {
                                  e.stopPropagation();
                                  onTagClick(tag);
                                }
                              : undefined
                          }
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeepDive(result);
                      }}
                      className="p-1 transition-colors"
                      style={{ color: "var(--mc-text-muted)" }}
                      title="Research deeper"
                    >
                      <Search className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${rowKey}-detail`}>
                    <td colSpan={8} className="!p-4" style={{ background: "rgba(236, 223, 204, 0.02)" }}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p
                            className="text-[9px] font-semibold tracking-[0.08em] uppercase mb-1"
                            style={{ color: "var(--mc-cream-muted)" }}
                          >
                            Why this matters
                          </p>
                          <p className="text-[11px] leading-relaxed" style={{ color: "var(--mc-text-secondary)" }}>
                            {result.suggestion}
                          </p>
                        </div>
                        <div>
                          <p
                            className="text-[9px] font-semibold tracking-[0.08em] uppercase mb-1"
                            style={{ color: "var(--mc-cream-muted)" }}
                          >
                            Outreach idea
                          </p>
                          <p className="text-[11px] leading-relaxed" style={{ color: "var(--mc-text-secondary)" }}>
                            {result.outreachIdea}
                          </p>
                        </div>
                      </div>
                      {result.keyDetails && (
                        <div className="mt-3">
                          <p
                            className="text-[9px] font-semibold tracking-[0.08em] uppercase mb-1"
                            style={{ color: "var(--mc-cream-muted)" }}
                          >
                            Key details
                          </p>
                          <p className="text-[11px] leading-relaxed" style={{ color: "var(--mc-text-tertiary)" }}>
                            {result.keyDetails}
                          </p>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
