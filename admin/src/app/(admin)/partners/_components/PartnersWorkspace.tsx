"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import type { Partner } from "@mecanova/shared";
import { Users, Plus } from "lucide-react";
import PartnersSidebar from "./PartnersSidebar";
import PartnerDetailPanel from "./PartnerDetailPanel";
import PartnerFormModal from "./PartnerFormModal";

interface Props {
  selectedId: string | null;
}

export default function PartnersWorkspace({ selectedId }: Props) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<string | null>(selectedId);
  const [showCreate, setShowCreate] = useState(false);
  const supabase = createClient();

  const loadPartners = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("partners").select("*").order("name");
    setPartners(data ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  // Deep-link / route prop change → reflect as selection.
  useEffect(() => {
    setSel(selectedId);
  }, [selectedId]);

  // Browser back/forward keeps selection in sync without a route remount.
  useEffect(() => {
    const onPop = () => {
      const m = window.location.pathname.match(/^\/partners\/([^/]+)/);
      setSel(m ? decodeURIComponent(m[1]) : null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Client-side selection: update the address bar but do NOT trigger a Next
  // route navigation (which would remount the workspace and refetch).
  const handleSelect = useCallback((id: string) => {
    setSel(id);
    if (window.location.pathname !== `/partners/${id}`) {
      window.history.pushState(null, "", `/partners/${id}`);
    }
  }, []);

  // Patch a single partner in place (no full refetch) after an edit, or
  // fall back to a full reload when no partner object is provided.
  const handlePartnerChanged = useCallback(
    (p?: Partner) => {
      if (p) {
        setPartners((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
      } else {
        loadPartners();
      }
    },
    [loadPartners]
  );

  const activeCount = partners.filter((p) => p.crm_status !== "inactive").length;
  const inactiveCount = partners.length - activeCount;

  return (
    <div
      className="mc-fullheight-page"
      style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      <PageHeader
        title="Partners"
        description={`${activeCount} active${inactiveCount > 0 ? `, ${inactiveCount} inactive` : ""}`}
        icon={Users}
        actions={
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="mc-btn mc-btn-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Partner
          </button>
        }
      />

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <PartnersSidebar
          partners={partners}
          selectedId={sel}
          loading={loading}
          onSelect={handleSelect}
        />

        {sel ? (
          <PartnerDetailPanel
            id={sel}
            onPartnerChanged={handlePartnerChanged}
          />
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <EmptyState
              icon={Users}
              title="Select a partner"
              description="Choose a partner from the list on the left to view their details"
            />
          </div>
        )}
      </div>

      {showCreate && (
        <PartnerFormModal
          mode="create"
          onClose={() => setShowCreate(false)}
          onSaved={(p) => {
            setPartners((prev) =>
              [...prev, p].sort((a, b) => a.name.localeCompare(b.name))
            );
            setShowCreate(false);
            handleSelect(p.id);
          }}
        />
      )}
    </div>
  );
}
