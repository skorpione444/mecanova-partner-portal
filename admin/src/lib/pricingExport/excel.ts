import type { ExportBundle } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Mecanova Pricing workbook — partner-facing redesign.
//
// FOUR tabs: Summary · Inputs · Given Values · Calculation.
//   • Inputs        — numbers staff/partners may edit  → BLUE font value cells
//   • Given Values  — law / market / product data       → GREY fill value cells
//   • Calculation   — the full waterfall (formulas)      → black on white
//   • Summary       — partner-facing first page (live references to Calculation)
//
// IMPORTANT: every formula's algebra and every cached `result:` value is an exact
// mirror of admin/src/components/pricing/pricingCalc.ts. Only the cell-address
// tokens inside formulas change so they point cross-sheet (e.g. B5 → 'Inputs'!B7).
// No measurement is altered.
// ─────────────────────────────────────────────────────────────────────────────

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
  inputBlue:  "FF1F4E79", // editable-input value FONT colour (financial-model convention)
  givenFill:  "FFE7E6E3", // grey FILL behind given-by-law / market / product values
  headlineBox:"FF111111", // Summary headline result box (charcoal) with cream text
};

type Fill = { type: "pattern"; pattern: "solid"; fgColor: { argb: string } };
const mkFill = (argb: string): Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

// A logical cell address, used to build cross-sheet formula references.
type Addr = { sheet: string; col: string; row: number };
// Always single-quote the sheet name: required for "Given Values" (has a space)
// and harmless otherwise. exceljs writes plain formula strings verbatim, so the
// quoting we emit is exactly what Excel reads.
const cref = (a: Addr) => `'${a.sheet}'!${a.col}${a.row}`;

const euro    = '"€"#,##0.00';
const pct     = '0.00"%"';
const num2    = '#,##0.000000';
const intFmt  = "0";
const monFmt  = "0.0";
const pdKFmt  = "#,##0.00000";

type Sheet = { ws: any; r: number };

