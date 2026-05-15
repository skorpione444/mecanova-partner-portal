import type { PricingInputs, PricingResult } from "@mecanova/shared";

export interface ExportBundle {
  inputs: PricingInputs;
  result: PricingResult;
  productName: string;
  productBrand: string | null;
  abv: number;
  sizeMl: number;
  bottlesPerCase: number;
  scenarioName?: string;
  notes?: string | null;
  createdAt?: string;
}
