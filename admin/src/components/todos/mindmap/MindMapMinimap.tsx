"use client";

import type { MindMap } from "../lib/types";
import { nodesBoundingBox, screenToWorld } from "./lib/geometry";

interface Props {
  mindMap: MindMap;
  pan: { x: number; y: number };
  zoom: number;
  canvasSize: { w: number; h: number };
  onRecenter: (worldPoint: { x: number; y: number }) => void;
}

const W = 180;
const H = 120;
const PAD = 80;

export default function MindMapMinimap({ mindMap, pan, zoom, canvasSize, onRecenter }: Props) {
  if (mindMap.nodes.length === 0) return null;

  const nodeBox = nodesBoundingBox(mindMap.nodes);
  if (!nodeBox) return null;

  // Padded nodes bounding box
  const nb = { x: nodeBox.x - PAD, y: nodeBox.y - PAD, w: nodeBox.w + PAD * 2, h: nodeBox.h + PAD * 2 };

  // Viewport rect in world coords
  const tl = screenToWorld({ x: 0, y: 0 }, pan, zoom);
  const br = screenToWorld({ x: canvasSize.w, y: canvasSize.h }, pan, zoom);
  const vp = { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };

  // Super-box: union of nb and vp so we always see both
  const sx = Math.min(nb.x, vp.x);
  const sy = Math.min(nb.y, vp.y);
  const sr = Math.max(nb.x + nb.w, vp.x + vp.w);
  const sb = Math.max(nb.y + nb.h, vp.y + vp.h);
  const sw = Math.max(sr - sx, 1);
  const sh = Math.max(sb - sy, 1);

  const viewBox = `${sx} ${sy} ${sw} ${sh}`;

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    onRecenter({ x: sx + fx * sw, y: sy + fy * sh });
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        right: 12,
        width: W,
        height: H,
        background: "var(--mc-surface)",
        border: "1px solid var(--mc-border)",
        boxShadow: "var(--mc-shadow-lg, 0 8px 24px rgba(0,0,0,0.5))",
        zIndex: 10,
        overflow: "hidden",
      }}
      title="Mini-map — click to jump"
    >
      <svg
        width={W}
        height={H}
        viewBox={viewBox}
        preserveAspectRatio="none"
        style={{ display: "block", cursor: "crosshair" }}
        onClick={handleClick}
      >
        {/* Node dots */}
        {mindMap.nodes.map((n) => (
          <rect
            key={n.id}
            x={n.x}
            y={n.y}
            width={n.w}
            height={n.h}
            fill={n.fill === "transparent" ? "rgba(236,223,204,0.25)" : n.fill}
            opacity={0.85}
          />
        ))}

        {/* Viewport indicator */}
        <rect
          x={vp.x}
          y={vp.y}
          width={vp.w}
          height={vp.h}
          fill="rgba(236,223,204,0.08)"
          stroke="#ecdfcc"
          strokeWidth={Math.max(sw, sh) * 0.012}
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: "none" }}
        />
      </svg>
    </div>
  );
}
