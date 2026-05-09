"use client";

import type { MmapNode, MmapEdge } from "../lib/types";
import { nodeAnchor, edgePath, edgeMidpoint } from "./lib/geometry";

interface Props {
  edge: MmapEdge;
  fromNode: MmapNode;
  toNode: MmapNode;
  isSelected: boolean;
  zoom: number;
  onSelect: (e: React.MouseEvent) => void;
  onLabelEdit: () => void;
}

export default function MindMapEdge({ edge, fromNode, toNode, isSelected, zoom, onSelect, onLabelEdit }: Props) {
  const a = nodeAnchor(fromNode, edge.fromSide);
  const b = nodeAnchor(toNode, edge.toSide);
  const edgeStyle = edge.style ?? "curved";
  const d = edgePath(a, b, edge.fromSide, edge.toSide, edgeStyle);
  const mid = edgeMidpoint(a, b, edge.fromSide, edge.toSide, edgeStyle);
  const markerId = `arrow-${edge.id}`;
  const showStart = edge.arrow === "start" || edge.arrow === "both";
  const showEnd = edge.arrow === "end" || edge.arrow === "both";

  return (
    <g style={{ cursor: "pointer" }}>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={edge.color} />
        </marker>
      </defs>
      {/* Invisible wide hit-target */}
      <path
        d={d}
        stroke="transparent"
        strokeWidth={Math.max(14, edge.width + 14) / zoom}
        fill="none"
        onMouseDown={onSelect}
      />
      {/* Visible path */}
      <path
        d={d}
        stroke={edge.color}
        strokeWidth={isSelected ? edge.width + 1 : edge.width}
        fill="none"
        markerEnd={showEnd ? `url(#${markerId})` : undefined}
        markerStart={showStart ? `url(#${markerId})` : undefined}
        style={{ pointerEvents: "none" }}
      />
      {/* Selection highlight */}
      {isSelected && (
        <path
          d={d}
          stroke="#ecdfcc"
          strokeWidth={(edge.width + 6) / 1}
          fill="none"
          opacity={0.25}
          style={{ pointerEvents: "none" }}
        />
      )}
      {/* Label */}
      {edge.label && (
        <foreignObject
          x={mid.x - 60}
          y={mid.y - 12}
          width={120}
          height={24}
          style={{ pointerEvents: "none" }}
        >
          <div
            onDoubleClick={(e) => { e.stopPropagation(); onLabelEdit(); }}
            style={{
              pointerEvents: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              fontSize: 11,
              fontFamily: "Manrope, sans-serif",
              color: edge.color,
              background: "var(--mc-charcoal)",
              padding: "0 6px",
              border: `1px solid ${edge.color}`,
              boxShadow: "0 0 0 2px var(--mc-charcoal)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {edge.label}
          </div>
        </foreignObject>
      )}
    </g>
  );
}
