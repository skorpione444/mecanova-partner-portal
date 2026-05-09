"use client";

import { AlignLeft, AlignCenter, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical, Copy, ChevronUp, Trash2 } from "lucide-react";
import { COLOR_PALETTE } from "../lib/statuses";
import type { MmapNode, MmapEdge, MmapShape } from "../lib/types";

interface Props {
  selectedNodeIds: Set<string>;
  selectedEdgeId: string | null;
  nodes: MmapNode[];
  edges: MmapEdge[];
  onPatchNode: (id: string, patch: Partial<MmapNode>) => void;
  onPatchNodes: (ids: Set<string>, patch: Partial<MmapNode>) => void;
  onPatchEdge: (id: string, patch: Partial<MmapEdge>) => void;
  onDeleteSelection: () => void;
  onDuplicate: () => void;
  onBringToFront: () => void;
}

const SHAPES: { id: MmapShape; label: string }[] = [
  { id: "rounded", label: "Rounded" },
  { id: "rect",    label: "Square" },
  { id: "circle",  label: "Circle" },
  { id: "diamond", label: "Diamond" },
  { id: "sticky",  label: "Sticky" },
];

const SIZE_OPTIONS: { label: string; value: 12 | 14 | 18 | 24 }[] = [
  { label: "S",  value: 12 },
  { label: "M",  value: 14 },
  { label: "L",  value: 18 },
  { label: "XL", value: 24 },
];

const TEXT_COLORS = ["#ecdfcc", "#A89F91", "#1a1a18", "#ffffff"];

const sect: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "0 10px",
  borderRight: "1px solid var(--mc-border)",
  flexShrink: 0,
};

const label: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "var(--mc-text-muted)",
  marginRight: 2,
  whiteSpace: "nowrap",
};

function Swatch({ color, active, onClick, transparent }: { color?: string; active?: boolean; onClick: () => void; transparent?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={transparent ? "None" : color}
      style={{
        width: 16, height: 16, flexShrink: 0,
        border: active ? "2px solid var(--mc-cream)" : "1px solid var(--mc-border)",
        background: transparent ? "transparent" : color,
        cursor: "pointer", outline: "none", position: "relative",
      }}
    >
      {transparent && (
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "var(--mc-text-muted)", lineHeight: 1 }}>∅</span>
      )}
    </button>
  );
}

function PillBtn({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: "2px 7px", fontSize: 11,
        background: active ? "var(--mc-cream)" : "var(--mc-surface-elevated)",
        color: active ? "var(--mc-charcoal, #1a1a18)" : "var(--mc-text-secondary)",
        border: "1px solid var(--mc-border)",
        cursor: "pointer", outline: "none", fontFamily: "Manrope, sans-serif",
      }}
    >
      {children}
    </button>
  );
}

function IconBtn({ onClick, title, children, danger }: { onClick: () => void; title?: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 26, height: 26, flexShrink: 0,
        background: "none", border: "none", cursor: "pointer",
        color: danger ? "var(--mc-error, #c45a5a)" : "var(--mc-text-secondary)",
        outline: "none",
      }}
    >
      {children}
    </button>
  );
}

