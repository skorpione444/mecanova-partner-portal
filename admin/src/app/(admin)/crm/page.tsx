"use client";

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Contact } from "lucide-react";

export default function CRMPage() {
  return (
    <div>
      <PageHeader
        title="CRM"
        description="Contact management, interaction notes, and partner relationship history"
        icon={Contact}
      />
      <EmptyState
        icon={Contact}
        title="Coming Soon"
        description="The CRM module will manage contacts, track interactions, log notes, and maintain a complete relationship history with each partner. This module requires new database tables that will be added in Phase 2."
      />
    </div>
  );
}



