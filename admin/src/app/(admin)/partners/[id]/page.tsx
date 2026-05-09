"use client";

import { useParams } from "next/navigation";
import PartnersWorkspace from "../_components/PartnersWorkspace";

export default function PartnerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  return <PartnersWorkspace selectedId={id} />;
}