export default function BottomToolbar({
  selectedNodeIds,
  selectedEdgeId,
  nodes,
  edges,
  onPatchNode,
  onPatchNodes,
  onPatchEdge,
  onDeleteSelection,
  onDuplicate,
  onBringToFront,
}: Props) {
  const count = selectedNodeIds.size + (selectedEdgeId ? 1 : 0);
  if (count === 0) return null;

  const bar: React.CSSProperties = {
    position: "absolute",
    bottom: 12,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "center",
    height: 40,
    background: "var(--mc-surface)",
    border: "1px solid var(--mc-border)",
    boxShadow: "var(--mc-shadow-lg, 0 8px 24px rgba(0,0,0,0.5))",
    zIndex: 10,
    userSelect: "none",
    whiteSpace: "nowrap",
    maxWidth: "calc(100% - 24px)",
    overflow: "hidden",
  };

  // Multiple nodes selected — full controls (mixed = no active indicator)
  if (selectedNodeIds.size > 1) {
    const sNodes = nodes.filter((n) => selectedNodeIds.has(n.id));
    const allEq = <T,>(fn: (n: typeof sNodes[0]) => T) => sNodes.every((n) => fn(n) === fn(sNodes[0])) ? fn(sNodes[0]) : undefined;
    const allShape = allEq((n) => n.shape);
    const allFill = allEq((n) => n.fill);
    const allBorder = allEq((n) => n.border);
    const allBorderStyle = allEq((n) => n.borderStyle);
    const allTextColor = allEq((n) => n.textColor);
    const allFontSize = allEq((n) => n.fontSize);
    const allTextAlign = allEq((n) => n.textAlign);
    const allTextVAlign = allEq((n) => n.textVAlign);
    return (
      <div style={bar}>
        {/* SHAPE */}
        <div style={sect}>
          <span style={label}>Form</span>
          <select
            value={allShape ?? ""}
            onChange={(e) => e.target.value && onPatchNodes(selectedNodeIds, { shape: e.target.value as MmapShape })}
            style={{ fontSize: 11, padding: "2px 4px", background: "var(--mc-surface-elevated)", border: "1px solid var(--mc-border)", color: "var(--mc-text-secondary)", cursor: "pointer", outline: "none", fontFamily: "Manrope, sans-serif" }}
          >
            {!allShape && <option value="">Mixed</option>}
            {SHAPES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        {/* FILL */}
        <div style={sect}>
          <span style={label}>Fill</span>
          <Swatch transparent active={allFill === "transparent"} onClick={() => onPatchNodes(selectedNodeIds, { fill: "transparent" })} />
          {COLOR_PALETTE.map((c) => <Swatch key={c.value} color={c.value} active={allFill === c.value} onClick={() => onPatchNodes(selectedNodeIds, { fill: c.value })} />)}
        </div>
        {/* BORDER */}
        <div style={sect}>
          <span style={label}>Border</span>
          <Swatch transparent active={allBorder === "transparent"} onClick={() => onPatchNodes(selectedNodeIds, { border: "transparent" })} />
          {COLOR_PALETTE.map((c) => <Swatch key={c.value} color={c.value} active={allBorder === c.value} onClick={() => onPatchNodes(selectedNodeIds, { border: c.value })} />)}
          <div style={{ width: 1, height: 20, background: "var(--mc-border)", margin: "0 4px", flexShrink: 0 }} />
          <PillBtn active={allBorderStyle === "solid"} onClick={() => onPatchNodes(selectedNodeIds, { borderStyle: "solid" })}>—</PillBtn>
          <PillBtn active={allBorderStyle === "dashed"} onClick={() => onPatchNodes(selectedNodeIds, { borderStyle: "dashed" })}>╌</PillBtn>
          <PillBtn active={allBorderStyle === "dotted"} onClick={() => onPatchNodes(selectedNodeIds, { borderStyle: "dotted" })}>⋯</PillBtn>
        </div>
        {/* TEXT */}
        <div style={sect}>
          <span style={label}>Text</span>
          {TEXT_COLORS.map((c) => <Swatch key={c} color={c} active={allTextColor === c} onClick={() => onPatchNodes(selectedNodeIds, { textColor: c })} />)}
        </div>
        {/* SIZE */}
        <div style={sect}>
          {SIZE_OPTIONS.map((s) => <PillBtn key={s.label} active={allFontSize === s.value} onClick={() => onPatchNodes(selectedNodeIds, { fontSize: s.value })}>{s.label}</PillBtn>)}
        </div>
        {/* ALIGN */}
        <div style={sect}>
          <IconBtn onClick={() => onPatchNodes(selectedNodeIds, { textAlign: "left" })} title="Align left"><AlignLeft size={13} style={{ opacity: allTextAlign === "left" ? 1 : 0.45 }} /></IconBtn>
          <IconBtn onClick={() => onPatchNodes(selectedNodeIds, { textAlign: "center" })} title="Align center"><AlignCenter size={13} style={{ opacity: allTextAlign === "center" ? 1 : 0.45 }} /></IconBtn>
          <IconBtn onClick={() => onPatchNodes(selectedNodeIds, { textAlign: "right" })} title="Align right"><AlignRight size={13} style={{ opacity: allTextAlign === "right" ? 1 : 0.45 }} /></IconBtn>
          <IconBtn onClick={() => onPatchNodes(selectedNodeIds, { textVAlign: "top" })} title="Align top"><AlignStartVertical size={13} style={{ opacity: allTextVAlign === "top" ? 1 : 0.45 }} /></IconBtn>
          <IconBtn onClick={() => onPatchNodes(selectedNodeIds, { textVAlign: "middle" })} title="Align middle"><AlignCenterVertical size={13} style={{ opacity: allTextVAlign === "middle" ? 1 : 0.45 }} /></IconBtn>
          <IconBtn onClick={() => onPatchNodes(selectedNodeIds, { textVAlign: "bottom" })} title="Align bottom"><AlignEndVertical size={13} style={{ opacity: allTextVAlign === "bottom" ? 1 : 0.45 }} /></IconBtn>
        </div>
        {/* Actions + count */}
        <div style={{ ...sect, borderRight: "none", gap: 2 }}>
          <IconBtn onClick={onDuplicate} title="Duplicate (Ctrl+D)"><Copy size={13} /></IconBtn>
          <IconBtn onClick={onBringToFront} title="Bring to front"><ChevronUp size={13} /></IconBtn>
          <IconBtn onClick={onDeleteSelection} title="Delete (Del)" danger><Trash2 size={13} /></IconBtn>
          <span style={{ fontSize: 11, color: "var(--mc-text-muted)", paddingLeft: 4 }}>{selectedNodeIds.size} Boxes</span>
        </div>
      </div>
    );
  }

  // Single edge
  if (selectedEdgeId) {
    const edge = edges.find((e) => e.id === selectedEdgeId);
    if (!edge) return null;
    const patch = (p: Partial<MmapEdge>) => onPatchEdge(edge.id, p);
    return (
      <div style={bar}>
        <div style={sect}>
          <span style={label}>Color</span>
          {COLOR_PALETTE.map((c) => (
            <Swatch key={c.value} color={c.value} active={edge.color === c.value} onClick={() => patch({ color: c.value })} />
          ))}
        </div>
        <div style={sect}>
          <span style={label}>Width</span>
          {([1, 2, 3, 4] as const).map((w) => <PillBtn key={w} active={edge.width === w} onClick={() => patch({ width: w })}>{w}</PillBtn>)}
        </div>
        <div style={sect}>
          <span style={label}>Arrow</span>
          <PillBtn active={edge.arrow === "none"} onClick={() => patch({ arrow: "none" })} title="No arrows">∅</PillBtn>
          <PillBtn active={edge.arrow === "start"} onClick={() => patch({ arrow: "start" })} title="Arrow at start">←</PillBtn>
          <PillBtn active={edge.arrow === "end"} onClick={() => patch({ arrow: "end" })} title="Arrow at end">→</PillBtn>
          <PillBtn active={edge.arrow === "both"} onClick={() => patch({ arrow: "both" })} title="Arrows both ends">↔</PillBtn>
        </div>
        <div style={sect}>
          <span style={label}>Line</span>
          <PillBtn active={(edge.style ?? "curved") === "straight"} onClick={() => patch({ style: "straight" })}>Straight</PillBtn>
          <PillBtn active={(edge.style ?? "curved") === "curved"} onClick={() => patch({ style: "curved" })}>Curved</PillBtn>
        </div>
        <div style={{ ...sect, borderRight: "none" }}>
          <IconBtn onClick={onDeleteSelection} title="Delete" danger><Trash2 size={13} /></IconBtn>
          <span style={{ fontSize: 11, color: "var(--mc-text-muted)" }}>1 Edge</span>
        </div>
      </div>
    );
  }

  // Single node
  const [nodeId] = [...selectedNodeIds];
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const patch = (p: Partial<MmapNode>) => onPatchNode(node.id, p);

  return (
    <div style={bar}>
      {/* SHAPE */}
      <div style={sect}>
        <span style={label}>Form</span>
        <select
          value={node.shape}
          onChange={(e) => patch({ shape: e.target.value as MmapShape })}
          style={{
            fontSize: 11, padding: "2px 4px",
            background: "var(--mc-surface-elevated)", border: "1px solid var(--mc-border)",
            color: "var(--mc-text-secondary)", cursor: "pointer", outline: "none",
            fontFamily: "Manrope, sans-serif",
          }}
        >
          {SHAPES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      {/* FILL */}
      <div style={sect}>
        <span style={label}>Fill</span>
        <Swatch transparent active={node.fill === "transparent"} onClick={() => patch({ fill: "transparent" })} />
        {COLOR_PALETTE.map((c) => (
          <Swatch key={c.value} color={c.value} active={node.fill === c.value} onClick={() => patch({ fill: c.value })} />
        ))}
      </div>

      {/* BORDER */}
      <div style={sect}>
        <span style={label}>Border</span>
        <Swatch transparent active={node.border === "transparent"} onClick={() => patch({ border: "transparent" })} />
        {COLOR_PALETTE.map((c) => (
          <Swatch key={c.value} color={c.value} active={node.border === c.value} onClick={() => patch({ border: c.value })} />
        ))}
        <div style={{ width: 1, height: 20, background: "var(--mc-border)", margin: "0 4px", flexShrink: 0 }} />
        <PillBtn active={node.borderStyle === "solid"} onClick={() => patch({ borderStyle: "solid" })} title="Solid">—</PillBtn>
        <PillBtn active={node.borderStyle === "dashed"} onClick={() => patch({ borderStyle: "dashed" })} title="Dashed">╌</PillBtn>
        <PillBtn active={node.borderStyle === "dotted"} onClick={() => patch({ borderStyle: "dotted" })} title="Dotted">⋯</PillBtn>
      </div>

      {/* TEXT */}
      <div style={sect}>
        <span style={label}>Text</span>
        {TEXT_COLORS.map((c) => (
          <Swatch key={c} color={c} active={node.textColor === c} onClick={() => patch({ textColor: c })} />
        ))}
      </div>

      {/* SIZE */}
      <div style={sect}>
        {SIZE_OPTIONS.map((s) => (
          <PillBtn key={s.label} active={node.fontSize === s.value} onClick={() => patch({ fontSize: s.value })}>{s.label}</PillBtn>
        ))}
      </div>

      {/* ALIGN */}
      <div style={sect}>
        <IconBtn onClick={() => patch({ textAlign: "left" })} title="Align left"><AlignLeft size={13} style={{ opacity: node.textAlign === "left" ? 1 : 0.45 }} /></IconBtn>
        <IconBtn onClick={() => patch({ textAlign: "center" })} title="Align center"><AlignCenter size={13} style={{ opacity: node.textAlign === "center" ? 1 : 0.45 }} /></IconBtn>
        <IconBtn onClick={() => patch({ textAlign: "right" })} title="Align right"><AlignRight size={13} style={{ opacity: node.textAlign === "right" ? 1 : 0.45 }} /></IconBtn>
        <IconBtn onClick={() => patch({ textVAlign: "top" })} title="Align top"><AlignStartVertical size={13} style={{ opacity: node.textVAlign === "top" ? 1 : 0.45 }} /></IconBtn>
        <IconBtn onClick={() => patch({ textVAlign: "middle" })} title="Align middle"><AlignCenterVertical size={13} style={{ opacity: node.textVAlign === "middle" ? 1 : 0.45 }} /></IconBtn>
        <IconBtn onClick={() => patch({ textVAlign: "bottom" })} title="Align bottom"><AlignEndVertical size={13} style={{ opacity: node.textVAlign === "bottom" ? 1 : 0.45 }} /></IconBtn>
      </div>

      {/* Selection actions + count */}
      <div style={{ ...sect, borderRight: "none", gap: 2 }}>
        <IconBtn onClick={onDuplicate} title="Duplicate (Ctrl+D)"><Copy size={13} /></IconBtn>
        <IconBtn onClick={onBringToFront} title="Bring to front"><ChevronUp size={13} /></IconBtn>
        <IconBtn onClick={onDeleteSelection} title="Delete (Del)" danger><Trash2 size={13} /></IconBtn>
        <span style={{ fontSize: 11, color: "var(--mc-text-muted)", paddingLeft: 4 }}>1 Box</span>
      </div>
    </div>
  );
}
