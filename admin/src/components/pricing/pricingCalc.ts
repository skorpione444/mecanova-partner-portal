import type { PricingInputs, PricingResult, VolumeTier } from "@mecanova/shared";

export function calcPricing(inputs: PricingInputs, abv: number, sizeMl: number, bottlesPerCase: number): PricingResult {
  const {
    supplierCurrency,
    fxUsdEur,
    fxMxnEur,
    fxBufferPct,
    supplierPricePerCase,
    orderCases,
    localTransportEur,
    localTransportCurrency,
    internationalFreightEur,
    internationalFreightCurrency,
    freightMode,
    insurancePct,
    breakagePct,
    customsDutyPct,
    exciseRatePerHl,
    importVatRate,
    domLogisticsTotal,
    warehousingPerCaseMo,
    holdingMonths,
    distributorFeeMode,
    distributorFeeAmount,
    labelingPerBottle,
    sampleRatePct,
    overheadPct,
    targetMarginPct,
    targetPricePerCase,
    volumeTiers,
  } = inputs;

  const getRate = (c: typeof supplierCurrency) =>
    c === "USD" ? fxUsdEur : c === "MXN" ? fxMxnEur : 1;

  // 1. Supplier price in EUR
  const fxRate = getRate(supplierCurrency);
  const baseSupplierEur = supplierPricePerCase * fxRate;
  const fxBufferCost = supplierCurrency !== "EUR" ? baseSupplierEur * (fxBufferPct / 100) : 0;
  const supplierPriceEur = baseSupplierEur + fxBufferCost;

  // 2. Freight & insurance (CIF basis)
  const safeCases = Math.max(1, orderCases);
  const localPerCase = freightMode !== "land"
    ? (localTransportEur * getRate(localTransportCurrency)) / safeCases : 0;
  const freightPerCase =
    (internationalFreightEur * getRate(internationalFreightCurrency)) / safeCases + localPerCase;
  const freightAndInsurance = freightPerCase + (supplierPriceEur + freightPerCase) * (insurancePct / 100);

  // 3. True CIF value (customs basis: supplier price + freight + insurance only)
  const cifValue = supplierPriceEur + freightAndInsurance;

  // 4. Breakage allowance — internal cost only, not part of customs/VAT base
  const breakageCost = cifValue * (breakagePct / 100) / (1 - breakagePct / 100);

  // 5. Customs duty (on CIF value only, per Art. 70 UCC)
  const customsDuty = cifValue * (customsDutyPct / 100);

  // 6. Branntweinsteuer (excise) — auto from product data
  // Formula: ABV × size_L × bottles_per_case × (rate_per_hl / 100)
  const pureAlcoholPerCase = (abv / 100) * (sizeMl / 1000) * bottlesPerCase;
  const excisePerCase = pureAlcoholPerCase * (exciseRatePerHl / 100);

  // 7. Domestic transport (needed for EUSt base)
  const domLogisticsPerCase = (domLogisticsTotal ?? 0) / safeCases;

  // 8. Import VAT — reclaimable for B2B (Einfuhrumsatzsteuer, base = CIF + duty + excise + domestic logistics)
  const importVatBase = cifValue + customsDuty + excisePerCase + domLogisticsPerCase;
  const importVat = importVatBase * (importVatRate / 100);

  // 9. Remaining domestic costs
  const warehousing = warehousingPerCaseMo * holdingMonths;
  const safeDistributorAmount = distributorFeeAmount ?? 0;
  const distributorFeePerCase =
    distributorFeeMode === "per_bottle" ? safeDistributorAmount * bottlesPerCase :
    distributorFeeMode === "total" ? safeDistributorAmount / safeCases :
    safeDistributorAmount;

  // 10. Sample allocation — selling cases absorb cost of gifted samples
  const preSampleCost = cifValue + breakageCost + customsDuty + excisePerCase
    + domLogisticsPerCase + warehousing + distributorFeePerCase + labelingPerBottle * bottlesPerCase;
  const sampleAllocation = preSampleCost * (sampleRatePct / 100) / Math.max(0.01, 1 - sampleRatePct / 100);

  // 10. Overhead
  const preOverheadCost = preSampleCost + sampleAllocation;
  const overhead = preOverheadCost * (overheadPct / 100);

  const totalLandedCostPerCase = preOverheadCost + overhead;
  const totalLandedCostPerBottle = bottlesPerCase > 0 ? totalLandedCostPerCase / bottlesPerCase : 0;

  // Cost-Up: minimum selling price
  const marginAmount = totalLandedCostPerCase * (targetMarginPct / 100) / Math.max(0.01, 1 - targetMarginPct / 100);
  const minSellingPricePerCase = totalLandedCostPerCase + marginAmount;
  const minSellingPricePerBottle = bottlesPerCase > 0 ? minSellingPricePerCase / bottlesPerCase : 0;
  const actualMarginPct = minSellingPricePerCase > 0
    ? ((minSellingPricePerCase - totalLandedCostPerCase) / minSellingPricePerCase) * 100
    : 0;

  // Price-Down: maximum supplier price — exact analytical inverse of cost-up.
  // totalLandedCost(S) = S·k + c, where k is the cascade multiplier of supplier price through
  // insurance → breakage → customs → sample → overhead, and c is all freight/fixed costs.
  // Solving T(1-m) = maxS·k + c  →  maxS = (T(1-m) - c) / k
  // c is isolated as: c = totalLandedCost - supplierPriceEur·k (robust regardless of current S).
  const pdK = (1 + insurancePct / 100)
    * (1 / Math.max(0.001, 1 - breakagePct / 100) + customsDutyPct / 100)
    * (1 + overheadPct / 100)
    / Math.max(0.001, 1 - sampleRatePct / 100);
  const pdC = totalLandedCostPerCase - supplierPriceEur * pdK;
  const maxSupplierPriceEur = Math.max(0,
    (targetPricePerCase * (1 - targetMarginPct / 100) - pdC) / Math.max(0.001, pdK)
  );
  const maxSupplierPriceOrigCurrency = supplierCurrency === "EUR" ? maxSupplierPriceEur
    : fxRate > 0 ? maxSupplierPriceEur / fxRate : 0;

  // Volume tier results
  const tierResults: VolumeTier[] = volumeTiers.map((tier) => {
    const tierInputs = { ...inputs, supplierPricePerCase: tier.supplier_price };
    const tierResult = calcPricing(tierInputs, abv, sizeMl, bottlesPerCase);
    return {
      ...tier,
      result_min_price: tierResult.minSellingPricePerCase,
      result_margin_pct: tierResult.actualMarginPct,
      result_max_supplier: tierResult.maxSupplierPriceEur,
    };
  });

  return {
    supplierPriceEur,
    fxBufferCost,
    freightAndInsurance,
    breakageCost,
    customsDuty,
    excisePerCase,
    importVat,
    domLogistics: domLogisticsPerCase,
    warehousing,
    distributorFee: distributorFeePerCase,
    labeling: labelingPerBottle * bottlesPerCase,
    sampleAllocation,
    overhead,
    totalLandedCostPerCase,
    totalLandedCostPerBottle,
    marginAmount,
    minSellingPricePerCase,
    minSellingPricePerBottle,
    actualMarginPct,
    maxSupplierPriceEur,
    maxSupplierPriceOrigCurrency,
    tierResults,
  };
}

export const DEFAULT_PRICING_INPUTS: PricingInputs = {
  productId: "",
  mode: "cost_up",
  supplierCurrency: "EUR",
  fxUsdEur: 0.92,
  fxMxnEur: 0.052,
  fxBufferPct: 3,
  supplierPricePerCase: 0,
  orderCases: 1,
  moqCases: null,
  localTransportEur: 0,
  localTransportCurrency: "MXN",
  internationalFreightEur: 0,
  internationalFreightCurrency: "USD",
  freightMode: "sea",
  insurancePct: 0.5,
  breakagePct: 1,
  hsCode: "",
  customsDutyPct: 0,
  exciseRatePerHl: 1303,
  importVatRate: 19,
  domLogisticsTotal: 0,
  warehousingPerCaseMo: 0,
  holdingMonths: 1,
  distributorFeeMode: "per_case",
  distributorFeeAmount: 0,
  labelingPerBottle: 0,
  sampleRatePct: 3,
  overheadPct: 0,
  targetMarginPct: 35,
  targetPricePerCase: 0,
  clientTier: "",
  volumeTiers: [],
};
