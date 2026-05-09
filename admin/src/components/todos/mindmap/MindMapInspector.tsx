"use client";

import { COLOR_PALETTE } from "../lib/statuses";
import type { MmapNode, MmapEdge, MmapShape } from "../lib/types";

interface Props {
  selectedNodeIds: Set<string>;
  selectedEdgeId: string | null;
  nodes: MmapNode[];
  edges: MmapEdge[];
  onPatchNode: (id: string, patch: Partial<MmapNode>) => void;
  onPatchEdge: (id: string, patch: Partial<MmapEdge>) => void;
  onDeleteSelection: () => void;
}

const TEXT_COLORS = ["#ecdfcc", "#A89F91", "#1a1a18"];

const SHAPES: { id: MmapShape; label: string }[] = [
  { id: "rect", label: "▭" },
  { id: "rounded", label: "▢" },
  { id: "circle", label: "◯" },
  { id: "diamond", label: "◇" },
  { id: "sticky", label: "⬚" },
];

const FONT_SIZES = [12, 14, 18, 24] as const;
const WIDTHS = [1, 2, 3, 4] as const;
const ARROWS = ["none", "end", "both"] as const;

const panelStyle: React.CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  width: 200,
  background: "var(--mc-surface-elevated)",
  border: "1px solid var(--mc-border)",
  boxShadow: "var(--mc-shadow-md, 0 4px 12px rgba(0,0,0,0.35))",
  fontFamily: "Manrope, sans-serif",
  fontSize: 12,
  color: "var(--mc-text-primary)",
  zIndex: 10,
  userSelect: "none",
};

const sectionStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid var(--mc-border)",
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: "var(--mc-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 5,
};

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{children}</div>;
}

function Swatch({
  color,
  active,
  onClick,
  transparent,
}: {
  color?: string;
  active?: boolean;
  onClick: () => void;
  transparent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 18,
        height: 18,
        border: active ? "2px solid #ecdfcc" : "1px solid var(--mc-border)",
        background: transparent ? "transparent" : color,
        cursor: "pointer",
        outline: "none",
        position: "relative",
        flexShrink: 0,
      }}
      title={transparent ? "No fill" : color}
    >
      {transparent && (
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--mc-text-muted)" }}>∅</span>
      )}
    </button>
  );
}

function PillBtn({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "2px 7px",
        fontSize: 11,
        background: active ? "var(--mc-accent, #ecdfcc)" : "var(--mc-surface-warm)",
        color: active ? "var(--mc-charcoal, #1a1a18)" : "var(--mc-text-secondary)",
        border: "1px solid var(--mc-border)",
        cursor: "pointer",
        outline: "none",
        fontFamily: "Manrope, sans-serif",
      }}
    >
      {children}
    </button>
  );
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "5px 0",
        background: "transparent",
        border: "1px solid #c45a5a",
        color: "#c45a5a",
        fontSize: 11,
        fontFamily: "Manrope, sans-serif",
        cursor: "pointer",
        outline: "none",
      }}
    >
      Delete
    </button>
  );
}

