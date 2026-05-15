import type { ExportBundle } from "./types";

// A4 in mm: 210 × 297
const PG_W = 210;
const PG_H = 297;
const ML = 18;  // left margin
const MR = 18;  // right margin
const MT = 22;  // top margin (below header band)
const CW = PG_W - ML - MR; // 174mm content width

const HEADER_H = 16; // charcoal header band height

// Palette
const P = {
  charcoal:   [17, 17, 17]    as [number,number,number],
  cream:      [236, 223, 204] as [number,number,number],
  creamLight: [250, 245, 238] as [number,number,number],
  creamSoft:  [248, 244, 238] as [number,number,number],
  creamRule:  [220, 208, 188] as [number,number,number],
  bgPage:     [252, 248, 241] as [number,number,number],
  textMuted:  [125, 116, 104] as [number,number,number],
  textSecond: [180, 175, 168] as [number,number,number],
  dimGray:    [170, 170, 170] as [number,number,number],
  success:    [107, 143, 110] as [number,number,number],
  warning:    [196, 163, 90]  as [number,number,number],
  error:      [196, 90, 90]   as [number,number,number],
  white:      [255, 255, 255] as [number,number,number],
};

const BAR_COLORS: [number,number,number][] = [
  [236, 223, 204],
  [205, 201, 194],
  [168, 159, 145],
  [125, 116, 104],
  [90, 138, 176],
  [196, 163, 90],
];

const eu = (v: number) => `€${(v ?? 0).toFixed(2)}`;
const pct = (v: number) => `${v.toFixed(1)}%`;

