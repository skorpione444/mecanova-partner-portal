"use client";

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Truck } from "lucide-react";

export default function LogisticsPage() {
  return (
    <div>
      <PageHeader
        title="Logistics"
        description="Shipping partners, shipment tracking, and customs documentation"
        icon={Truck}
      />
      <EmptyState
        icon={Truck}
        title="Coming Soon"
        description="The logistics module will manage shipping partners, track shipments from Mexico to Europe, and handle customs documentation. This module requires new database tables that will be added in Phase 2."
      />
    </div>
  );
}



