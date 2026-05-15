import type { ExportBundle } from "./types";

const C = {
  charcoal:   "FF111111",
  cream:      "FFECDFCC",
  creamLight: "FFFFF9F2",
  sectionBg:  "FFF2EDE4",
  resultBg:   "FFECDFCC",
  textDark:   "FF1A1A1A",
  textMuted:  "FF7D7468",
  dimGray:    "FFAAAAAA",
  success:    "FF6B8F6E",
};

type Fill = { type: "pattern"; pattern: "solid"; fgColor: { argb: string } };
const mkFill = (argb: string): Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

export async function exportToExcel(bundle: ExportBundle): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Mecanova Partner Portal";
  wb.created = new Date();

  const ws = wb.addWorksheet("Pricing", {
    pageSetup: { fitToPage: true, fitToWidth: 1, paperSize: 9 },
  });

  const {
    inputs, result, productName, productBrand,
    abv, sizeMl, bottlesPerCase, scenarioName, notes, createdAt,
  } = bundle;

  ws.getColumn("A").width = 38;
  ws.getColumn("B").width = 16;
  ws.getColumn("C").width = 15;
  ws.getColumn("D").width = 38;

  let R = 1;
  const euro = '"€"#,##0.00';
  const pct  = '0.00"%"';
  const num2 = '#,##0.000000';

  // ─── Helper: write a label in A, an editable value in B, unit in C, note in D ───
  function inputRow(label: string, value: number, unit: string, fmt: string, note?: string): number {
    const r = R;
    ws.getRow(r).height = 15;
    ws.getCell(`A${r}`).value = label;
    ws.getCell(`A${r}`).font = { name: "Calibri", size: 9, color: { argb: C.textDark } };
    const vc = ws.getCell(`B${r}`);
    vc.value = value;
    vc.fill = mkFill(C.creamLight);
    vc.font = { name: "Calibri", size: 9 };
    vc.numFmt = fmt;
    vc.border = { bottom: { style: "thin", color: { argb: C.cream } } };
    ws.getCell(`C${r}`).value = unit;
    ws.getCell(`C${r}`).font = { name: "Calibri", size: 8, italic: true, color: { argb: C.textMuted } };
    if (note) {
      ws.getCell(`D${r}`).value = note;
      ws.getCell(`D${r}`).font = { name: "Calibri", size: 8, italic: true, color: { argb: C.textMuted } };
    }
    R++;
    return r;
  }

  // ─── Helper: formula row with /bottle column ───
  function calcRow(
    label: string,
    formula: string,
    cached: number,
    formulaDesc: string,
    bpcFormula: string,
    opts: { total?: boolean; headline?: boolean; dim?: boolean } = {}
  ): number {
    const r = R;
    ws.getRow(r).height = 15;
    const bg = opts.headline ? C.resultBg : opts.total ? C.sectionBg : undefined;
    const fgColor = { argb: opts.dim ? C.dimGray : opts.headline ? C.charcoal : C.textDark };

    ws.getCell(`A${r}`).value = label;
    ws.getCell(`A${r}`).font = { name: "Calibri", size: 9, bold: !!(opts.total || opts.headline), color: fgColor };
    if (bg) ws.getCell(`A${r}`).fill = mkFill(bg);

    const vc = ws.getCell(`B${r}`);
    vc.value = { formula, result: cached };
    vc.font = { name: "Calibri", size: 9, bold: !!(opts.total || opts.headline), color: fgColor };
    vc.numFmt = euro;
    if (bg) vc.fill = mkFill(bg);

    const bc = ws.getCell(`C${r}`);
    bc.value = { formula: bpcFormula, result: cached / bottlesPerCase };
    bc.font = { name: "Calibri", size: 8, bold: !!(opts.total || opts.headline), color: { argb: opts.dim ? C.dimGray : C.textMuted } };
    bc.numFmt = euro;
    if (bg) bc.fill = mkFill(bg);

    ws.getCell(`D${r}`).value = formulaDesc;
    ws.getCell(`D${r}`).font = { name: "Calibri", size: 8, italic: true, color: { argb: opts.dim ? C.dimGray : C.textMuted } };
    if (bg) ws.getCell(`D${r}`).fill = mkFill(bg);

    R++;
    return r;
  }

  function sectionHeader(label: string) {
    R++;
    ws.getRow(R).height = 16;
    ws.getCell(`A${R}`).value = label.toUpperCase();
    ws.getCell(`A${R}`).font = { name: "Calibri", size: 8, bold: true, color: { argb: C.textMuted } };
    ws.getCell(`A${R}`).fill = mkFill(C.sectionBg);
    ws.getCell(`A${R}`).alignment = { horizontal: "left", vertical: "middle" };
    ws.mergeCells(`A${R}:D${R}`);
    R++;
  }

  function subLabel(label: string) {
    ws.getRow(R).height = 13;
    ws.getCell(`A${R}`).value = label;
    ws.getCell(`A${R}`).font = { name: "Calibri", size: 8, bold: true, color: { argb: C.textMuted } };
    R++;
  }

  function blank() { R++; }

  // ─── HEADER ──────────────────────────────────────────────────────
  ws.getRow(R).height = 22;
  ws.getCell(`A${R}`).value = scenarioName || `${productName} — Pricing Measurement`;
  ws.getCell(`A${R}`).font = { name: "Calibri", size: 14, bold: true, color: { argb: C.charcoal } };
  ws.mergeCells(`A${R}:D${R}`);
  R++;

  ws.getRow(R).height = 14;
  ws.getCell(`A${R}`).value = `${productName}${productBrand ? ` · ${productBrand}` : ""}`;
  ws.getCell(`A${R}`).font = { name: "Calibri", size: 9, color: { argb: C.textMuted } };
  const dateLabel = createdAt
    ? new Date(createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  ws.getCell(`D${R}`).value = `Date: ${dateLabel}`;
  ws.getCell(`D${R}`).font = { name: "Calibri", size: 8, color: { argb: C.textMuted } };
  ws.getCell(`D${R}`).alignment = { horizontal: "right" };
  R++;

  ws.getRow(R).height = 13;
  ws.getCell(`A${R}`).value = `Mode: ${inputs.mode === "cost_up" ? "Cost-Up (Forward)" : "Price-Down (Backward)"}   ·   ABV: ${abv}%   ·   ${sizeMl} mL   ·   ${bottlesPerCase} btl/case`;
  ws.getCell(`A${R}`).font = { name: "Calibri", size: 8, color: { argb: C.textMuted } };
  R++;

  ws.getRow(R).height = 14;
  ws.getCell(`A${R}`).value = "  Cells with a cream background are INPUTS — edit them. All white cells are formulas that recalculate automatically.";
  ws.getCell(`A${R}`).font = { name: "Calibri", size: 8, italic: true, color: { argb: C.textMuted } };
  ws.getCell(`A${R}`).fill = mkFill("FFFFF4E6");
  ws.mergeCells(`A${R}:D${R}`);
  R++;

  // ─── INPUTS ──────────────────────────────────────────────────────
  sectionHeader("Inputs — edit these cells");

  subLabel("Supplier & Currency");
  const rSupplierPrice = inputRow("Supplier Price per Case", inputs.supplierPricePerCase, inputs.supplierCurrency, euro);

  let rFxRate: number;
  let rFxBufPct: number;
  if (inputs.supplierCurrency !== "EUR") {
    rFxRate = inputRow(`FX Rate  (${inputs.supplierCurrency} → EUR)`,
      inputs.supplierCurrency === "USD" ? inputs.fxUsdEur : inputs.fxMxnEur,
      `EUR per 1 ${inputs.supplierCurrency}`, num2, "Exchange rate used in this calculation");
    rFxBufPct = inputRow("FX Buffer %", inputs.fxBufferPct, "%", pct, "Currency risk buffer");
  } else {
    rFxRate = inputRow("FX Rate  (EUR → EUR)", 1, "EUR per EUR", num2, "No conversion — EUR supplier");
    rFxBufPct = inputRow("FX Buffer %", 0, "%", pct, "No FX buffer needed for EUR suppliers");
  }
  const rOrderCases = inputRow("Order Cases (for freight allocation)", inputs.orderCases, "cases", "0", "Total cases in shipment — divides freight");

  blank();
  subLabel("Freight & Insurance");
  const rIntlFreight = inputRow("International Freight Total", inputs.internationalFreightEur, "EUR total", euro, `Mode: ${inputs.freightMode}`);
  const rLocalTransport = inputRow(
    inputs.freightMode !== "land" ? "Local Transport Total" : "Local Transport Total (land mode — set to 0)",
    inputs.freightMode !== "land" ? inputs.localTransportEur : 0,
    "EUR total", euro);
  const rInsurPct = inputRow("Insurance %", inputs.insurancePct, "%", pct, "Applied on CIF (supplier + freight)");
  const rBreakPct = inputRow("Breakage Allowance %", inputs.breakagePct, "%", pct, "Transit losses");

  blank();
  subLabel("Import Duties (Germany)");
  const rCustDutyPct = inputRow("Customs Duty %", inputs.customsDutyPct, "%", pct, "On CIF value, Art. 70 UCC");
  const rExciseRate  = inputRow("Branntweinsteuer Rate (per hL pure alcohol)", inputs.exciseRatePerHl, "EUR/hL", euro, "NOT reclaimable");
  const rVatRate     = inputRow("Import VAT Rate", inputs.importVatRate, "%", pct, "Reclaimable for VAT-registered businesses");
  const rAbv         = inputRow("ABV (alcohol by volume)", abv, "%", pct, "From product data");
  const rSizeMl      = inputRow("Bottle Size", sizeMl, "mL", "0", "From product data");
  const rBPC         = inputRow("Bottles per Case", bottlesPerCase, "bottles", "0", "From product data");

  blank();
  subLabel("Domestic Costs");
  const rDomLog      = inputRow("Dom. Logistics Total", inputs.domLogisticsTotal ?? 0, "EUR total", euro, "Divided by order cases");
  const rWarePerMo   = inputRow("Warehousing per Case / Month", inputs.warehousingPerCaseMo, "EUR/case/mo", euro);
  const rHoldMonths  = inputRow("Holding Period", inputs.holdingMonths, "months", "0.0");
  const rDistFee     = inputRow("Distributor Fee (per case)", result.distributorFee, "EUR/case", euro, `Mode: ${inputs.distributorFeeMode} — converted to per-case`);

  blank();
  subLabel("Compliance & Overhead");
  const rLabelPerBot = inputRow("Labeling Cost per Bottle", inputs.labelingPerBottle, "EUR/bottle", euro);
  const rSampPct     = inputRow("Sample Rate %", inputs.sampleRatePct, "%", pct, "Cost of gifted samples allocated to sold cases");
  const rOvhPct      = inputRow("Overhead %", inputs.overheadPct, "%", pct, "General admin overhead");

  blank();
  subLabel("Targets");
  const rTargMargin  = inputRow("Target Margin %", inputs.targetMarginPct, "%", pct, "Gross margin as % of selling price");
  const rTargPrice   = inputRow("Target Price per Case (Price-Down)", inputs.targetPricePerCase || 0, "EUR/case", euro, "Used only in Price-Down mode");

  // ─── COST BREAKDOWN ──────────────────────────────────────────────
  sectionHeader("Cost Breakdown per Case  (white = formula, recalculates automatically)");

  ws.getRow(R).height = 13;
  ws.getCell(`A${R}`).value = "Cost Item";
  ws.getCell(`B${R}`).value = "€ / case";
  ws.getCell(`C${R}`).value = "€ / bottle";
  ws.getCell(`D${R}`).value = "Formula (for reference)";
  ["A","B","C","D"].forEach(col => {
    ws.getCell(`${col}${R}`).font = { name: "Calibri", size: 8, bold: true, color: { argb: C.textMuted } };
  });
  ws.getCell(`B${R}`).alignment = { horizontal: "right" };
  ws.getCell(`C${R}`).alignment = { horizontal: "right" };
  R++;

  const B = (r: number) => `B${r}`;
  const BPC = B(rBPC);

  const rBaseSupplier = calcRow(
    "Base Supplier Price (EUR)",
    `${B(rSupplierPrice)}*${B(rFxRate)}`,
    result.supplierPriceEur - result.fxBufferCost,
    "= SupplierPrice × FXRate",
    `B${R}/${BPC}`);

  const rFxBufCalc = calcRow(
    "FX Buffer",
    `${B(rBaseSupplier)}*${B(rFxBufPct)}/100`,
    result.fxBufferCost,
    "= Base × FXBuffer%",
    `B${R}/${BPC}`);

  const rSpEur = calcRow(
    "Supplier Price EUR (incl. FX buffer)",
    `${B(rBaseSupplier)}+${B(rFxBufCalc)}`,
    result.supplierPriceEur,
    "= Base + FXBuffer",
    `B${R}/${BPC}`);

  // Compute cached values for freight intermediates
  const safeCases = Math.max(1, inputs.orderCases);
  const localPerCaseCached = inputs.freightMode !== "land" ? inputs.localTransportEur / safeCases : 0;
  const intlPerCaseCached = inputs.internationalFreightEur / safeCases + localPerCaseCached;

  const rIntlPerCase = calcRow(
    "International Freight per Case",
    `${B(rIntlFreight)}/MAX(1,${B(rOrderCases)})`,
    inputs.internationalFreightEur / safeCases,
    "= IntlFreight ÷ OrderCases",
    `B${R}/${BPC}`);

  const rLocalPerCase = calcRow(
    "Local Transport per Case",
    `${B(rLocalTransport)}/MAX(1,${B(rOrderCases)})`,
    localPerCaseCached,
    "= LocalTransport ÷ OrderCases",
    `B${R}/${BPC}`);

  const rFreightPerCase = calcRow(
    "Freight per Case",
    `${B(rIntlPerCase)}+${B(rLocalPerCase)}`,
    intlPerCaseCached,
    "= IntlCase + LocalCase",
    `B${R}/${BPC}`);

  const rFreightAndIns = calcRow(
    "Freight & Insurance",
    `${B(rFreightPerCase)}+(${B(rSpEur)}+${B(rFreightPerCase)})*${B(rInsurPct)}/100`,
    result.freightAndInsurance,
    "= Freight + (Supplier+Freight)×Insurance%",
    `B${R}/${BPC}`);

  const rCif = calcRow(
    "CIF Value (customs basis)",
    `${B(rSpEur)}+${B(rFreightAndIns)}`,
    result.supplierPriceEur + result.freightAndInsurance,
    "= SupplierEUR + FreightAndInsurance",
    `B${R}/${BPC}`);

  const rBreakCalc = calcRow(
    "Breakage Allowance",
    `${B(rCif)}*${B(rBreakPct)}/100/MAX(0.0001,1-${B(rBreakPct)}/100)`,
    result.breakageCost,
    "= CIF × Break% ÷ (1−Break%)  [markup equivalent]",
    `B${R}/${BPC}`);

  const rCustCalc = calcRow(
    "Customs Duty",
    `${B(rCif)}*${B(rCustDutyPct)}/100`,
    result.customsDuty,
    "= CIF × CustomsDuty%",
    `B${R}/${BPC}`);

  const rExciseCalc = calcRow(
    "Branntweinsteuer (Excise)  ⚠ NOT reclaimable",
    `(${B(rAbv)}/100)*(${B(rSizeMl)}/1000)*${B(rBPC)}*(${B(rExciseRate)}/100)`,
    result.excisePerCase,
    "= ABV × SizeL × BPC × (Rate÷100)",
    `B${R}/${BPC}`);

  const rDomCalc = calcRow(
    "Dom. Logistics per Case",
    `${B(rDomLog)}/MAX(1,${B(rOrderCases)})`,
    result.domLogistics,
    "= DomLogisticsTotal ÷ OrderCases",
    `B${R}/${BPC}`);

  calcRow(
    "Import VAT  (reclaimable — shown for reference only, NOT in landed cost)",
    `(${B(rCif)}+${B(rCustCalc)}+${B(rExciseCalc)}+${B(rDomCalc)})*${B(rVatRate)}/100`,
    result.importVat,
    "= (CIF+Duty+Excise+Dom)×VAT%  — reclaimable B2B",
    `B${R}/${BPC}`,
    { dim: true });

  const rWareCalc = calcRow(
    "Warehousing",
    `${B(rWarePerMo)}*${B(rHoldMonths)}`,
    result.warehousing,
    "= WarehousingPerMo × HoldingMonths",
    `B${R}/${BPC}`);

  const rDistCalc = calcRow(
    "Distributor Fee",
    `${B(rDistFee)}`,
    result.distributorFee,
    "= DistributorFee (per case)",
    `B${R}/${BPC}`);

  const rLabelCalc = calcRow(
    "Labeling & Compliance",
    `${B(rLabelPerBot)}*${B(rBPC)}`,
    result.labeling,
    "= LabelingPerBottle × BottlesPerCase",
    `B${R}/${BPC}`);

  const preSampleCached = result.supplierPriceEur + result.freightAndInsurance
    + result.breakageCost + result.customsDuty + result.excisePerCase
    + result.domLogistics + result.warehousing + result.distributorFee + result.labeling;

  const rPreSamp = calcRow(
    "Pre-Sample Cost (subtotal)",
    `${B(rCif)}+${B(rBreakCalc)}+${B(rCustCalc)}+${B(rExciseCalc)}+${B(rDomCalc)}+${B(rWareCalc)}+${B(rDistCalc)}+${B(rLabelCalc)}`,
    preSampleCached,
    "= CIF + Breakage + Customs + Excise + DomLog + Ware + Dist + Label",
    `B${R}/${BPC}`);

  const rSampCalc = calcRow(
    "Sample Allocation",
    `${B(rPreSamp)}*(${B(rSampPct)}/100)/MAX(0.01,1-${B(rSampPct)}/100)`,
    result.sampleAllocation,
    "= PreSample × SampleRate% ÷ (1−SampleRate%)",
    `B${R}/${BPC}`);

  const preOvhCached = preSampleCached + result.sampleAllocation;
  const rPreOvh = calcRow(
    "Pre-Overhead Cost",
    `${B(rPreSamp)}+${B(rSampCalc)}`,
    preOvhCached,
    "= PreSample + Samples",
    `B${R}/${BPC}`);

  const rOvhCalc = calcRow(
    "Overhead",
    `${B(rPreOvh)}*${B(rOvhPct)}/100`,
    result.overhead,
    "= PreOverhead × Overhead%",
    `B${R}/${BPC}`);

  const rTlc = calcRow(
    "TOTAL LANDED COST / Case",
    `${B(rPreOvh)}+${B(rOvhCalc)}`,
    result.totalLandedCostPerCase,
    "= PreOverhead + Overhead",
    `B${R}/${BPC}`,
    { total: true });

  // Landed cost per bottle row (simple ref to B column)
  ws.getRow(R).height = 14;
  ws.getCell(`A${R}`).value = "TOTAL LANDED COST / Bottle";
  ws.getCell(`A${R}`).font = { name: "Calibri", size: 9, bold: true };
  ws.getCell(`A${R}`).fill = mkFill(C.sectionBg);
  const tlcBotCell = ws.getCell(`B${R}`);
  tlcBotCell.value = { formula: `${B(rTlc)}/${BPC}`, result: result.totalLandedCostPerBottle };
  tlcBotCell.numFmt = euro;
  tlcBotCell.font = { name: "Calibri", size: 9, bold: true };
  tlcBotCell.fill = mkFill(C.sectionBg);
  ws.getCell(`C${R}`).value = "€ / bottle";
  ws.getCell(`C${R}`).font = { name: "Calibri", size: 8, italic: true, color: { argb: C.textMuted } };
  ws.getCell(`C${R}`).fill = mkFill(C.sectionBg);
  ws.getCell(`D${R}`).fill = mkFill(C.sectionBg);
  R++;

  // ─── RESULTS ─────────────────────────────────────────────────────
  sectionHeader("Results");

  subLabel("Cost-Up (Forward)  —  how high can I sell?");

  const rMarginAmt = calcRow(
    "Target Margin Amount",
    `${B(rTlc)}*(${B(rTargMargin)}/100)/MAX(0.01,1-${B(rTargMargin)}/100)`,
    result.marginAmount,
    "= TotalLanded × Margin% ÷ (1−Margin%)",
    `B${R}/${BPC}`);

  const rMinPrice = calcRow(
    "MIN. SELLING PRICE / Case",
    `${B(rTlc)}+${B(rMarginAmt)}`,
    result.minSellingPricePerCase,
    "= TotalLanded + MarginAmount",
    `B${R}/${BPC}`,
    { headline: true });

  ws.getRow(R).height = 14;
  ws.getCell(`A${R}`).value = "MIN. SELLING PRICE / Bottle";
  ws.getCell(`A${R}`).font = { name: "Calibri", size: 9, bold: true, color: { argb: C.charcoal } };
  ws.getCell(`A${R}`).fill = mkFill(C.resultBg);
  const mspBotCell = ws.getCell(`B${R}`);
  mspBotCell.value = { formula: `${B(rMinPrice)}/${BPC}`, result: result.minSellingPricePerBottle };
  mspBotCell.numFmt = euro;
  mspBotCell.font = { name: "Calibri", size: 9, bold: true };
  mspBotCell.fill = mkFill(C.resultBg);
  ws.getCell(`C${R}`).fill = mkFill(C.resultBg);
  ws.getCell(`D${R}`).fill = mkFill(C.resultBg);
  R++;

  ws.getRow(R).height = 14;
  ws.getCell(`A${R}`).value = "Actual Margin %";
  ws.getCell(`A${R}`).font = { name: "Calibri", size: 9 };
  const actMarCell = ws.getCell(`B${R}`);
  actMarCell.value = {
    formula: `(${B(rMinPrice)}-${B(rTlc)})/${B(rMinPrice)}*100`,
    result: result.actualMarginPct,
  };
  actMarCell.numFmt = pct;
  actMarCell.font = { name: "Calibri", size: 9, bold: true, color: { argb: C.success } };
  R++;

  blank();
  subLabel("Price-Down (Backward)  —  what can I pay the supplier?");

  // PD internal rows (dim)
  ws.getRow(R).height = 13;
  ws.getCell(`A${R}`).value = "PD Factor (k)  — internal";
  ws.getCell(`A${R}`).font = { name: "Calibri", size: 8, color: { argb: C.dimGray } };
  const pdKval = (1 + inputs.insurancePct / 100)
    * (1 / Math.max(0.001, 1 - inputs.breakagePct / 100) + inputs.customsDutyPct / 100)
    * (1 + inputs.overheadPct / 100)
    / Math.max(0.001, 1 - inputs.sampleRatePct / 100);
  const pdKCell = ws.getCell(`B${R}`);
  pdKCell.value = {
    formula: `(1+${B(rInsurPct)}/100)*(1/MAX(0.001,1-${B(rBreakPct)}/100)+${B(rCustDutyPct)}/100)*(1+${B(rOvhPct)}/100)/MAX(0.001,1-${B(rSampPct)}/100)`,
    result: pdKval,
  };
  pdKCell.numFmt = "#,##0.00000";
  pdKCell.font = { name: "Calibri", size: 8, color: { argb: C.dimGray } };
  const rPdK = R;
  R++;

  ws.getRow(R).height = 13;
  ws.getCell(`A${R}`).value = "PD Constant (c)  — internal";
  ws.getCell(`A${R}`).font = { name: "Calibri", size: 8, color: { argb: C.dimGray } };
  const pdCval = result.totalLandedCostPerCase - result.supplierPriceEur * pdKval;
  const pdCCell = ws.getCell(`B${R}`);
  pdCCell.value = {
    formula: `${B(rTlc)}-${B(rSpEur)}*${B(rPdK)}`,
    result: pdCval,
  };
  pdCCell.numFmt = euro;
  pdCCell.font = { name: "Calibri", size: 8, color: { argb: C.dimGray } };
  const rPdC = R;
  R++;

  ws.getRow(R).height = 16;
  ws.getCell(`A${R}`).value = "MAX SUPPLIER PRICE / Case (EUR)";
  ws.getCell(`A${R}`).font = { name: "Calibri", size: 9, bold: true, color: { argb: C.charcoal } };
  ws.getCell(`A${R}`).fill = mkFill(C.resultBg);
  const maxSpCell = ws.getCell(`B${R}`);
  maxSpCell.value = {
    formula: `MAX(0,(${B(rTargPrice)}*(1-${B(rTargMargin)}/100)-${B(rPdC)})/${B(rPdK)})`,
    result: result.maxSupplierPriceEur,
  };
  maxSpCell.numFmt = euro;
  maxSpCell.font = { name: "Calibri", size: 9, bold: true };
  maxSpCell.fill = mkFill(C.resultBg);
  ws.getCell(`C${R}`).fill = mkFill(C.resultBg);
  ws.getCell(`D${R}`).fill = mkFill(C.resultBg);
  const rMaxSp = R;
  R++;

  ws.getRow(R).height = 14;
  ws.getCell(`A${R}`).value = "MAX SUPPLIER PRICE / Bottle (EUR)";
  ws.getCell(`A${R}`).font = { name: "Calibri", size: 9, bold: true, color: { argb: C.charcoal } };
  ws.getCell(`A${R}`).fill = mkFill(C.resultBg);
  const maxSpBotCell = ws.getCell(`B${R}`);
  maxSpBotCell.value = { formula: `${B(rMaxSp)}/${BPC}`, result: result.maxSupplierPriceEur / bottlesPerCase };
  maxSpBotCell.numFmt = euro;
  maxSpBotCell.font = { name: "Calibri", size: 9, bold: true };
  maxSpBotCell.fill = mkFill(C.resultBg);
  ws.getCell(`C${R}`).fill = mkFill(C.resultBg);
  ws.getCell(`D${R}`).fill = mkFill(C.resultBg);
  R++;

  // ─── VOLUME TIERS ────────────────────────────────────────────────
  if (inputs.volumeTiers.length > 0) {
    sectionHeader("Volume Tiers");
    ws.getRow(R).height = 13;
    ["Tier", "Cases", "Supplier Price / Case (EUR)", "Min. Selling Price / Case (EUR)"].forEach((h, i) => {
      const col = ["A","B","C","D"][i];
      ws.getCell(`${col}${R}`).value = h;
      ws.getCell(`${col}${R}`).font = { name: "Calibri", size: 8, bold: true, color: { argb: C.textMuted } };
    });
    R++;
    result.tierResults.forEach((tier, i) => {
      ws.getRow(R).height = 14;
      ws.getCell(`A${R}`).value = `Tier ${i + 1}`;
      ws.getCell(`A${R}`).font = { name: "Calibri", size: 9 };
      ws.getCell(`B${R}`).value = `${tier.from_cases}–${tier.to_cases ?? "∞"}`;
      ws.getCell(`B${R}`).font = { name: "Calibri", size: 9 };
      const tierSpCell = ws.getCell(`C${R}`);
      tierSpCell.value = tier.supplier_price;
      tierSpCell.fill = mkFill(C.creamLight);
      tierSpCell.numFmt = euro;
      tierSpCell.font = { name: "Calibri", size: 9 };
      const tierResCell = ws.getCell(`D${R}`);
      tierResCell.value = tier.result_min_price ?? 0;
      tierResCell.numFmt = euro;
      tierResCell.font = { name: "Calibri", size: 9, bold: true };
      tierResCell.note = {
        texts: [{ font: { name: "Calibri", size: 8 }, text: "Pre-calculated value. To recalculate dynamically, replace the supplier price input (highlighted row) with the tier supplier price above." }],
      };
      R++;
    });
  }

  // ─── NOTES ───────────────────────────────────────────────────────
  if (notes) {
    blank();
    sectionHeader("Notes");
    ws.getRow(R).height = 14;
    ws.getCell(`A${R}`).value = notes;
    ws.getCell(`A${R}`).font = { name: "Calibri", size: 9, italic: true, color: { argb: C.textMuted } };
    ws.mergeCells(`A${R}:D${R}`);
    R++;
  }

  // ─── FOOTER ──────────────────────────────────────────────────────
  R += 2;
  ws.getRow(R).height = 12;
  ws.getCell(`A${R}`).value =
    "All prices are NET of VAT (Netto). Mecanova GmbH adds 19% Umsatzsteuer on invoicing. Import VAT is reclaimable for VAT-registered businesses. Generated by Mecanova Partner Portal.";
  ws.getCell(`A${R}`).font = { name: "Calibri", size: 7, italic: true, color: { argb: C.dimGray } };
  ws.mergeCells(`A${R}:D${R}`);

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
