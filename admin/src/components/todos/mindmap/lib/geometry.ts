import type { MmapNode, MmapSide } from '../../lib/types';

export interface Point { x: number; y: number; }
export interface Rect { x: number; y: number; w: number; h: number; }

export function worldToScreen(p: Point, pan: Point, zoom: number): Point {
  return { x: p.x * zoom + pan.x, y: p.y * zoom + pan.y };
}

export function screenToWorld(p: Point, pan: Point, zoom: number): Point {
  return { x: (p.x - pan.x) / zoom, y: (p.y - pan.y) / zoom };
}

export function nodeRect(node: MmapNode): Rect {
  return { x: node.x, y: node.y, w: node.w, h: node.h };
}

export function nodeAnchor(node: MmapNode, side: MmapSide): Point {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  switch (side) {
    case 'n': return { x: cx, y: node.y };
    case 's': return { x: cx, y: node.y + node.h };
    case 'w': return { x: node.x, y: cy };
    case 'e': return { x: node.x + node.w, y: cy };
  }
}

export function nodeCenter(node: MmapNode): Point {
  return { x: node.x + node.w / 2, y: node.y + node.h / 2 };
}

/** Pick the side of `node` whose anchor is closest to `target`. */
export function bestSideTowards(node: MmapNode, target: Point): MmapSide {
  const c = nodeCenter(node);
  const dx = target.x - c.x;
  const dy = target.y - c.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'e' : 'w';
  return dy > 0 ? 's' : 'n';
}

function offsetAlong(p: Point, side: MmapSide, offset: number): Point {
  switch (side) {
    case 'n': return { x: p.x, y: p.y - offset };
    case 's': return { x: p.x, y: p.y + offset };
    case 'w': return { x: p.x - offset, y: p.y };
    case 'e': return { x: p.x + offset, y: p.y };
  }
}

/** Path between two anchor points. style='straight' → line; style='curved' (default) → cubic bezier. */
export function edgePath(from: Point, to: Point, fromSide: MmapSide, toSide: MmapSide, style: 'curved' | 'straight' = 'curved'): string {
  if (style === 'straight') return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const offset = Math.max(40, dist * 0.35);
  const c1 = offsetAlong(from, fromSide, offset);
  const c2 = offsetAlong(to, toSide, offset);
  return `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`;
}

/** Midpoint of the edge path. */
export function edgeMidpoint(from: Point, to: Point, fromSide: MmapSide, toSide: MmapSide, style: 'curved' | 'straight' = 'curved'): Point {
  if (style === 'straight') return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const offset = Math.max(40, dist * 0.35);
  const c1 = offsetAlong(from, fromSide, offset);
  const c2 = offsetAlong(to, toSide, offset);
  // Cubic bezier at t=0.5: 1/8(P0 + 3 P1 + 3 P2 + P3)
  return {
    x: (from.x + 3 * c1.x + 3 * c2.x + to.x) / 8,
    y: (from.y + 3 * c1.y + 3 * c2.y + to.y) / 8,
  };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

export function pointInRect(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function normalizeRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}

/** Bounding box covering all nodes (in world coords). Returns null if empty. */
export function nodesBoundingBox(nodes: MmapNode[]): Rect | null {
  if (nodes.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.w > maxX) maxX = n.x + n.w;
    if (n.y + n.h > maxY) maxY = n.y + n.h;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
