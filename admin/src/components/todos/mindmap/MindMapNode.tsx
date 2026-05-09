"use client";

import type { MmapNode, MmapSide } from "../lib/types";

interface Props {
  node: MmapNode;
  isSelected: boolean;
  isHovered: boolean;
  isEditing: boolean;
  zoom: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onResizeStart: (corner: 'nw' | 'ne' | 'sw' | 'se', e: React.PointerEvent) => void;
  onConnectStart: (side: MmapSide, e: React.PointerEvent) => void;
  onHover: (hovered: boolean) => void;
}

const RESIZE_CORNERS: { id: 'nw' | 'ne' | 'sw' | 'se'; cursor: string; x: (n: MmapNode) => number; y: (n: MmapNode) => number; }[] = [
  { id: 'nw', cursor: 'nwse-resize', x: (n) => n.x,           y: (n) => n.y          },
  { id: 'ne', cursor: 'nesw-resize', x: (n) => n.x + n.w,     y: (n) => n.y          },
  { id: 'sw', cursor: 'nesw-resize', x: (n) => n.x,           y: (n) => n.y + n.h    },
  { id: 'se', cursor: 'nwse-resize', x: (n) => n.x + n.w,     y: (n) => n.y + n.h    },
];

const SIDES: { id: MmapSide; x: (n: MmapNode) => number; y: (n: MmapNode) => number; }[] = [
  { id: 'n', x: (n) => n.x + n.w / 2, y: (n) => n.y          },
  { id: 's', x: (n) => n.x + n.w / 2, y: (n) => n.y + n.h    },
  { id: 'w', x: (n) => n.x,           y: (n) => n.y + n.h / 2 },
  { id: 'e', x: (n) => n.x + n.w,     y: (n) => n.y + n.h / 2 },
];

function renderShape(node: MmapNode) {
  const strokeDash = node.borderStyle === "dashed" ? "6 4" : node.borderStyle === "dotted" ? "2 3" : undefined;
  const common = {
    fill: node.fill,
    stroke: node.border,
    strokeWidth: 1,
    strokeDasharray: strokeDash,
  };
  switch (node.shape) {
    case "circle": {
      const cx = node.x + node.w / 2;
      const cy = node.y + node.h / 2;
      const rx = node.w / 2;
      const ry = node.h / 2;
      return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...common} />;
    }
    case "diamond": {
      const cx = node.x + node.w / 2;
      const cy = node.y + node.h / 2;
      const points = `${cx},${node.y} ${node.x + node.w},${cy} ${cx},${node.y + node.h} ${node.x},${cy}`;
      return <polygon points={points} {...common} />;
    }
    case "sticky": {
      return (
        <>
          <rect x={node.x + 3} y={node.y + 3} width={node.w} height={node.h} fill="rgba(0,0,0,0.25)" />
          <rect x={node.x} y={node.y} width={node.w} height={node.h} {...common} />
        </>
      );
    }
    case "rounded":
      return <rect x={node.x} y={node.y} width={node.w} height={node.h} rx={10} ry={10} {...common} />;
    case "rect":
    default:
      return <rect x={node.x} y={node.y} width={node.w} height={node.h} {...common} />;
  }
}

export default function MindMapNode({
  node,
  isSelected,
  isHovered,
  isEditing,
  zoom,
  onPointerDown,
  onDoubleClick,
  onResizeStart,
  onConnectStart,
  onHover,
}: Props) {
  const handleSize = 8 / zoom;
  const sideHandleR = 5 / zoom;
  const selectionInset = 2 / zoom;

  const justify =
    node.textAlign === "left" ? "flex-start" :
    node.textAlign === "right" ? "flex-end" : "center";
  const align =
    node.textVAlign === "top" ? "flex-start" :
    node.textVAlign === "bottom" ? "flex-end" : "center";

  return (
    <g
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      style={{ cursor: "move" }}
    >
      {renderShape(node)}

      {/* Text */}
      <foreignObject
        x={node.x}
        y={node.y}
        width={node.w}
        height={node.h}
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: justify,
            alignItems: align,
            padding: 8,
            boxSizing: "border-box",
            fontFamily: "Manrope, sans-serif",
            fontSize: node.fontSize,
            color: node.textColor,
            lineHeight: 1.3,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            userSelect: "none",
            overflow: "hidden",
            visibility: isEditing ? "hidden" : "visible",
          }}
        >
          {node.text || (isSelected ? "" : "Untitled")}
        </div>
      </foreignObject>

      {/* Selection outline */}
      {isSelected && (
        <rect
          x={node.x - selectionInset}
          y={node.y - selectionInset}
          width={node.w + selectionInset * 2}
          height={node.h + selectionInset * 2}
          fill="none"
          stroke="#ecdfcc"
          strokeWidth={1.5 / zoom}
          strokeDasharray={`${4 / zoom} ${3 / zoom}`}
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* Resize corners */}
      {isSelected && RESIZE_CORNERS.map((c) => (
        <rect
          key={c.id}
          x={c.x(node) - handleSize / 2}
          y={c.y(node) - handleSize / 2}
          width={handleSize}
          height={handleSize}
          fill="#ecdfcc"
          stroke="var(--mc-charcoal)"
          strokeWidth={1 / zoom}
          style={{ cursor: c.cursor }}
          onPointerDown={(e) => { e.stopPropagation(); onResizeStart(c.id, e); }}
        />
      ))}

      {/* Connect handles (visible when selected or hovered) */}
      {(isSelected || isHovered) && SIDES.map((s) => (
        <circle
          key={s.id}
          cx={s.x(node)}
          cy={s.y(node)}
          r={sideHandleR}
          fill="#5a8ab0"
          stroke="var(--mc-charcoal)"
          strokeWidth={1 / zoom}
          style={{ cursor: "crosshair" }}
          onPointerDown={(e) => { e.stopPropagation(); onConnectStart(s.id, e); }}
        />
      ))}
    </g>
  );
}
