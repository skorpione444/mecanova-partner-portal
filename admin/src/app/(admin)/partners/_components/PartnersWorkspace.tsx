"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import type { Partner } from "@mecanova/shared";
import { Users, Plus } from "lucide-react";
import PartnersSidebar from "./PartnersSidebar";
import PartnerDetailPanel from "./PartnerDetailPanel";

interface Props {
  selectedId: string | null;
}

export default function PartnersWorkspace({ selectedId }: Props) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
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

  const activeCount = partners.filter((p) => p.crm_status !== "inactive").length;
  const inactiveCount = partners.length - activeCount;

  return (
    <div
      className="mc-fullheight-page"
      style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      {/* Header */}
      <PageHeader
        title="Partners"
        description={`${activeCount} active${inactiveCount > 0 ? `, ${inactiveCount} inactive` : ""}`}
        icon={Users}
        actions={
          <Link href="/partners/new" className="mc-btn mc-btn-primary">
            <Plus className="w-3.5 h-3.5" />
            Add Partner
          </Link>
        }
      />

      {/* Split view */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <PartnersSidebar
          partners={partners}
          selectedId={selectedId}
          loading={loading}
        />

        {selectedId ? (
          <PartnerDetailPanel
            id={selectedId}
            onPartnerChanged={loadPartners}
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
    </div>
  );
}
