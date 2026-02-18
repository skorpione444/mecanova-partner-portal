"use client";

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Scale } from "lucide-react";

export default function ContractsPage() {
  return (
    <div>
      <PageHeader
        title="Contracts"
        description="Supplier agreements, distributor contracts, and license tracking"
        icon={Scale}
      />
      <EmptyState
        icon={Scale}
        title="Coming Soon"
        description="The contracts module will manage supplier agreements, distributor contracts, license/permit tracking with expiry alerts. This module requires new database tables that will be added in Phase 2."
      />
    </div>
  );
}



