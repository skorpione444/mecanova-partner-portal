import type { ResearchResult } from "@/lib/research-types";
import {
  MapPin,
  Phone,
  Globe,
  Tag,
  Lightbulb,
  MessageSquare,
  Search,
} from "lucide-react";

interface ResearchResultCardProps {
  result: ResearchResult;
  onDeepDive: (result: ResearchResult) => void;
  onTagClick?: (tag: string) => void;
}

function ScoreBadge({ score }: { score: number }) {
  let bg = "var(--mc-error)";
  if (score >= 8) bg = "var(--mc-success)";
  else if (score >= 5) bg = "var(--mc-warning)";

  return (
    <div
      className="w-8 h-8 flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{ background: bg, color: "#000" }}
    >
      {score}
    </div>
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

export default function ResearchResultCard({
  result,
  onDeepDive,
  onTagClick,
}: ResearchResultCardProps) {
  return (
    <div className="mc-card p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <ScoreBadge score={result.relevanceScore} />
        <div className="flex-1 min-w-0">
          <h3
            className="text-sm font-semibold truncate"
            style={{
              fontFamily: "var(--font-jost), Jost, sans-serif",
              color: "var(--mc-text-primary)",
            }}
          >
            {result.name}
          </h3>
          <span
            className="inline-block text-[9px] font-semibold tracking-[0.08em] uppercase mt-0.5 px-1.5 py-0.5"
            style={{
              background: "rgba(236, 223, 204, 0.08)",
              color: "var(--mc-cream-muted)",
              border: "1px solid var(--mc-border)",
            }}
          >
            {TYPE_LABELS[result.type] || result.type}
          </span>
        </div>
      </div>

      {/* Contact details */}
      <div className="flex flex-col gap-1.5">
        {result.address && (
          <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--mc-text-secondary)" }}>
            <MapPin className="w-3 h-3 flex-shrink-0" strokeWidth={1.5} />
            <span className="truncate">{result.address}{result.city ? `, ${result.city}` : ""}</span>
          </div>
        )}
        {result.phone && (
          <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--mc-text-secondary)" }}>
            <Phone className="w-3 h-3 flex-shrink-0" strokeWidth={1.5} />
            <span>{result.phone}</span>
          </div>
        )}
        {result.website && (
          <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--mc-text-secondary)" }}>
            <Globe className="w-3 h-3 flex-shrink-0" strokeWidth={1.5} />
            <a
              href={result.website.startsWith("http") ? result.website : `https://${result.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate hover:underline"
              style={{ color: "var(--mc-cream-muted)" }}
            >
              {result.website.replace(/^https?:\/\//, "")}
            </a>
          </div>
        )}
      </div>

      {/* Key details */}
      <p className="text-[11px] leading-relaxed" style={{ color: "var(--mc-text-tertiary)" }}>
        {result.keyDetails}
      </p>

      {/* Tags */}
      {result.categoryTags?.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Tag className="w-3 h-3" strokeWidth={1.5} style={{ color: "var(--mc-text-muted)" }} />
          {result.categoryTags.map((tag) => (
            <span
              key={tag}
              className={`text-[9px] px-1.5 py-0.5 tracking-wide transition-colors${onTagClick ? " cursor-pointer hover:!bg-[rgba(236,223,204,0.12)] hover:!border-[var(--mc-cream-muted)]" : ""}`}
              style={{
                background: "rgba(236, 223, 204, 0.04)",
                color: "var(--mc-text-muted)",
                border: "1px solid var(--mc-border)",
              }}
              onClick={onTagClick ? () => onTagClick(tag) : undefined}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Suggestion */}
      <div
        className="p-3"
        style={{
          background: "rgba(236, 223, 204, 0.03)",
          border: "1px solid var(--mc-border)",
        }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <Lightbulb className="w-3 h-3" strokeWidth={1.5} style={{ color: "var(--mc-cream-muted)" }} />
          <span
            className="text-[9px] font-semibold tracking-[0.08em] uppercase"
            style={{ color: "var(--mc-cream-muted)" }}
          >
            Why this matters
          </span>
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--mc-text-secondary)" }}>
          {result.suggestion}
        </p>
      </div>

      {/* Outreach */}
      <div
        className="p-3"
        style={{
          background: "rgba(236, 223, 204, 0.03)",
          border: "1px solid var(--mc-border)",
        }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <MessageSquare className="w-3 h-3" strokeWidth={1.5} style={{ color: "var(--mc-cream-muted)" }} />
          <span
            className="text-[9px] font-semibold tracking-[0.08em] uppercase"
            style={{ color: "var(--mc-cream-muted)" }}
          >
            Outreach idea
          </span>
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--mc-text-secondary)" }}>
          {result.outreachIdea}
        </p>
      </div>

      {/* Deep dive button */}
      <button
        onClick={() => onDeepDive(result)}
        className="mc-btn mc-btn-ghost w-full flex items-center justify-center gap-2 text-[11px]"
      >
        <Search className="w-3.5 h-3.5" strokeWidth={1.5} />
        Research deeper
      </button>
    </div>
  );
}
