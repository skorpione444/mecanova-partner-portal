"use client";

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { DollarSign } from "lucide-react";

export default function FinancePage() {
  return (
    <div>
      <PageHeader
        title="Finance"
        description="Invoice tracking, payments, pricing tiers, and revenue analytics"
        icon={DollarSign}
      />
      <EmptyState
        icon={DollarSign}
        title="Coming Soon"
        description="The finance module will track invoices, manage payment records, set product pricing per partner, and provide revenue analytics. This module requires new database tables that will be added in Phase 2."
      />
    </div>
  );
}




