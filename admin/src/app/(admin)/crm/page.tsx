"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import type { Partner, Prospect } from "@mecanova/shared";
import type { SelectedEntity, GooglePlaceResult } from "@/components/crm/MapView";
import CRMFilters, { type CRMFilterState } from "@/components/crm/CRMFilters";
import CRMSidebar from "@/components/crm/CRMSidebar";
import PlacesSearchBar from "@/components/crm/PlacesSearchBar";
import ConvertProspectModal from "@/components/crm/ConvertProspectModal";

// Dynamic import prevents mapbox-gl SSR issues
const MapView = dynamic(() => import("@/components/crm/MapView"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#111111",
        color: "#7D7468",
        fontSize: "0.875rem",
        letterSpacing: "0.05em",
      }}
    >
      Loading map…
    </div>
  ),
});

const DEFAULT_FILTERS: CRMFilterState = {
  partnerType: "all",
  crmStatus: "all",
  source: "all",
};

export default function CRMPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [placeResults, setPlaceResults] = useState<GooglePlaceResult[]>([]);
  const [selected, setSelected] = useState<SelectedEntity | null>(null);
  const [filters, setFilters] = useState<CRMFilterState>(DEFAULT_FILTERS);
  const [convertTarget, setConvertTarget] = useState<Prospect | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [mapCenter, setMapCenter] = useState({ lat: 51.17, lng: 10.45 });
  const [searchRadius, setSearchRadius] = useState(3000);
  const [searchArea, setSearchArea] = useState<{ lat: number; lng: number; radius: number } | null>(null);

  const supabase = createClient();

  // Load current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, [supabase]);

  // Load prospects
  const loadProspects = useCallback(async () => {
    const { data } = await supabase
      .from("prospects")
      .select("*")
      .order("created_at", { ascending: false });
    setProspects(data ?? []);
  }, [supabase]);

  // Load partners (with CRM fields)
  const loadPartners = useCallback(async () => {
    const { data } = await supabase
      .from("partners")
      .select("*")
      .not("lat", "is", null);
    setPartners(data ?? []);
  }, [supabase]);

  useEffect(() => {
    loadProspects();
    loadPartners();
  }, [loadProspects, loadPartners]);

  // Apply filters to what's shown on the map
  const filteredProspects = prospects.filter((p) => {
    if (filters.source === "partners") return false;
    if (filters.crmStatus !== "all" && p.crm_status !== filters.crmStatus) return false;
    return true;
  });

  const filteredPartners = partners.filter((p) => {
    if (filters.source === "prospects") return false;
    if (filters.partnerType !== "all" && p.partner_type !== filters.partnerType) return false;
    if (filters.crmStatus !== "all" && p.crm_status !== filters.crmStatus) return false;
    return true;
  });

  // Handle adding a Google Place as a prospect
  const handleAddProspect = useCallback(
    async (place: GooglePlaceResult) => {
      const { data, error } = await supabase
        .from("prospects")
        .upsert(
          {
            name: place.name,
            address: place.address,
            lat: place.lat,
            lng: place.lng,
            google_place_id: place.placeId,
            crm_status: "uncontacted",
            contact_phone: place.phone ?? null,
          },
          { onConflict: "google_place_id" }
        )
        .select()
        .single();

      if (!error && data) {
        await loadProspects();
        // Switch selection to the newly created prospect
        setSelected({ type: "prospect", data: data as Prospect });
      }
    },
    [supabase, loadProspects]
  );

  // Handle prospect status/data update
  const handleProspectUpdated = useCallback(
    (updated: Prospect) => {
      setProspects((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
      if (selected?.type === "prospect" && selected.data.id === updated.id) {
        setSelected({ type: "prospect", data: updated });
      }
    },
    [selected]
  );

  // Handle partner status/data update
  const handlePartnerUpdated = useCallback(
    (updated: Partner) => {
      setPartners((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
      if (selected?.type === "partner" && selected.data.id === updated.id) {
        setSelected({ type: "partner", data: updated });
      }
    },
    [selected]
  );

  // Handle partner deleted (undo conversion)
  const handlePartnerDeleted = useCallback(
    (id: string) => {
      setPartners((prev) => prev.filter((p) => p.id !== id));
      setSelected(null);
      loadProspects(); // Restore prospect that was unlinked
    },
    [loadProspects]
  );

  // Handle conversion success
  const handleConverted = useCallback(
    async (partnerId: string) => {
      setConvertTarget(null);
      setSelected(null);
      await loadProspects();
      await loadPartners();
    },
    [loadProspects, loadPartners]
  );

  return (
    // Break out of AdminShell's max-w-7xl padding container
    <div
      className="-mx-5 lg:-mx-8 -mt-6 lg:-mt-8 flex flex-col"
      style={{ height: "100vh", overflow: "hidden" }}
    >
      {/* Filter bar */}
      <CRMFilters
        filters={filters}
        onChange={setFilters}
        prospectCount={prospects.length}
        partnerCount={partners.length}
      />

      {/* Map + Sidebar */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        {/* Map area */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {/* Floating search bar */}
          <PlacesSearchBar
            onResults={setPlaceResults}
            onSearchExecuted={(center, radius) => setSearchArea({ ...center, radius })}
            onClear={() => setSearchArea(null)}
            mapCenter={mapCenter}
            activeVenueType="all"
            radius={searchRadius}
            onRadiusChange={setSearchRadius}
          />

          <MapView
            prospects={filteredProspects}
            partners={filteredPartners}
            placeResults={placeResults}
            selected={selected}
            onSelect={setSelected}
            onCenterChange={setMapCenter}
            searchArea={searchArea}
          />
        </div>

        {/* Sidebar — slides in when something is selected */}
        {selected && (
          <CRMSidebar
            entity={selected}
            userId={userId}
            onClose={() => setSelected(null)}
            onProspectUpdated={handleProspectUpdated}
            onPartnerUpdated={handlePartnerUpdated}
            onPartnerDeleted={handlePartnerDeleted}
            onAddProspect={handleAddProspect}
            onConvertClick={setConvertTarget}
          />
        )}
      </div>

      {/* Convert modal */}
      {convertTarget && (
        <ConvertProspectModal
          prospect={convertTarget}
          onConverted={handleConverted}
          onClose={() => setConvertTarget(null)}
        />
      )}
    </div>
  );
}