export async function exportToPdf(bundle: ExportBundle): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const {
    inputs, result, productName, productBrand,
    abv, sizeMl, bottlesPerCase, scenarioName, notes, createdAt,
  } = bundle;

  const isCostUp = inputs.mode === "cost_up";
  let y = 0;

  // ─── helpers ────────────────────────────────────────────────────────
  function setFont(size: number, style: "normal" | "bold" | "italic" = "normal") {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
  }
  function setColor(rgb: [number,number,number]) {
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  }
  function setFill(rgb: [number,number,number]) {
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  }
  function setDraw(rgb: [number,number,number], lw = 0.3) {
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
    doc.setLineWidth(lw);
  }

  // Decorative section header: tracked uppercase label + short cream rule beneath
  function sectionHeader(label: string) {
    checkY(10);
    setFont(7, "bold");
    setColor(P.textMuted);
    doc.text(label.toUpperCase(), ML, y);
    y += 1.5;
    setDraw(P.creamRule, 0.5);
    doc.line(ML, y, ML + 30, y);
    y += 4;
  }

  function checkY(needed: number) {
    if (y + needed > PG_H - 22) {
      newPage();
    }
  }

  function pageBg() {
    setFill(P.bgPage);
    doc.rect(0, 0, PG_W, PG_H, "F");
  }

  function pageHeader() {
    // Charcoal band
    setFill(P.charcoal);
    doc.rect(0, 0, PG_W, HEADER_H, "F");
    // Wordmark
    setFont(11, "bold");
    setColor(P.cream);
    doc.text("MECANOVA", ML, 7.5);
    // Tagline
    setFont(6.5);
    setColor(P.textMuted);
    doc.text("Mexican Spirits, Imported with Care", ML, 12.5);
    // Right: doc type
    setFont(8, "bold");
    setColor(P.cream);
    doc.text("PRICING MEASUREMENT", PG_W - MR, 7.5, { align: "right" });
    // Right: date
    const dateLabel = createdAt
      ? new Date(createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
      : new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    setFont(6.5);
    setColor(P.textMuted);
    doc.text(dateLabel, PG_W - MR, 12.5, { align: "right" });
    // Cream rule beneath band
    setDraw(P.creamRule, 0.4);
    doc.line(0, HEADER_H + 2, PG_W, HEADER_H + 2);
  }

  function pageFooter() {
    const pg = doc.getNumberOfPages();
    const totalPg = pg; // single pass — will show per-page number
    // Cream rule above footer
    setDraw(P.creamRule, 0.3);
    doc.line(ML, PG_H - 14, PG_W - MR, PG_H - 14);
    setFont(6.5, "italic");
    setColor(P.textMuted);
    doc.text(
      "All prices NET of VAT. Mecanova GmbH adds 19% Umsatzsteuer on invoicing. Import VAT is reclaimable.",
      ML, PG_H - 9
    );
    doc.text(`Mecanova GmbH · Hamburg`, PG_W - MR - 32, PG_H - 9);
    setFont(6.5);
    doc.text(`Page ${totalPg}`, PG_W - MR, PG_H - 9, { align: "right" });
  }

  function newPage() {
    pageFooter();
    doc.addPage();
    pageBg();
    pageHeader();
    y = HEADER_H + 10;
  }

  // ─── PAGE 1 SETUP ────────────────────────────────────────────────────
  pageBg();
  pageHeader();
  y = HEADER_H + 10;

  // Watermark on page 1 — low-opacity diagonal MECANOVA behind content
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gs = new (doc as any).GState({ opacity: 0.04 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).setGState(gs);
    doc.setFontSize(90);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(P.charcoal[0], P.charcoal[1], P.charcoal[2]);
    doc.text("MECANOVA", PG_W / 2, PG_H / 2, { align: "center", angle: 35 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gsReset = new (doc as any).GState({ opacity: 1 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).setGState(gsReset);
  } catch {
    // GState not available in this jspdf build — skip watermark silently
  }

  // ─── TITLE BLOCK ─────────────────────────────────────────────────────
  const title = scenarioName || `${productName} — Pricing Measurement`;
  setFont(22, "bold");
  setColor(P.charcoal);
  // Wrap long titles
  const titleLines = doc.splitTextToSize(title, CW) as string[];
  doc.text(titleLines, ML, y);
  y += titleLines.length * 9;

  // Subtitle
  const subtitle = `${productName}${productBrand ? ` · ${productBrand}` : ""}   ·   ${isCostUp ? "Cost-Up (Forward)" : "Price-Down (Backward)"}`;
  setFont(9);
  setColor(P.textMuted);
  doc.text(subtitle, ML, y);
  y += 3;
  // Accent tick
  setDraw(P.creamRule, 1);
  doc.line(ML, y, ML + 30, y);
  y += 8;

  // ─── METADATA STRIP ──────────────────────────────────────────────────
  const metaItems: [string, string][] = [
    ["ABV", `${abv}%`],
    ["Size", `${sizeMl} mL`],
    ["Btl / Case", `${bottlesPerCase}`],
    ["Currency", inputs.supplierCurrency],
    ["Mode", isCostUp ? "Cost-Up" : "Price-Down"],
  ];
  const cellW = CW / metaItems.length;
  metaItems.forEach(([label, value], i) => {
    const cx = ML + i * cellW;
    setFont(6.5);
    setColor(P.textMuted);
    doc.text(label.toUpperCase(), cx, y);
    setFont(9.5, "bold");
    setColor(P.charcoal);
    doc.text(value, cx, y + 5);
  });
  y += 13;

  // ─── HEADLINE PANEL ───────────────────────────────────────────────────
  checkY(38);
  const endPrice    = isCostUp ? result.minSellingPricePerCase : result.maxSupplierPriceEur;
  const endPriceBot = isCostUp ? result.minSellingPricePerBottle : (bottlesPerCase > 0 ? result.maxSupplierPriceEur / bottlesPerCase : 0);
  const endLabel    = isCostUp ? "Minimum Selling Price" : "Maximum Supplier Price";
  const marginColor = result.actualMarginPct >= 35 ? P.success : result.actualMarginPct >= 20 ? P.warning : P.error;

  const panelH = 36;
  // Cream-tinted background
  setFill(P.creamLight);
  doc.rect(ML, y, CW, panelH, "F");
  // Border
  setDraw(P.creamRule, 0.6);
  doc.rect(ML, y, CW, panelH);

  // Left: price
  setFont(7);
  setColor(P.textMuted);
  doc.text(endLabel.toUpperCase(), ML + 5, y + 8);
  // Big number
  setFont(28, "bold");
  setColor(P.charcoal);
  const priceStr = eu(endPrice);
  doc.text(priceStr, ML + 5, y + 22);
  const priceW = doc.getTextWidth(priceStr);
  setFont(10);
  setColor(P.textMuted);
  doc.text("/ case", ML + 5 + priceW + 1.5, y + 22);
  // Per bottle
  setFont(11);
  setColor(P.textSecond);
  doc.text(`${eu(endPriceBot)}  / bottle`, ML + 5, y + 30);

  // Vertical divider
  setDraw(P.creamRule, 0.4);
  doc.line(ML + CW * 0.52, y + 3, ML + CW * 0.52, y + panelH - 3);

  // Right: margin
  const rx = ML + CW * 0.52 + 5;
  setFont(7);
  setColor(P.textMuted);
  doc.text("ACTUAL MARGIN", rx, y + 8);
  setFont(22, "bold");
  doc.setTextColor(marginColor[0], marginColor[1], marginColor[2]);
  doc.text(pct(result.actualMarginPct), rx, y + 21);

  // Right: landed cost
  const rx2 = ML + CW * 0.52 + 5 + 38;
  setFont(7);
  setColor(P.textMuted);
  doc.text("LANDED COST", rx2, y + 8);
  setFont(12, "bold");
  setColor(P.charcoal);
  doc.text(eu(result.totalLandedCostPerCase), rx2, y + 17);
  setFont(7);
  setColor(P.textMuted);
  doc.text("/ case", rx2, y + 22);
  doc.text(`${eu(result.totalLandedCostPerBottle)} / bottle`, rx2, y + 28);

  y += panelH + 8;

  // ─── COST COMPOSITION BAR ─────────────────────────────────────────────
  sectionHeader("Cost Composition");

  const barItems = [
    { label: "Supplier",     value: result.supplierPriceEur },
    { label: "FX Buffer",    value: result.fxBufferCost },
    { label: "Freight & Ins.", value: result.freightAndInsurance },
    { label: "Breakage",     value: result.breakageCost },
    { label: "Customs",      value: result.customsDuty },
    { label: "Excise",       value: result.excisePerCase },
    { label: "Dom. Logistics", value: result.domLogistics },
    { label: "Warehousing",  value: result.warehousing },
    { label: "Distributor",  value: result.distributorFee },
    { label: "Labeling",     value: result.labeling },
    { label: "Samples",      value: result.sampleAllocation },
    { label: "Overhead",     value: result.overhead },
  ].filter(i => i.value > 0);

  const barTotal = result.totalLandedCostPerCase;
  const barH = 8;
  const barY = y;
  let barX = ML;

  barItems.forEach((item, i) => {
    const segW = barTotal > 0 ? (item.value / barTotal) * CW : 0;
    if (segW < 0.5) return;
    const col = BAR_COLORS[i % BAR_COLORS.length];
    setFill(col);
    doc.setDrawColor(P.charcoal[0], P.charcoal[1], P.charcoal[2]);
    doc.setLineWidth(0.15);
    doc.rect(barX, barY, segW, barH, "F");
    // Thin hairline divider between segments
    doc.rect(barX, barY, segW, barH);
    barX += segW;
  });
  y += barH + 3;

  // Legend — grid layout, 4 columns
  const legendColW = CW / 4;
  let lCol = 0;
  let lRowY = y;
  setFont(6.5);
  barItems.forEach((item, i) => {
    const col = BAR_COLORS[i % BAR_COLORS.length];
    const pctVal = barTotal > 0 ? ((item.value / barTotal) * 100).toFixed(0) : "0";
    const label = `${item.label} (${pctVal}%)`;
    const lx = ML + lCol * legendColW;
    setFill(col);
    doc.rect(lx, lRowY - 2.5, 3, 3, "F");
    setColor(P.textMuted);
    doc.text(label, lx + 4.5, lRowY);
    lCol++;
    if (lCol >= 4) { lCol = 0; lRowY += 5; }
  });
  y = lRowY + (lCol > 0 ? 5 : 0) + 4;

  // ─── COST BREAKDOWN TABLE ──────────────────────────────────────────────
  sectionHeader("Cost Breakdown");

  const breakdownRows: [string, string, string, boolean][] = [
    ["Base Supplier Price (EUR)", eu(result.supplierPriceEur - result.fxBufferCost), eu((result.supplierPriceEur - result.fxBufferCost) / bottlesPerCase), false],
    ["FX Buffer", eu(result.fxBufferCost), eu(result.fxBufferCost / bottlesPerCase), false],
    ["Freight & Insurance", eu(result.freightAndInsurance), eu(result.freightAndInsurance / bottlesPerCase), false],
    ["Breakage Allowance", eu(result.breakageCost), eu(result.breakageCost / bottlesPerCase), false],
    ["Customs Duty", eu(result.customsDuty), eu(result.customsDuty / bottlesPerCase), false],
    ["Branntweinsteuer (Excise) — not reclaimable", eu(result.excisePerCase), eu(result.excisePerCase / bottlesPerCase), false],
    ["Domestic Logistics", eu(result.domLogistics), eu(result.domLogistics / bottlesPerCase), false],
    ["Import VAT (reclaimable)", eu(result.importVat), eu(result.importVat / bottlesPerCase), true],
    ["Warehousing", eu(result.warehousing), eu(result.warehousing / bottlesPerCase), false],
    ["Distributor Fee", eu(result.distributorFee), eu(result.distributorFee / bottlesPerCase), false],
    ["Labeling & Compliance", eu(result.labeling), eu(result.labeling / bottlesPerCase), false],
    ["Sample Allocation", eu(result.sampleAllocation), eu(result.sampleAllocation / bottlesPerCase), false],
    ["Overhead", eu(result.overhead), eu(result.overhead / bottlesPerCase), false],
  ].filter(r => parseFloat((r[1] as string).replace("€","")) !== 0) as [string, string, string, boolean][];

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    theme: "plain",
    styles: {
      fontSize: 8,
      cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
      font: "helvetica",
      lineColor: P.creamRule,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: P.cream,
      textColor: P.charcoal,
      fontStyle: "bold",
      fontSize: 7,
      lineWidth: 0,
    },
    columnStyles: {
      0: { cellWidth: CW * 0.6 },
      1: { cellWidth: CW * 0.2, halign: "right" },
      2: { cellWidth: CW * 0.2, halign: "right" },
    },
    head: [["Cost Item", "€ / case", "€ / bottle"]],
    body: breakdownRows.map(([label, perCase, perBottle, dim]) => [
      {
        content: label,
        styles: { textColor: dim ? P.dimGray : P.charcoal, fontStyle: dim ? "italic" as const : "normal" as const },
      },
      {
        content: perCase,
        styles: { textColor: dim ? P.dimGray : P.charcoal, halign: "right" as const },
      },
      {
        content: perBottle,
        styles: { textColor: P.textMuted, halign: "right" as const },
      },
    ]),
    foot: [[
      { content: "TOTAL LANDED COST", styles: { fontStyle: "bold", fillColor: P.charcoal, textColor: P.cream } },
      { content: eu(result.totalLandedCostPerCase), styles: { fontStyle: "bold", fillColor: P.charcoal, textColor: P.cream, halign: "right" } },
      { content: eu(result.totalLandedCostPerBottle), styles: { fontStyle: "bold", fillColor: P.charcoal, textColor: P.creamSoft, halign: "right" } },
    ]],
    footStyles: { fillColor: P.charcoal, textColor: P.cream, fontStyle: "bold" },
  });
  y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
  y += 8;

  // ─── PAGE 2: ASSUMPTIONS + TIERS + NOTES ──────────────────────────────
  if (y > PG_H * 0.55) {
    newPage();
  } else {
    checkY(40);
  }

  sectionHeader("Assumptions Used");

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    theme: "plain",
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 1.8, bottom: 1.8, left: 3, right: 3 },
      font: "helvetica",
      lineColor: P.creamRule,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: P.cream,
      textColor: P.charcoal,
      fontStyle: "bold",
      fontSize: 7,
      lineWidth: 0,
    },
    columnStyles: {
      0: { cellWidth: CW * 0.5 },
      1: { cellWidth: CW * 0.25, halign: "right" },
      2: { cellWidth: CW * 0.25 },
    },
    head: [["Parameter", "Value", "Unit / Note"]],
    body: [
      ["Supplier Price / Case", eu(inputs.supplierPricePerCase), inputs.supplierCurrency],
      ["Supplier Currency", inputs.supplierCurrency, ""],
      ...(inputs.supplierCurrency !== "EUR"
        ? [
            ["FX Rate", (inputs.supplierCurrency === "USD" ? inputs.fxUsdEur : inputs.fxMxnEur).toFixed(6), `EUR per 1 ${inputs.supplierCurrency}`],
            ["FX Buffer", `${inputs.fxBufferPct}%`, "currency risk buffer"],
          ]
        : []),
      ["Order Cases", `${inputs.orderCases}`, "cases in shipment"],
      ["Intl. Freight Total", eu(inputs.internationalFreightEur), `mode: ${inputs.freightMode}`],
      ["Local Transport Total", eu(inputs.localTransportEur), ""],
      ["Insurance", `${inputs.insurancePct}%`, "on CIF"],
      ["Breakage Allowance", `${inputs.breakagePct}%`, ""],
      ["Customs Duty", `${inputs.customsDutyPct}%`, "on CIF"],
      ["Excise Rate", `${eu(inputs.exciseRatePerHl)} / hL`, "Branntweinsteuer"],
      ["Import VAT Rate", `${inputs.importVatRate}%`, "reclaimable"],
      ["Dom. Logistics Total", eu(inputs.domLogisticsTotal ?? 0), ""],
      ["Warehousing", `${eu(inputs.warehousingPerCaseMo)} / case/mo`, `${inputs.holdingMonths} months held`],
      ["Distributor Fee", eu(result.distributorFee), `${inputs.distributorFeeMode} mode`],
      ["Labeling", `${eu(inputs.labelingPerBottle)} / bottle`, ""],
      ["Sample Rate", `${inputs.sampleRatePct}%`, ""],
      ["Overhead", `${inputs.overheadPct}%`, ""],
      ["Target Margin", `${inputs.targetMarginPct}%`, "of selling price"],
      ...(inputs.targetPricePerCase ? [["Target Price / Case", eu(inputs.targetPricePerCase), "price-down"]] : []),
    ].map(([k, v, n]) => [
      { content: k },
      { content: v, styles: { halign: "right" as const } },
      { content: n, styles: { textColor: P.textMuted } },
    ]),
  });
  y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 60;
  y += 8;

  // Volume tiers
  if (result.tierResults.length > 0) {
    checkY(25);
    sectionHeader("Volume Tiers");

    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      theme: "plain",
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 1.8, bottom: 1.8, left: 3, right: 3 },
        font: "helvetica",
        lineColor: P.creamRule,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: P.cream,
        textColor: P.charcoal,
        fontStyle: "bold",
        fontSize: 7,
        lineWidth: 0,
      },
      head: [["Tier", "Cases", "Supplier Price", isCostUp ? "Min. Selling Price" : "Max Supplier Price", "Margin %"]],
      body: result.tierResults.map((t, i) => [
        `Tier ${i + 1}`,
        `${t.from_cases}–${t.to_cases ?? "∞"}`,
        eu(t.supplier_price),
        eu(isCostUp ? (t.result_min_price ?? 0) : (t.result_max_supplier ?? 0)),
        pct(t.result_margin_pct ?? 0),
      ]),
    });
    y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
    y += 8;
  }

  // Notes
  if (notes) {
    checkY(18);
    sectionHeader("Notes");
    setFont(8);
    setColor(P.charcoal);
    const noteLines = doc.splitTextToSize(notes, CW) as string[];
    doc.text(noteLines, ML, y);
    y += noteLines.length * 4.5 + 6;
  }

  pageFooter();

  return new Blob([doc.output("arraybuffer")], { type: "application/pdf" });
}