export async function exportToExcel(bundle: ExportBundle): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Mecanova Partner Portal";
  wb.created = new Date();

  const {
    inputs, result, productName, productBrand,
    abv, sizeMl, bottlesPerCase, scenarioName, notes, createdAt,
  } = bundle;

  const isCostUp = inputs.mode === "cost_up";
  const dateLabel = (createdAt ? new Date(createdAt) : new Date())
    .toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  const page = { fitToPage: true, fitToWidth: 1, paperSize: 9 } as const;

  // Create tabs in display order (Summary first = leftmost / default), but
  // populate later in dependency order so cross-sheet refs resolve.
  const mkSheet = (name: string, widths: Record<string, number>): Sheet => {
    const ws = wb.addWorksheet(name, { pageSetup: { ...page } });
    Object.entries(widths).forEach(([c, w]) => { ws.getColumn(c).width = w; });
    return { ws, r: 1 };
  };

  const sSum  = mkSheet("Summary",      { A: 4,  B: 34, C: 22, D: 24, E: 18 });
  const sIn   = mkSheet("Inputs",       { A: 40, B: 16, C: 16, D: 40 });
  const sGiv  = mkSheet("Given Values", { A: 42, B: 16, C: 18, D: 44 });
  const sCalc = mkSheet("Calculation",  { A: 40, B: 15, C: 15, D: 38, E: 54 });

  // ── shared low-level helpers ───────────────────────────────────────────────
  const fnt = (o: any) => ({ name: "Calibri", ...o });

  function sheetTitle(s: Sheet, title: string, sub: string) {
    s.ws.getRow(s.r).height = 22;
    s.ws.getCell(`A${s.r}`).value = title;
    s.ws.getCell(`A${s.r}`).font = fnt({ size: 14, bold: true, color: { argb: C.charcoal } });
    s.ws.mergeCells(`A${s.r}:E${s.r}`);
    s.r++;
    s.ws.getRow(s.r).height = 14;
    s.ws.getCell(`A${s.r}`).value = sub;
    s.ws.getCell(`A${s.r}`).font = fnt({ size: 8, italic: true, color: { argb: C.textMuted } });
    s.ws.mergeCells(`A${s.r}:E${s.r}`);
    s.r += 2;
  }

  function sectionHeader(s: Sheet, label: string, fromCol = "A", toCol = "E") {
    s.r++;
    s.ws.getRow(s.r).height = 16;
    const cell = s.ws.getCell(`${fromCol}${s.r}`);
    cell.value = label.toUpperCase();
    cell.font = fnt({ size: 8, bold: true, color: { argb: "FFFFFFFF" } });
    cell.fill = mkFill(C.charcoal);
    cell.alignment = { horizontal: "left", vertical: "middle" };
    for (let c = fromCol.charCodeAt(0); c <= toCol.charCodeAt(0); c++) {
      s.ws.getCell(`${String.fromCharCode(c)}${s.r}`).fill = mkFill(C.charcoal);
    }
    s.ws.mergeCells(`${fromCol}${s.r}:${toCol}${s.r}`);
    s.r++;
  }

  function subLabel(s: Sheet, label: string, col = "A") {
    s.ws.getRow(s.r).height = 13;
    s.ws.getCell(`${col}${s.r}`).value = label;
    s.ws.getCell(`${col}${s.r}`).font = fnt({ size: 8, bold: true, color: { argb: C.textMuted } });
    s.r++;
  }

  const blank = (s: Sheet) => { s.r++; };

  // editable input → blue font, light cream backing so the editable area is visible
  function inputCell(s: Sheet, label: string, value: number, unit: string, fmt: string, note?: string): Addr {
    const r = s.r;
    s.ws.getRow(r).height = 15;
    s.ws.getCell(`A${r}`).value = label;
    s.ws.getCell(`A${r}`).font = fnt({ size: 9, color: { argb: C.textDark } });
    const vc = s.ws.getCell(`B${r}`);
    vc.value = value;
    vc.fill = mkFill(C.creamLight);
    vc.font = fnt({ size: 9, bold: true, color: { argb: C.inputBlue } });
    vc.numFmt = fmt;
    vc.border = { bottom: { style: "thin", color: { argb: C.cream } } };
    s.ws.getCell(`C${r}`).value = unit;
    s.ws.getCell(`C${r}`).font = fnt({ size: 8, italic: true, color: { argb: C.textMuted } });
    if (note) {
      s.ws.getCell(`D${r}`).value = note;
      s.ws.getCell(`D${r}`).font = fnt({ size: 8, italic: true, color: { argb: C.textMuted } });
    }
    s.r++;
    return { sheet: s.ws.name, col: "B", row: r };
  }

  // given-by-law / market / product → grey fill, black text
  function givenCell(s: Sheet, label: string, value: number, unit: string, fmt: string, note?: string): Addr {
    const r = s.r;
    s.ws.getRow(r).height = 15;
    s.ws.getCell(`A${r}`).value = label;
    s.ws.getCell(`A${r}`).font = fnt({ size: 9, color: { argb: C.textDark } });
    const vc = s.ws.getCell(`B${r}`);
    vc.value = value;
    vc.fill = mkFill(C.givenFill);
    vc.font = fnt({ size: 9, color: { argb: C.textDark } });
    vc.numFmt = fmt;
    vc.border = { bottom: { style: "thin", color: { argb: C.dimGray } } };
    s.ws.getCell(`C${r}`).value = unit;
    s.ws.getCell(`C${r}`).font = fnt({ size: 8, italic: true, color: { argb: C.textMuted } });
    if (note) {
      s.ws.getCell(`D${r}`).value = note;
      s.ws.getCell(`D${r}`).font = fnt({ size: 8, italic: true, color: { argb: C.textMuted } });
    }
    s.r++;
    return { sheet: s.ws.name, col: "B", row: r };
  }

  // ── INPUTS SHEET ───────────────────────────────────────────────────────────
  sheetTitle(sIn, "Inputs — edit these blue cells",
    "Blue numbers are yours to change. The Calculation tab and the Summary update automatically.");

  subLabel(sIn, "Supplier & order");
  const inSupplierPrice = inputCell(sIn, "Supplier Price per Case", inputs.supplierPricePerCase, inputs.supplierCurrency, euro);
  const inOrderCases = inputCell(sIn, "Order Cases (for freight allocation)", inputs.orderCases, "cases", intFmt, "Total cases in shipment — divides freight");
  const inFxBufPct = inputs.supplierCurrency !== "EUR"
    ? inputCell(sIn, "FX Buffer %", inputs.fxBufferPct, "%", pct, "Currency risk buffer")
    : inputCell(sIn, "FX Buffer %", 0, "%", pct, "No FX buffer needed for EUR suppliers");

  blank(sIn);
  subLabel(sIn, "Freight & insurance");
  const inIntlFreight = inputCell(sIn, "International Freight Total", inputs.internationalFreightEur, "EUR total", euro, `Mode: ${inputs.freightMode}`);
  const inLocalTransport = inputCell(sIn,
    inputs.freightMode !== "land" ? "Local Transport Total" : "Local Transport Total (land mode — set to 0)",
    inputs.freightMode !== "land" ? inputs.localTransportEur : 0,
    "EUR total", euro);
  const inInsurPct = inputCell(sIn, "Insurance %", inputs.insurancePct, "%", pct, "Applied on CIF (supplier + freight)");
  const inBreakPct = inputCell(sIn, "Breakage Allowance %", inputs.breakagePct, "%", pct, "Transit losses");

  blank(sIn);
  subLabel(sIn, "Domestic costs");
  const inDomLog = inputCell(sIn, "Dom. Logistics Total", inputs.domLogisticsTotal ?? 0, "EUR total", euro, "Divided by order cases");
  const inWarePerMo = inputCell(sIn, "Warehousing per Case / Month", inputs.warehousingPerCaseMo, "EUR/case/mo", euro);
  const inHoldMonths = inputCell(sIn, "Holding Period", inputs.holdingMonths, "months", monFmt);
  const inDistFee = inputCell(sIn, "Distributor Fee (per case)", result.distributorFee, "EUR/case", euro, `Mode: ${inputs.distributorFeeMode} — converted to per-case`);

  blank(sIn);
  subLabel(sIn, "Compliance & overhead");
  const inLabelPerBot = inputCell(sIn, "Labeling Cost per Bottle", inputs.labelingPerBottle, "EUR/bottle", euro);
  const inSampPct = inputCell(sIn, "Sample Rate %", inputs.sampleRatePct, "%", pct, "Cost of gifted samples allocated to sold cases");
  const inOvhPct = inputCell(sIn, "Overhead %", inputs.overheadPct, "%", pct, "General admin overhead");

  blank(sIn);
  subLabel(sIn, "Targets");
  const inTargMargin = inputCell(sIn, "Target Margin %", inputs.targetMarginPct, "%", pct, "Gross margin as % of selling price");
  const inTargPrice = inputCell(sIn, "Target Price per Case (Price-Down)", inputs.targetPricePerCase || 0, "EUR/case", euro, "Used only in Price-Down mode");

  // ── GIVEN VALUES SHEET ─────────────────────────────────────────────────────
  sheetTitle(sGiv, "Given Values — taxes, duties, market & product data",
    "Usually fixed by law, market or the product master. Override a grey cell only if your specific case requires it.");

  subLabel(sGiv, "Taxes & duties — given by law");
  const givCustDutyPct = givenCell(sGiv, "EU Customs Duty %", inputs.customsDutyPct, "%", pct, "On CIF value (Art. 70 UCC). 0% for Mexican spirits under the EU–Mexico FTA");
  const givExciseRate = givenCell(sGiv, "Branntweinsteuer Rate (per hL pure alcohol)", inputs.exciseRatePerHl, "EUR/hL", euro, "German Alkoholsteuergesetz — NOT reclaimable");
  const givVatRate = givenCell(sGiv, "Import VAT Rate", inputs.importVatRate, "%", pct, "Einfuhrumsatzsteuer — reclaimable for VAT-registered businesses");

  blank(sGiv);
  subLabel(sGiv, "Market rate");
  const givFxRate = inputs.supplierCurrency !== "EUR"
    ? givenCell(sGiv, `FX Rate  (${inputs.supplierCurrency} → EUR)`,
        inputs.supplierCurrency === "USD" ? inputs.fxUsdEur : inputs.fxMxnEur,
        `EUR per 1 ${inputs.supplierCurrency}`, num2, "Exchange rate used in this calculation")
    : givenCell(sGiv, "FX Rate  (EUR → EUR)", 1, "EUR per EUR", num2, "No conversion — EUR supplier");

  blank(sGiv);
  subLabel(sGiv, "Product data — from catalogue");
  const givAbv = givenCell(sGiv, "ABV (alcohol by volume)", abv, "%", pct, "From product data");
  const givSizeMl = givenCell(sGiv, "Bottle Size", sizeMl, "mL", intFmt, "From product data");
  const givBpc = givenCell(sGiv, "Bottles per Case", bottlesPerCase, "bottles", intFmt, "From product data");

  // ── CALCULATION SHEET ──────────────────────────────────────────────────────
  sheetTitle(sCalc, "Calculation — automatic, do not edit",
    "Every figure here is a live formula. Change the blue Inputs / grey Given Values cells and these recalculate.");

  // column header row
  sCalc.ws.getRow(sCalc.r).height = 13;
  sCalc.ws.getCell(`A${sCalc.r}`).value = "Cost Item";
  sCalc.ws.getCell(`B${sCalc.r}`).value = "€ / case";
  sCalc.ws.getCell(`C${sCalc.r}`).value = "€ / bottle";
  sCalc.ws.getCell(`D${sCalc.r}`).value = "Formula (for reference)";
  sCalc.ws.getCell(`E${sCalc.r}`).value = "What this line means";
  ["A", "B", "C", "D", "E"].forEach((col) => {
    sCalc.ws.getCell(`${col}${sCalc.r}`).font = fnt({ size: 8, bold: true, color: { argb: C.textMuted } });
  });
  sCalc.ws.getCell(`B${sCalc.r}`).alignment = { horizontal: "right" };
  sCalc.ws.getCell(`C${sCalc.r}`).alignment = { horizontal: "right" };
  sCalc.r++;

  const bpcRef = cref(givBpc); // "/bottle" divisor lives on Given Values now

  // Full waterfall row: A label · B €/case (formula) · C €/bottle · D formula desc · E plain text
  function calcRow(
    label: string,
    formula: string,
    cached: number,
    formulaDesc: string,
    plainEng: string,
    opts: { total?: boolean; headline?: boolean; dim?: boolean } = {}
  ): Addr {
    const r = sCalc.r;
    sCalc.ws.getRow(r).height = 15;
    const bg = opts.headline ? C.resultBg : opts.total ? C.sectionBg : undefined;
    const fg = { argb: opts.dim ? C.dimGray : opts.headline ? C.charcoal : C.textDark };
    const bold = !!(opts.total || opts.headline);

    sCalc.ws.getCell(`A${r}`).value = label;
    sCalc.ws.getCell(`A${r}`).font = fnt({ size: 9, bold, color: fg });
    if (bg) sCalc.ws.getCell(`A${r}`).fill = mkFill(bg);

    const vc = sCalc.ws.getCell(`B${r}`);
    vc.value = { formula, result: cached };
    vc.font = fnt({ size: 9, bold, color: fg });
    vc.numFmt = euro;
    if (bg) vc.fill = mkFill(bg);

    const bc = sCalc.ws.getCell(`C${r}`);
    bc.value = { formula: `'Calculation'!B${r}/${bpcRef}`, result: cached / bottlesPerCase };
    bc.font = fnt({ size: 8, bold, color: { argb: opts.dim ? C.dimGray : C.textMuted } });
    bc.numFmt = euro;
    if (bg) bc.fill = mkFill(bg);

    sCalc.ws.getCell(`D${r}`).value = formulaDesc;
    sCalc.ws.getCell(`D${r}`).font = fnt({ size: 8, italic: true, color: { argb: opts.dim ? C.dimGray : C.textMuted } });
    if (bg) sCalc.ws.getCell(`D${r}`).fill = mkFill(bg);

    sCalc.ws.getCell(`E${r}`).value = plainEng;
    sCalc.ws.getCell(`E${r}`).font = fnt({ size: 8, color: { argb: opts.dim ? C.dimGray : C.textMuted } });
    sCalc.ws.getCell(`E${r}`).alignment = { wrapText: true, vertical: "middle" };
    if (bg) sCalc.ws.getCell(`E${r}`).fill = mkFill(bg);

    sCalc.r++;
    return { sheet: "Calculation", col: "B", row: r };
  }

  // single-value B-only row (per-bottle totals, %s, PD internals, max supplier price)
  function calcBRow(
    label: string,
    formula: string,
    cached: number,
    fmt: string,
    plainEng: string,
    style: "total" | "headline" | "dim" | "success" | "plain"
  ): Addr {
    const r = sCalc.r;
    sCalc.ws.getRow(r).height = 14;
    const bg = style === "headline" ? C.resultBg : style === "total" ? C.sectionBg : undefined;
    const dim = style === "dim";
    const fgArgb = dim ? C.dimGray : style === "headline" ? C.charcoal : C.textDark;
    const bold = style === "total" || style === "headline";
    const size = dim ? 8 : 9;

    sCalc.ws.getCell(`A${r}`).value = label;
    sCalc.ws.getCell(`A${r}`).font = fnt({ size, bold, color: { argb: fgArgb } });
    if (bg) sCalc.ws.getCell(`A${r}`).fill = mkFill(bg);

    const vc = sCalc.ws.getCell(`B${r}`);
    vc.value = { formula, result: cached };
    vc.numFmt = fmt;
    vc.font = fnt({ size, bold: bold || style === "success", color: { argb: style === "success" ? C.success : fgArgb } });
    if (bg) vc.fill = mkFill(bg);

    sCalc.ws.getCell(`E${r}`).value = plainEng;
    sCalc.ws.getCell(`E${r}`).font = fnt({ size: 8, color: { argb: dim ? C.dimGray : C.textMuted } });
    sCalc.ws.getCell(`E${r}`).alignment = { wrapText: true, vertical: "middle" };
    if (bg) {
      sCalc.ws.getCell(`C${r}`).fill = mkFill(bg);
      sCalc.ws.getCell(`D${r}`).fill = mkFill(bg);
      sCalc.ws.getCell(`E${r}`).fill = mkFill(bg);
    }
    sCalc.r++;
    return { sheet: "Calculation", col: "B", row: r };
  }

  // cached intermediates — identical expressions to pricingCalc.ts
  const safeCases = Math.max(1, inputs.orderCases);
  const localPerCaseCached = inputs.freightMode !== "land" ? inputs.localTransportEur / safeCases : 0;
  const intlPerCaseCached = inputs.internationalFreightEur / safeCases + localPerCaseCached;

  const cBaseSupplier = calcRow(
    "Base Supplier Price (EUR)",
    `${cref(inSupplierPrice)}*${cref(givFxRate)}`,
    result.supplierPriceEur - result.fxBufferCost,
    "= SupplierPrice × FXRate",
    "Producer's per-case price converted to euros at the Given Values exchange rate.");

  const cFxBuf = calcRow(
    "FX Buffer",
    `${cref(cBaseSupplier)}*${cref(inFxBufPct)}/100`,
    result.fxBufferCost,
    "= Base × FXBuffer%",
    "Safety cushion on the supplier price to absorb currency swings. Zero for euro suppliers.");

  const cSpEur = calcRow(
    "Supplier Price EUR (incl. FX buffer)",
    `${cref(cBaseSupplier)}+${cref(cFxBuf)}`,
    result.supplierPriceEur,
    "= Base + FXBuffer",
    "Euro cost of the goods once the currency cushion is added.");

  const cIntlPerCase = calcRow(
    "International Freight per Case",
    `${cref(inIntlFreight)}/MAX(1,${cref(inOrderCases)})`,
    inputs.internationalFreightEur / safeCases,
    "= IntlFreight ÷ OrderCases",
    "Total cross-border shipping spread evenly over every case in the shipment.");

  const cLocalPerCase = calcRow(
    "Local Transport per Case",
    `${cref(inLocalTransport)}/MAX(1,${cref(inOrderCases)})`,
    localPerCaseCached,
    "= LocalTransport ÷ OrderCases",
    "Transport on the origin side, per case. Zero when shipping by land in one leg.");

  const cFreightPerCase = calcRow(
    "Freight per Case",
    `${cref(cIntlPerCase)}+${cref(cLocalPerCase)}`,
    intlPerCaseCached,
    "= IntlCase + LocalCase",
    "All shipping cost for one case (international plus local).");

  const cFreightAndIns = calcRow(
    "Freight & Insurance",
    `${cref(cFreightPerCase)}+(${cref(cSpEur)}+${cref(cFreightPerCase)})*${cref(inInsurPct)}/100`,
    result.freightAndInsurance,
    "= Freight + (Supplier+Freight)×Insurance%",
    "Shipping plus cargo insurance, where insurance is charged on the goods-plus-freight value.");

  const cCif = calcRow(
    "CIF Value (customs basis)",
    `${cref(cSpEur)}+${cref(cFreightAndIns)}`,
    result.supplierPriceEur + result.freightAndInsurance,
    "= SupplierEUR + FreightAndInsurance",
    "The value German customs uses to calculate duty: goods, freight and insurance combined.");

  const cBreak = calcRow(
    "Breakage Allowance",
    `${cref(cCif)}*${cref(inBreakPct)}/100/MAX(0.0001,1-${cref(inBreakPct)}/100)`,
    result.breakageCost,
    "= CIF × Break% ÷ (1−Break%)  [markup equivalent]",
    "Expected cost of bottles lost or broken in transit, recovered by uplifting the surviving cases.");

  const cCust = calcRow(
    "Customs Duty",
    `${cref(cCif)}*${cref(givCustDutyPct)}/100`,
    result.customsDuty,
    "= CIF × CustomsDuty%",
    "Import tariff on the CIF value. Usually 0% for Mexican spirits under the EU–Mexico free-trade agreement.");

  const cExcise = calcRow(
    "Branntweinsteuer (Excise)  ⚠ NOT reclaimable",
    `(${cref(givAbv)}/100)*(${cref(givSizeMl)}/1000)*${cref(givBpc)}*(${cref(givExciseRate)}/100)`,
    result.excisePerCase,
    "= ABV × SizeL × BPC × (Rate÷100)",
    "German alcohol tax, fixed by law per litre of pure alcohol in the case. A real cost — it is NOT reclaimable.");

  const cDom = calcRow(
    "Dom. Logistics per Case",
    `${cref(inDomLog)}/MAX(1,${cref(inOrderCases)})`,
    result.domLogistics,
    "= DomLogisticsTotal ÷ OrderCases",
    "Onward transport inside Germany, spread per case.");

  calcRow(
    "Import VAT  (reference only — NOT in landed cost)",
    `(${cref(cCif)}+${cref(cCust)}+${cref(cExcise)}+${cref(cDom)})*${cref(givVatRate)}/100`,
    result.importVat,
    "= (CIF+Duty+Excise+Dom)×VAT%  — reclaimable B2B",
    "German import VAT. Shown for cash-flow only — VAT-registered businesses reclaim it, so it is excluded from landed cost.",
    { dim: true });

  const cWare = calcRow(
    "Warehousing",
    `${cref(inWarePerMo)}*${cref(inHoldMonths)}`,
    result.warehousing,
    "= WarehousingPerMo × HoldingMonths",
    "Storage cost per case for the number of months you expect to hold the stock.");

  const cDist = calcRow(
    "Distributor Fee",
    `${cref(inDistFee)}`,
    result.distributorFee,
    "= DistributorFee (per case)",
    "The agreed distributor margin or handling fee, expressed per case.");

  const cLabel = calcRow(
    "Labeling & Compliance",
    `${cref(inLabelPerBot)}*${cref(givBpc)}`,
    result.labeling,
    "= LabelingPerBottle × BottlesPerCase",
    "German-market labelling and compliance cost, per bottle, multiplied up to a case.");

  const preSampleCached = result.supplierPriceEur + result.freightAndInsurance
    + result.breakageCost + result.customsDuty + result.excisePerCase
    + result.domLogistics + result.warehousing + result.distributorFee + result.labeling;

  const cPreSamp = calcRow(
    "Pre-Sample Cost (subtotal)",
    `${cref(cCif)}+${cref(cBreak)}+${cref(cCust)}+${cref(cExcise)}+${cref(cDom)}+${cref(cWare)}+${cref(cDist)}+${cref(cLabel)}`,
    preSampleCached,
    "= CIF + Breakage + Customs + Excise + DomLog + Ware + Dist + Label",
    "Running total of every real cost before the free-sample and overhead loadings.");

  const cSamp = calcRow(
    "Sample Allocation",
    `${cref(cPreSamp)}*(${cref(inSampPct)}/100)/MAX(0.01,1-${cref(inSampPct)}/100)`,
    result.sampleAllocation,
    "= PreSample × SampleRate% ÷ (1−SampleRate%)",
    "The cost of bottles given away as free samples, recovered across the cases you actually sell.");

  const preOvhCached = preSampleCached + result.sampleAllocation;
  const cPreOvh = calcRow(
    "Pre-Overhead Cost",
    `${cref(cPreSamp)}+${cref(cSamp)}`,
    preOvhCached,
    "= PreSample + Samples",
    "Subtotal once the sample cost has been added.");

  const cOvh = calcRow(
    "Overhead",
    `${cref(cPreOvh)}*${cref(inOvhPct)}/100`,
    result.overhead,
    "= PreOverhead × Overhead%",
    "General business overhead applied as a percentage of all costs so far.");

  const cTlc = calcRow(
    "TOTAL LANDED COST / Case",
    `${cref(cPreOvh)}+${cref(cOvh)}`,
    result.totalLandedCostPerCase,
    "= PreOverhead + Overhead",
    "The full cost of getting one case ready to sell in Germany.",
    { total: true });

  calcBRow(
    "TOTAL LANDED COST / Bottle",
    `${cref(cTlc)}/${bpcRef}`,
    result.totalLandedCostPerBottle,
    euro,
    "The same landed cost divided down to a single bottle.",
    "total");

  // ── RESULTS — Cost-Up ──
  blank(sCalc);
  subLabel(sCalc, "Cost-Up (Forward)  —  how high must I sell?");

  const cMarginAmt = calcRow(
    "Target Margin Amount",
    `${cref(cTlc)}*(${cref(inTargMargin)}/100)/MAX(0.01,1-${cref(inTargMargin)}/100)`,
    result.marginAmount,
    "= TotalLanded × Margin% ÷ (1−Margin%)",
    "The profit added so your target margin is measured against the selling price, not the cost.");

  const cMinPrice = calcRow(
    "MIN. SELLING PRICE / Case",
    `${cref(cTlc)}+${cref(cMarginAmt)}`,
    result.minSellingPricePerCase,
    "= TotalLanded + MarginAmount",
    "The lowest price per case that still hits your target margin. Selling below this loses money.",
    { headline: true });

  const cMinPriceBottle = calcBRow(
    "MIN. SELLING PRICE / Bottle",
    `${cref(cMinPrice)}/${bpcRef}`,
    result.minSellingPricePerBottle,
    euro,
    "The same minimum selling price per single bottle.",
    "headline");

  const cActualMargin = calcBRow(
    "Actual Margin %",
    `(${cref(cMinPrice)}-${cref(cTlc)})/${cref(cMinPrice)}*100`,
    result.actualMarginPct,
    pct,
    "The margin you actually earn at the minimum selling price — confirms the target is met.",
    "success");

  // ── RESULTS — Price-Down ──
  blank(sCalc);
  subLabel(sCalc, "Price-Down (Backward)  —  what can I pay the supplier?");

  const pdKval = (1 + inputs.insurancePct / 100)
    * (1 / Math.max(0.001, 1 - inputs.breakagePct / 100) + inputs.customsDutyPct / 100)
    * (1 + inputs.overheadPct / 100)
    / Math.max(0.001, 1 - inputs.sampleRatePct / 100);
  const cPdK = calcBRow(
    "PD Factor (k)  — internal",
    `(1+${cref(inInsurPct)}/100)*(1/MAX(0.001,1-${cref(inBreakPct)}/100)+${cref(givCustDutyPct)}/100)*(1+${cref(inOvhPct)}/100)/MAX(0.001,1-${cref(inSampPct)}/100)`,
    pdKval,
    pdKFmt,
    "Internal multiplier: how each euro of supplier price grows through insurance, breakage, duty, samples and overhead.",
    "dim");

  const pdCval = result.totalLandedCostPerCase - result.supplierPriceEur * pdKval;
  const cPdC = calcBRow(
    "PD Constant (c)  — internal",
    `${cref(cTlc)}-${cref(cSpEur)}*${cref(cPdK)}`,
    pdCval,
    euro,
    "Internal figure: all the fixed costs that do not scale with the supplier price.",
    "dim");

  const cMaxSp = calcBRow(
    "MAX SUPPLIER PRICE / Case (EUR)",
    `MAX(0,(${cref(inTargPrice)}*(1-${cref(inTargMargin)}/100)-${cref(cPdC)})/${cref(cPdK)})`,
    result.maxSupplierPriceEur,
    euro,
    "The most you can pay the supplier per case and still hit your target price and margin.",
    "headline");

  const cMaxSpBottle = calcBRow(
    "MAX SUPPLIER PRICE / Bottle (EUR)",
    `${cref(cMaxSp)}/${bpcRef}`,
    result.maxSupplierPriceEur / bottlesPerCase,
    euro,
    "The same supplier-price ceiling per single bottle.",
    "headline");

  // ── SUMMARY SHEET ──────────────────────────────────────────────────────────
  const SW = sSum.ws;
  // title block
  SW.getRow(2).height = 24;
  SW.getCell("B2").value = scenarioName || `${productName} — Pricing Summary`;
  SW.getCell("B2").font = fnt({ size: 16, bold: true, color: { argb: C.charcoal } });
  SW.mergeCells("B2:E2");
  SW.getCell("B3").value = `${productName}${productBrand ? ` · ${productBrand}` : ""}`;
  SW.getCell("B3").font = fnt({ size: 10, color: { argb: C.textMuted } });
  SW.mergeCells("B3:E3");
  SW.getCell("B4").value = `ABV ${abv}%   ·   ${sizeMl} mL   ·   ${bottlesPerCase} bottles / case`;
  SW.getCell("B4").font = fnt({ size: 9, color: { argb: C.textMuted } });
  SW.getCell("B5").value = `Mode: ${isCostUp ? "Cost-Up (Forward)" : "Price-Down (Backward)"}     ·     Date: ${dateLabel}`;
  SW.getCell("B5").font = fnt({ size: 9, color: { argb: C.textMuted } });
  sSum.r = 7;

  // headline result box (charcoal, cream text) — live refs to Calculation
  const boxRows = isCostUp ? [7, 8, 9, 10] : [7, 8, 9];
  for (const rr of boxRows) {
    SW.getRow(rr).height = rr === 7 ? 20 : 22;
    for (const col of ["B", "C", "D", "E"]) {
      SW.getCell(`${col}${rr}`).fill = mkFill(C.headlineBox);
    }
  }
  SW.getCell("B7").value = isCostUp ? "MINIMUM SELLING PRICE" : "MAXIMUM SUPPLIER PRICE";
  SW.getCell("B7").font = fnt({ size: 10, bold: true, color: { argb: C.cream } });
  SW.mergeCells("B7:E7");

  SW.getCell("B8").value = "per case";
  SW.getCell("B8").font = fnt({ size: 11, color: { argb: C.cream } });
  const headCaseCell = SW.getCell("C8");
  headCaseCell.value = isCostUp
    ? { formula: cref(cMinPrice), result: result.minSellingPricePerCase }
    : { formula: cref(cMaxSp), result: result.maxSupplierPriceEur };
  headCaseCell.numFmt = euro;
  headCaseCell.font = fnt({ size: 16, bold: true, color: { argb: "FFFFFFFF" } });
  SW.mergeCells("C8:E8");

  SW.getCell("B9").value = "per bottle";
  SW.getCell("B9").font = fnt({ size: 11, color: { argb: C.cream } });
  const headBotCell = SW.getCell("C9");
  headBotCell.value = isCostUp
    ? { formula: cref(cMinPriceBottle), result: result.minSellingPricePerBottle }
    : { formula: cref(cMaxSpBottle), result: result.maxSupplierPriceEur / bottlesPerCase };
  headBotCell.numFmt = euro;
  headBotCell.font = fnt({ size: 13, bold: true, color: { argb: "FFFFFFFF" } });
  SW.mergeCells("C9:E9");

  if (isCostUp) {
    SW.getCell("B10").value = "Actual margin";
    SW.getCell("B10").font = fnt({ size: 10, color: { argb: C.cream } });
    const amCell = SW.getCell("C10");
    amCell.value = { formula: cref(cActualMargin), result: result.actualMarginPct };
    amCell.numFmt = pct;
    amCell.font = fnt({ size: 11, bold: true, color: { argb: "FFFFFFFF" } });
    SW.getCell("D10").value = "Landed cost / case";
    SW.getCell("D10").font = fnt({ size: 10, color: { argb: C.cream } });
    SW.getCell("D10").alignment = { horizontal: "right" };
    const lcCell = SW.getCell("E10");
    lcCell.value = { formula: cref(cTlc), result: result.totalLandedCostPerCase };
    lcCell.numFmt = euro;
    lcCell.font = fnt({ size: 11, bold: true, color: { argb: "FFFFFFFF" } });
  }
  sSum.r = isCostUp ? 12 : 11;

  // key numbers used
  sectionHeader(sSum, "Key numbers used", "B", "E");
  const sumKey = (label: string, ref: Addr, cached: number, fmt: string, note: string) => {
    const r = sSum.r;
    SW.getRow(r).height = 15;
    SW.getCell(`B${r}`).value = label;
    SW.getCell(`B${r}`).font = fnt({ size: 9, color: { argb: C.textDark } });
    const v = SW.getCell(`C${r}`);
    v.value = { formula: cref(ref), result: cached };
    v.numFmt = fmt;
    v.font = fnt({ size: 9, bold: true, color: { argb: C.textDark } });
    SW.getCell(`D${r}`).value = note;
    SW.getCell(`D${r}`).font = fnt({ size: 8, italic: true, color: { argb: C.textMuted } });
    SW.mergeCells(`D${r}:E${r}`);
    sSum.r++;
  };
  sumKey("Supplier price / case", inSupplierPrice, inputs.supplierPricePerCase, euro, `In ${inputs.supplierCurrency} — editable on the Inputs tab`);
  sumKey("EU customs duty %", givCustDutyPct, inputs.customsDutyPct, pct, "0% under the EU–Mexico free-trade agreement");
  sumKey("Import VAT %", givVatRate, inputs.importVatRate, pct, "Reclaimable B2B — excluded from landed cost");

  // legend
  blank(sSum);
  sectionHeader(sSum, "How to read this file", "B", "E");
  const legend = (argb: string, fontArgb: string, text: string) => {
    const r = sSum.r;
    SW.getRow(r).height = 16;
    const sw = SW.getCell(`B${r}`);
    sw.value = "  ";
    sw.fill = mkFill(argb);
    sw.border = { top: { style: "thin", color: { argb: C.dimGray } }, bottom: { style: "thin", color: { argb: C.dimGray } }, left: { style: "thin", color: { argb: C.dimGray } }, right: { style: "thin", color: { argb: C.dimGray } } };
    const t = SW.getCell(`C${r}`);
    t.value = text;
    t.font = fnt({ size: 9, color: { argb: fontArgb } });
    SW.mergeCells(`C${r}:E${r}`);
    sSum.r++;
  };
  legend(C.creamLight, C.inputBlue, "Blue = numbers you can edit — see the Inputs tab.");
  legend(C.givenFill, C.textDark, "Grey = given by law / market / product — change only if your case requires it (Given Values tab).");
  legend("FFFFFFFF", C.textDark, "Black = automatically calculated — do not type over these (Calculation tab).");
  SW.getRow(sSum.r).height = 14;
  SW.getCell(`B${sSum.r}`).value = "Edit the blue cells on the Inputs tab; this Summary and the Calculation tab update automatically.";
  SW.getCell(`B${sSum.r}`).font = fnt({ size: 8, italic: true, color: { argb: C.textMuted } });
  SW.mergeCells(`B${sSum.r}:E${sSum.r}`);
  sSum.r++;

  // volume tiers (static — recursive calc, cannot be a single formula)
  if (inputs.volumeTiers.length > 0) {
    blank(sSum);
    sectionHeader(sSum, "Volume Tiers", "B", "E");
    const hr = sSum.r;
    ["Tier", "Cases", "Supplier Price / Case (EUR)", "Min. Selling Price / Case (EUR)"].forEach((h, i) => {
      const col = ["B", "C", "D", "E"][i];
      SW.getCell(`${col}${hr}`).value = h;
      SW.getCell(`${col}${hr}`).font = fnt({ size: 8, bold: true, color: { argb: C.textMuted } });
    });
    sSum.r++;
    result.tierResults.forEach((tier, i) => {
      const r = sSum.r;
      SW.getRow(r).height = 14;
      SW.getCell(`B${r}`).value = `Tier ${i + 1}`;
      SW.getCell(`B${r}`).font = fnt({ size: 9 });
      SW.getCell(`C${r}`).value = `${tier.from_cases}–${tier.to_cases ?? "∞"}`;
      SW.getCell(`C${r}`).font = fnt({ size: 9 });
      const sp = SW.getCell(`D${r}`);
      sp.value = tier.supplier_price;
      sp.numFmt = euro;
      sp.font = fnt({ size: 9 });
      const res = SW.getCell(`E${r}`);
      res.value = tier.result_min_price ?? 0;
      res.numFmt = euro;
      res.font = fnt({ size: 9, bold: true });
      res.note = {
        texts: [{ font: { name: "Calibri", size: 8 }, text: "Pre-calculated value. To recalculate dynamically, change the Supplier Price per Case on the Inputs tab to this tier's supplier price." }],
      };
      sSum.r++;
    });
  }

  // notes
  if (notes) {
    blank(sSum);
    sectionHeader(sSum, "Notes", "B", "E");
    SW.getRow(sSum.r).height = 16;
    SW.getCell(`B${sSum.r}`).value = notes;
    SW.getCell(`B${sSum.r}`).font = fnt({ size: 9, italic: true, color: { argb: C.textMuted } });
    SW.getCell(`B${sSum.r}`).alignment = { wrapText: true, vertical: "top" };
    SW.mergeCells(`B${sSum.r}:E${sSum.r}`);
    sSum.r++;
  }

  // footer disclaimer (verbatim)
  sSum.r += 2;
  SW.getRow(sSum.r).height = 24;
  SW.getCell(`B${sSum.r}`).value =
    "All prices are NET of VAT (Netto). Mecanova GmbH adds 19% Umsatzsteuer on invoicing. Import VAT is reclaimable for VAT-registered businesses. Generated by Mecanova Partner Portal.";
  SW.getCell(`B${sSum.r}`).font = fnt({ size: 7, italic: true, color: { argb: C.dimGray } });
  SW.getCell(`B${sSum.r}`).alignment = { wrapText: true, vertical: "top" };
  SW.mergeCells(`B${sSum.r}:E${sSum.r}`);

  // open on the Summary tab
  wb.views = [{
    x: 0, y: 0, width: 20000, height: 12000,
    firstSheet: 0, activeTab: 0, visibility: "visible",
  }];

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
