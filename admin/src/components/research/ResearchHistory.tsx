import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ResearchSession, ResearchResult } from "@/lib/research-types";
import { X, Clock, Hash } from "lucide-react";

interface ResearchHistoryProps {
  onLoadSession: (results: ResearchResult[], query: string) => void;
  onClose: () => void;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

export default function ResearchHistory({
  onLoadSession,
  onClose,
}: ResearchHistoryProps) {
  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadSessions = useCallback(async () => {
    const { data } = await supabase
      .from("research_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      setSessions(data as unknown as ResearchSession[]);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 transition-opacity"
        style={{ background: "rgba(10, 11, 13, 0.7)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-[320px] max-w-full overflow-y-auto"
        style={{
          background: "var(--mc-surface)",
          borderLeft: "1px solid var(--mc-border)",
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-5 py-4"
          style={{
            background: "var(--mc-surface)",
            borderBottom: "1px solid var(--mc-border)",
          }}
        >
          <h2
            className="text-sm font-semibold"
            style={{
              fontFamily: "var(--font-jost), Jost, sans-serif",
              color: "var(--mc-text-primary)",
            }}
          >
            Research history
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 transition-colors"
            style={{ color: "var(--mc-text-muted)" }}
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-2">
          {loading ? (
            <>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="p-3">
                  <div className="mc-skeleton h-3 w-full mb-2" />
                  <div className="mc-skeleton h-2 w-20" />
                </div>
              ))}
            </>
          ) : sessions.length === 0 ? (
            <p className="text-[11px] text-center py-8" style={{ color: "var(--mc-text-muted)" }}>
              No research sessions yet
            </p>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => {
                  onLoadSession(session.results, session.query);
                  onClose();
                }}
                className="w-full text-left p-3 transition-all duration-200"
                style={{
                  background: "rgba(236, 223, 204, 0.02)",
                  border: "1px solid var(--mc-border)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(236, 223, 204, 0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(236, 223, 204, 0.02)";
                }}
              >
                <p
                  className="text-[11px] font-medium line-clamp-2 mb-1.5"
                  style={{ color: "var(--mc-text-primary)" }}
                >
                  {session.query}
                </p>
                <div className="flex items-center gap-3">
                  <span
                    className="flex items-center gap-1 text-[9px]"
                    style={{ color: "var(--mc-text-muted)" }}
                  >
                    <Hash className="w-2.5 h-2.5" strokeWidth={1.5} />
                    {session.result_count} results
                  </span>
                  <span
                    className="flex items-center gap-1 text-[9px]"
                    style={{ color: "var(--mc-text-muted)" }}
                  >
                    <Clock className="w-2.5 h-2.5" strokeWidth={1.5} />
                    {timeAgo(session.created_at)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