export default function MindMapInspector({
  selectedNodeIds,
  selectedEdgeId,
  nodes,
  edges,
  onPatchNode,
  onPatchEdge,
  onDeleteSelection,
}: Props) {
  const count = selectedNodeIds.size + (selectedEdgeId ? 1 : 0);
  if (count === 0) return null;

  // Multi-selection
  if (count > 1) {
    return (
      <div style={panelStyle}>
        <div style={sectionStyle}>
          <span style={{ color: "var(--mc-text-secondary)" }}>{selectedNodeIds.size} nodes selected</span>
        </div>
        <div style={{ padding: "8px 10px" }}>
          <DeleteBtn onClick={onDeleteSelection} />
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
      <div style={panelStyle}>
        <div style={sectionStyle}>
          <div style={labelStyle}>Color</div>
          <Row>
            {COLOR_PALETTE.map((c) => (
              <Swatch key={c.value} color={c.value} active={edge.color === c.value} onClick={() => patch({ color: c.value })} />
            ))}
          </Row>
        </div>
        <div style={sectionStyle}>
          <div style={labelStyle}>Width</div>
          <Row>
            {WIDTHS.map((w) => (
              <PillBtn key={w} active={edge.width === w} onClick={() => patch({ width: w })}>{w}</PillBtn>
            ))}
          </Row>
        </div>
        <div style={sectionStyle}>
          <div style={labelStyle}>Arrow</div>
          <Row>
            {ARROWS.map((a) => (
              <PillBtn key={a} active={edge.arrow === a} onClick={() => patch({ arrow: a })}>{a}</PillBtn>
            ))}
          </Row>
        </div>
        <div style={sectionStyle}>
          <div style={labelStyle}>Label</div>
          <input
            value={edge.label}
            onChange={(e) => patch({ label: e.target.value })}
            placeholder="Add label…"
            style={{
              width: "100%",
              background: "var(--mc-surface-warm)",
              border: "1px solid var(--mc-border)",
              color: "var(--mc-text-primary)",
              fontFamily: "Manrope, sans-serif",
              fontSize: 12,
              padding: "3px 6px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ padding: "8px 10px" }}>
          <DeleteBtn onClick={onDeleteSelection} />
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
    <div style={panelStyle}>
      <div style={sectionStyle}>
        <div style={labelStyle}>Shape</div>
        <Row>
          {SHAPES.map((s) => (
            <PillBtn key={s.id} active={node.shape === s.id} onClick={() => patch({ shape: s.id })}>
              {s.label}
            </PillBtn>
          ))}
        </Row>
      </div>
      <div style={sectionStyle}>
        <div style={labelStyle}>Fill</div>
        <Row>
          <Swatch transparent active={node.fill === "transparent"} onClick={() => patch({ fill: "transparent" })} />
          {COLOR_PALETTE.map((c) => (
            <Swatch key={c.value} color={c.value} active={node.fill === c.value} onClick={() => patch({ fill: c.value })} />
          ))}
        </Row>
      </div>
      <div style={sectionStyle}>
        <div style={labelStyle}>Border</div>
        <Row>
          {COLOR_PALETTE.map((c) => (
            <Swatch key={c.value} color={c.value} active={node.border === c.value} onClick={() => patch({ border: c.value })} />
          ))}
        </Row>
        <div style={{ marginTop: 5 }}>
          <Row>
            <PillBtn active={node.borderStyle === "solid"} onClick={() => patch({ borderStyle: "solid" })}>Solid</PillBtn>
            <PillBtn active={node.borderStyle === "dashed"} onClick={() => patch({ borderStyle: "dashed" })}>Dashed</PillBtn>
          </Row>
        </div>
      </div>
      <div style={sectionStyle}>
        <div style={labelStyle}>Text color</div>
        <Row>
          {TEXT_COLORS.map((c) => (
            <Swatch key={c} color={c} active={node.textColor === c} onClick={() => patch({ textColor: c })} />
          ))}
        </Row>
      </div>
      <div style={sectionStyle}>
        <div style={labelStyle}>Font size</div>
        <Row>
          {FONT_SIZES.map((s) => (
            <PillBtn key={s} active={node.fontSize === s} onClick={() => patch({ fontSize: s })}>{s}</PillBtn>
          ))}
        </Row>
      </div>
      <div style={sectionStyle}>
        <div style={labelStyle}>Align</div>
        <Row>
          {(["left", "center", "right"] as const).map((a) => (
            <PillBtn key={a} active={node.textAlign === a} onClick={() => patch({ textAlign: a })}>
              {a === "left" ? "⫷" : a === "center" ? "≡" : "⫸"}
            </PillBtn>
          ))}
        </Row>
        <div style={{ marginTop: 4 }}>
          <Row>
            {(["top", "middle", "bottom"] as const).map((v) => (
              <PillBtn key={v} active={node.textVAlign === v} onClick={() => patch({ textVAlign: v })}>
                {v[0].toUpperCase()}
              </PillBtn>
            ))}
          </Row>
        </div>
      </div>
      <div style={{ padding: "8px 10px" }}>
        <DeleteBtn onClick={onDeleteSelection} />
      </div>
    </div>
  );
}
