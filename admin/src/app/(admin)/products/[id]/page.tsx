"use client";

import { useParams } from "next/navigation";
import ProductsWorkspace from "../_components/ProductsWorkspace";

export default function ProductDetailPage() {
  const params = useParams();
  const id = params.id as string;
  return <ProductsWorkspace selectedId={id} />;
}
