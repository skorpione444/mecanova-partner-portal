"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MindMap, MmapEdge, MmapNode } from "../lib/types";
import {
  bestSideTowards,
  nodeAnchor,
  nodeRect,
  normalizeRect,
  pointInRect,
  rectsOverlap,
  screenToWorld,
  worldToScreen,
} from "./lib/geometry";
import { COLOR_PALETTE } from "../lib/statuses";
import MindMapEdge from "./MindMapEdge";
import BottomToolbar from "./BottomToolbar";
import MindMapMinimap from "./MindMapMinimap";
import MindMapNode from "./MindMapNode";

type Interaction =
  | { type: "idle" }
  | { type: "panning"; startScreen: { x: number; y: number }; startPan: { x: number; y: number } }
  | {
      type: "dragging-nodes";
      startWorld: { x: number; y: number };
      originsByNode: Record<string, { x: number; y: number }>;
      preSnapshot: MindMap;
    }
  | {
      type: "resizing";
      nodeId: string;
      corner: "nw" | "ne" | "sw" | "se";
      startWorld: { x: number; y: number };
      originNode: MmapNode;
      preSnapshot: MindMap;
    }
  | {
      type: "connecting";
      fromNodeId: string;
      ghostPos: { x: number; y: number };
    }
  | {
      type: "selecting-box";
      startWorld: { x: number; y: number };
      currentWorld: { x: number; y: number };
      additive: boolean;
    };

interface Props {
  mindMap: MindMap;
  onMindMapChange: (mm: MindMap) => void;
  pushHistory: (snapshot: MindMap) => void;
  selectedNodeIds: Set<string>;
  selectedEdgeId: string | null;
  setSelectedNodeIds: (ids: Set<string>) => void;
  setSelectedEdgeId: (id: string | null) => void;
}

const DEFAULT_NODE: Omit<MmapNode, "id" | "x" | "y"> = {
  w: 160,
  h: 60,
  text: "",
  shape: "rect",
  fill: COLOR_PALETTE[1].value,
  border: COLOR_PALETTE[6].value,
  borderStyle: "solid",
  textColor: "#ecdfcc",
  fontSize: 14,
  textAlign: "center",
  textVAlign: "middle",
  z: 0,
};

export default function MindMapCanvas({
  mindMap,
  onMindMapChange,
  pushHistory,
  selectedNodeIds,
  selectedEdgeId,
  setSelectedNodeIds,
  setSelectedEdgeId,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const panRef = useRef({ x: mindMap.viewport.x, y: mindMap.viewport.y });
  const zoomRef = useRef(mindMap.viewport.zoom);
  const [, forceRender] = useState(0);
  const rerender = useCallback(() => forceRender((v) => v + 1), []);

  const interaction = useRef<Interaction>({ type: "idle" });
  const spaceHeld = useRef(false);

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingEdgeLabelId, setEditingEdgeLabelId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const editTextRef = useRef("");
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });

  // Track canvas dimensions for minimap
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setCanvasSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sync viewport from parent when workspace changes
  const lastWorkspaceViewport = useRef(mindMap.viewport);
  useEffect(() => {
    const vp = mindMap.viewport;
    if (
      vp.x !== lastWorkspaceViewport.current.x ||
      vp.y !== lastWorkspaceViewport.current.y ||
      vp.zoom !== lastWorkspaceViewport.current.zoom
    ) {
      panRef.current = { x: vp.x, y: vp.y };
      zoomRef.current = vp.zoom;
      lastWorkspaceViewport.current = vp;
      rerender();
    }
  }, [mindMap.viewport, rerender]);

  // ── helpers ────────────────────────────────────────────────────────────────

  function svgPoint(e: React.PointerEvent | React.MouseEvent | React.WheelEvent) {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function toWorld(screenPt: { x: number; y: number }) {
    return screenToWorld(screenPt, panRef.current, zoomRef.current);
  }

  function commit(producer: (mm: MindMap) => MindMap) {
    pushHistory(mindMap);
    const next = producer(mindMap);
    onMindMapChange(next);
  }

  function commitViewport() {
    onMindMapChange({
      ...mindMap,
      viewport: { x: panRef.current.x, y: panRef.current.y, zoom: zoomRef.current },
    });
  }

  // ── mutations ──────────────────────────────────────────────────────────────

  function addNode(node: MmapNode) {
    commit((mm) => ({ ...mm, nodes: [...mm.nodes, node] }));
  }

  function patchNode(id: string, patch: Partial<MmapNode>) {
    commit((mm) => ({
      ...mm,
      nodes: mm.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    }));
  }

  function deleteNodes(ids: Set<string>) {
    commit((mm) => ({
      ...mm,
      nodes: mm.nodes.filter((n) => !ids.has(n.id)),
      edges: mm.edges.filter((e) => !ids.has(e.from) && !ids.has(e.to)),
    }));
    setSelectedNodeIds(new Set());
  }

  function addEdge(edge: MmapEdge) {
    commit((mm) => ({ ...mm, edges: [...mm.edges, edge] }));
  }

  function patchEdge(id: string, patch: Partial<MmapEdge>) {
    commit((mm) => ({
      ...mm,
      edges: mm.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }

  function deleteEdge(id: string) {
    commit((mm) => ({ ...mm, edges: mm.edges.filter((e) => e.id !== id) }));
    setSelectedEdgeId(null);
  }

  function deleteSelection() {
    if (selectedNodeIds.size > 0) deleteNodes(selectedNodeIds);
    else if (selectedEdgeId) deleteEdge(selectedEdgeId);
  }

  function duplicateSelected() {
    if (selectedNodeIds.size === 0) return;
    const ids = [...selectedNodeIds];
    const newNodes: MmapNode[] = [];
    const idMap: Record<string, string> = {};
    for (const id of ids) {
      const n = mindMap.nodes.find((x) => x.id === id);
      if (!n) continue;
      const newId = crypto.randomUUID();
      idMap[id] = newId;
      newNodes.push({ ...n, id: newId, x: n.x + 20, y: n.y + 20 });
    }
    commit((mm) => ({ ...mm, nodes: [...mm.nodes, ...newNodes] }));
    setSelectedNodeIds(new Set(Object.values(idMap)));
  }

  function patchNodes(ids: Set<string>, patch: Partial<MmapNode>) {
    commit((mm) => ({
      ...mm,
      nodes: mm.nodes.map((n) => (ids.has(n.id) ? { ...n, ...patch } : n)),
    }));
  }

  function bringSelectionToFront() {
    if (selectedNodeIds.size === 0) return;
    const maxZ = Math.max(0, ...mindMap.nodes.map((n) => n.z));
    commit((mm) => ({
      ...mm,
      nodes: mm.nodes.map((n, i) => selectedNodeIds.has(n.id) ? { ...n, z: maxZ + i + 1 } : n),
    }));
  }

  function nudgeSelected(dx: number, dy: number) {
    if (selectedNodeIds.size === 0) return;
    commit((mm) => ({
      ...mm,
      nodes: mm.nodes.map((n) =>
        selectedNodeIds.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n
      ),
    }));
  }

  // ── zoom ───────────────────────────────────────────────────────────────────

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    // Vertical scroll (mouse wheel or trackpad pinch) → zoom at cursor
    if (e.deltaY !== 0) {
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const cursor = svgPoint(e);
      const cursorWorld = toWorld(cursor);
      const newZoom = Math.max(0.25, Math.min(3, zoomRef.current * factor));
      panRef.current = {
        x: cursor.x - cursorWorld.x * newZoom,
        y: cursor.y - cursorWorld.y * newZoom,
      };
      zoomRef.current = newZoom;
    }
    // Horizontal scroll (trackpad two-finger swipe) → pan horizontally
    if (e.deltaX !== 0) {
      panRef.current = { x: panRef.current.x - e.deltaX, y: panRef.current.y };
    }
    rerender();
  }

  // ── keyboard ───────────────────────────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === " ") { spaceHeld.current = true; return; }

      if (e.key === "Escape") {
        setEditingNodeId(null);
        setEditingEdgeLabelId(null);
        setSelectedNodeIds(new Set());
        setSelectedEdgeId(null);
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && editingNodeId === null) {
        e.preventDefault();
        deleteSelection();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        setSelectedNodeIds(new Set(mindMap.nodes.map((n) => n.id)));
        setSelectedEdgeId(null);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        duplicateSelected();
        return;
      }

      if (e.key === "ArrowLeft") { e.preventDefault(); nudgeSelected(e.shiftKey ? -10 : -1, 0); }
      if (e.key === "ArrowRight") { e.preventDefault(); nudgeSelected(e.shiftKey ? 10 : 1, 0); }
      if (e.key === "ArrowUp") { e.preventDefault(); nudgeSelected(0, e.shiftKey ? -10 : -1); }
      if (e.key === "ArrowDown") { e.preventDefault(); nudgeSelected(0, e.shiftKey ? 10 : 1); }

      // Enter → start editing the selected node
      if (e.key === "Enter" && selectedNodeIds.size === 1 && editingNodeId === null) {
        e.preventDefault();
        const [id] = [...selectedNodeIds];
        const n = mindMap.nodes.find((x) => x.id === id);
        if (n) { editTextRef.current = n.text; setEditingNodeId(id); }
        return;
      }

      // Tab → create new connected box to the right
      if (e.key === "Tab" && selectedNodeIds.size === 1 && editingNodeId === null) {
        e.preventDefault();
        const [fromId] = [...selectedNodeIds];
        const fromNode = mindMap.nodes.find((x) => x.id === fromId);
        if (!fromNode) return;
        const newId = crypto.randomUUID();
        const newNode: MmapNode = {
          ...DEFAULT_NODE,
          id: newId,
          x: fromNode.x + fromNode.w + 80,
          y: fromNode.y,
          z: mindMap.nodes.length,
          shape: fromNode.shape,
          fill: fromNode.fill,
          border: fromNode.border,
          borderStyle: fromNode.borderStyle,
          textColor: fromNode.textColor,
          fontSize: fromNode.fontSize,
        };
        commit((mm) => ({
          ...mm,
          nodes: [...mm.nodes, newNode],
          edges: [...mm.edges, {
            id: crypto.randomUUID(),
            from: fromId,
            to: newId,
            fromSide: "e",
            toSide: "w",
            label: "",
            color: COLOR_PALETTE[1].value,
            width: 1,
            arrow: "end",
            style: "curved" as const,
          }],
        }));
        setSelectedNodeIds(new Set([newId]));
        setEditingNodeId(newId);
        editTextRef.current = "";
        return;
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key === " ") spaceHeld.current = false;
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mindMap, selectedNodeIds, selectedEdgeId, editingNodeId]);

  // ── pointer events ─────────────────────────────────────────────────────────

  function onSvgPointerDown(e: React.PointerEvent) {
    if (e.button === 1 || spaceHeld.current || (e.button === 0 && !e.shiftKey && !e.metaKey)) {
      e.preventDefault();
      interaction.current = { type: "panning", startScreen: { x: e.clientX, y: e.clientY }, startPan: { ...panRef.current } };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;

    // Shift+drag → marquee select
    const wp = toWorld(svgPoint(e));
    interaction.current = {
      type: "selecting-box",
      startWorld: wp,
      currentWorld: wp,
      additive: true,
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function onSvgPointerMove(e: React.PointerEvent) {
    const ia = interaction.current;

    if (ia.type === "panning") {
      const dx = e.clientX - ia.startScreen.x;
      const dy = e.clientY - ia.startScreen.y;
      panRef.current = { x: ia.startPan.x + dx, y: ia.startPan.y + dy };
      rerender();
      return;
    }

    if (ia.type === "dragging-nodes") {
      const wp = toWorld(svgPoint(e));
      const dx = wp.x - ia.startWorld.x;
      const dy = wp.y - ia.startWorld.y;
      onMindMapChange({
        ...mindMap,
        nodes: mindMap.nodes.map((n) => {
          const orig = ia.originsByNode[n.id];
          return orig ? { ...n, x: orig.x + dx, y: orig.y + dy } : n;
        }),
      });
      return;
    }

    if (ia.type === "resizing") {
      const wp = toWorld(svgPoint(e));
      const orig = ia.originNode;
      let { x, y, w, h } = orig;
      const dx = wp.x - ia.startWorld.x;
      const dy = wp.y - ia.startWorld.y;
      if (ia.corner === "se") { w = Math.max(40, orig.w + dx); h = Math.max(30, orig.h + dy); }
      else if (ia.corner === "sw") { const nw = Math.max(40, orig.w - dx); x = orig.x + orig.w - nw; w = nw; h = Math.max(30, orig.h + dy); }
      else if (ia.corner === "ne") { w = Math.max(40, orig.w + dx); const nh = Math.max(30, orig.h - dy); y = orig.y + orig.h - nh; h = nh; }
      else { const nw = Math.max(40, orig.w - dx); x = orig.x + orig.w - nw; w = nw; const nh = Math.max(30, orig.h - dy); y = orig.y + orig.h - nh; h = nh; }
      onMindMapChange({
        ...mindMap,
        nodes: mindMap.nodes.map((n) => (n.id === ia.nodeId ? { ...n, x, y, w, h } : n)),
      });
      return;
    }

    if (ia.type === "connecting") {
      const wp = toWorld(svgPoint(e));
      interaction.current = { ...ia, ghostPos: wp };
      rerender();
      return;
    }

    if (ia.type === "selecting-box") {
      const wp = toWorld(svgPoint(e));
      interaction.current = { ...ia, currentWorld: wp };
      rerender();
      return;
    }
  }

  function onSvgPointerUp(e: React.PointerEvent) {
    const ia = interaction.current;

    if (ia.type === "panning") {
      const dx = e.clientX - ia.startScreen.x;
      const dy = e.clientY - ia.startScreen.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        commitViewport();
      } else {
        // Click-without-drag on empty canvas → clear selection, but protect
        // against accidental deselects when clicking between/near selected nodes.
        const wp = toWorld(svgPoint(e));
        const guardWorld = 24 / zoomRef.current;
        const nearSelected = mindMap.nodes.some(
          (n) =>
            selectedNodeIds.has(n.id) &&
            pointInRect(wp, { x: n.x - guardWorld, y: n.y - guardWorld, w: n.w + guardWorld * 2, h: n.h + guardWorld * 2 })
        );
        if (!nearSelected) {
          setSelectedNodeIds(new Set());
          setSelectedEdgeId(null);
        }
      }
    }

    if (ia.type === "dragging-nodes") {
      const wp = toWorld(svgPoint(e));
      const moved = Math.abs(wp.x - ia.startWorld.x) > 1 || Math.abs(wp.y - ia.startWorld.y) > 1;
      if (moved) pushHistory(ia.preSnapshot);
    }

    if (ia.type === "resizing") {
      pushHistory(ia.preSnapshot);
    }

    if (ia.type === "connecting") {
      const wp = toWorld(svgPoint(e));
      const fromNode = mindMap.nodes.find((n) => n.id === ia.fromNodeId);
      if (fromNode) {
        const padWorld = 12 / zoomRef.current;
        const target = mindMap.nodes.find(
          (n) =>
            n.id !== ia.fromNodeId &&
            pointInRect(wp, { x: n.x - padWorld, y: n.y - padWorld, w: n.w + padWorld * 2, h: n.h + padWorld * 2 })
        );
        if (target) {
          const fromSide = bestSideTowards(fromNode, { x: target.x + target.w / 2, y: target.y + target.h / 2 });
          const toSide = bestSideTowards(target, { x: fromNode.x + fromNode.w / 2, y: fromNode.y + fromNode.h / 2 });
          addEdge({
            id: crypto.randomUUID(),
            from: fromNode.id,
            to: target.id,
            fromSide,
            toSide,
            label: "",
            color: COLOR_PALETTE[1].value,
            width: 1,
            arrow: "end",
            style: "curved" as const,
          });
        } else {
          // Drop onto empty space — create new node + edge
          const newNodeId = crypto.randomUUID();
          const newNode: MmapNode = {
            ...DEFAULT_NODE,
            id: newNodeId,
            x: wp.x - DEFAULT_NODE.w / 2,
            y: wp.y - DEFAULT_NODE.h / 2,
            z: mindMap.nodes.length,
          };
          const fromSide = bestSideTowards(fromNode, wp);
          const toSide = bestSideTowards(newNode, { x: fromNode.x + fromNode.w / 2, y: fromNode.y + fromNode.h / 2 });
          commit((mm) => ({
            ...mm,
            nodes: [...mm.nodes, newNode],
            edges: [
              ...mm.edges,
              {
                id: crypto.randomUUID(),
                from: fromNode.id,
                to: newNodeId,
                fromSide,
                toSide,
                label: "",
                color: COLOR_PALETTE[1].value,
                width: 1,
                arrow: "end",
                style: "curved" as const,
              },
            ],
          }));
          setSelectedNodeIds(new Set([newNodeId]));
          setEditingNodeId(newNodeId);
        }
      }
    }

    if (ia.type === "selecting-box") {
      const marquee = normalizeRect(ia.startWorld, ia.currentWorld);
      if (marquee.w < 4 && marquee.h < 4) {
        // Treat as click on empty space
        if (!ia.additive) {
          setSelectedNodeIds(new Set());
          setSelectedEdgeId(null);
        }
      } else {
        const hits = new Set(
          mindMap.nodes.filter((n) => rectsOverlap(nodeRect(n), marquee)).map((n) => n.id)
        );
        setSelectedNodeIds(ia.additive ? new Set([...selectedNodeIds, ...hits]) : hits);
        setSelectedEdgeId(null);
      }
    }

    interaction.current = { type: "idle" };
    rerender();
  }

  function onSvgDoubleClick(e: React.MouseEvent) {
    e.preventDefault();
    const wp = toWorld(svgPoint(e));
    const newId = crypto.randomUUID();
    const newNode: MmapNode = {
      ...DEFAULT_NODE,
      id: newId,
      x: wp.x - DEFAULT_NODE.w / 2,
      y: wp.y - DEFAULT_NODE.h / 2,
      z: mindMap.nodes.length,
    };
    addNode(newNode);
    setSelectedNodeIds(new Set([newId]));
    setSelectedEdgeId(null);
    setEditingNodeId(newId);
    editTextRef.current = "";
  }

  // ── node event handlers ────────────────────────────────────────────────────

  function onNodePointerDown(nodeId: string, e: React.PointerEvent) {
    e.stopPropagation();
    // Bug 5: if clicking the node border while editing the same node, exit edit and continue
    if (editingNodeId === nodeId) {
      commitEdit();
    }

    // Compute next selection synchronously so drag origins are always consistent (bugs 2 + 6)
    let nextSelection: Set<string>;
    if (!selectedNodeIds.has(nodeId)) {
      nextSelection = (e.shiftKey || e.metaKey)
        ? new Set([...selectedNodeIds, nodeId])
        : new Set([nodeId]);
    } else if ((e.shiftKey || e.metaKey) && selectedNodeIds.size > 1) {
      nextSelection = new Set(selectedNodeIds);
      nextSelection.delete(nodeId);
    } else {
      nextSelection = selectedNodeIds;
    }
    setSelectedNodeIds(nextSelection);
    if (nextSelection !== selectedNodeIds) setSelectedEdgeId(null);

    // Build origins from the actual resulting selection
    const dragIds = nextSelection.has(nodeId) ? [...nextSelection] : [nodeId];
    const wp = toWorld(svgPoint(e));
    const origins: Record<string, { x: number; y: number }> = {};
    for (const id of dragIds) {
      const n = mindMap.nodes.find((x) => x.id === id);
      if (n) origins[id] = { x: n.x, y: n.y };
    }

    interaction.current = { type: "dragging-nodes", startWorld: wp, originsByNode: origins, preSnapshot: mindMap };
    (svgRef.current as unknown as Element).setPointerCapture?.(e.pointerId);
  }

  function onNodeDoubleClick(nodeId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const node = mindMap.nodes.find((n) => n.id === nodeId);
    editTextRef.current = node?.text ?? "";
    setEditingNodeId(nodeId);
  }

  function onResizeStart(nodeId: string, corner: "nw" | "ne" | "sw" | "se", e: React.PointerEvent) {
    e.stopPropagation();
    const node = mindMap.nodes.find((n) => n.id === nodeId)!;
    interaction.current = {
      type: "resizing",
      nodeId,
      corner,
      startWorld: toWorld(svgPoint(e)),
      originNode: { ...node },
      preSnapshot: mindMap,
    };
    (svgRef.current as unknown as Element).setPointerCapture?.(e.pointerId);
  }

  function onConnectStart(nodeId: string, _side: string, e: React.PointerEvent) {
    e.stopPropagation();
    const wp = toWorld(svgPoint(e));
    interaction.current = { type: "connecting", fromNodeId: nodeId, ghostPos: wp };
    (svgRef.current as unknown as Element).setPointerCapture?.(e.pointerId);
  }

  // ── inline text editing ────────────────────────────────────────────────────

  function commitEdit() {
    if (editingNodeId) {
      patchNode(editingNodeId, { text: editTextRef.current });
      setEditingNodeId(null);
    }
    if (editingEdgeLabelId) {
      patchEdge(editingEdgeLabelId, { label: editTextRef.current });
      setEditingEdgeLabelId(null);
    }
  }

  function cancelEdit() {
    setEditingNodeId(null);
    setEditingEdgeLabelId(null);
  }

  // ── render helpers ─────────────────────────────────────────────────────────

  const pan = panRef.current;
  const zoom = zoomRef.current;

  const ia = interaction.current;
  let marqueeRect: { x: number; y: number; w: number; h: number } | null = null;
  if (ia.type === "selecting-box") {
    marqueeRect = normalizeRect(ia.startWorld, ia.currentWorld);
  }

  let ghostEdge: React.ReactNode = null;
  if (ia.type === "connecting") {
    const fromNode = mindMap.nodes.find((n) => n.id === ia.fromNodeId);
    if (fromNode) {
      const fromSide = bestSideTowards(fromNode, ia.ghostPos);
      const a = nodeAnchor(fromNode, fromSide);
      ghostEdge = (
        <line
          x1={a.x}
          y1={a.y}
          x2={ia.ghostPos.x}
          y2={ia.ghostPos.y}
          stroke={COLOR_PALETTE[1].value}
          strokeWidth={1.5 / zoom}
          strokeDasharray={`${4 / zoom} ${3 / zoom}`}
          style={{ pointerEvents: "none" }}
        />
      );
    }
  }

  // Editing node screen rect for overlay textarea
  let editOverlay: React.ReactNode = null;
  const editNodeId = editingNodeId ?? editingEdgeLabelId;
  if (editNodeId) {
    const node = editingNodeId ? mindMap.nodes.find((n) => n.id === editNodeId) : null;
    const edge = editingEdgeLabelId ? mindMap.edges.find((e) => e.id === editNodeId) : null;
    if (node) {
      const tl = worldToScreen({ x: node.x, y: node.y }, pan, zoom);
      const justify =
        node.textAlign === "left" ? "flex-start" :
        node.textAlign === "right" ? "flex-end" : "center";
      const INSET = 8;
      editOverlay = (
        <textarea
          autoFocus
          defaultValue={node.text}
          onChange={(e) => { editTextRef.current = e.target.value; }}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(); }
          }}
          style={{
            position: "absolute",
            left: tl.x + INSET,
            top: tl.y + INSET,
            width: Math.max(0, node.w * zoom - INSET * 2),
            height: Math.max(0, node.h * zoom - INSET * 2),
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            padding: Math.max(0, 8 * zoom - INSET),
            boxSizing: "border-box",
            fontFamily: "Manrope, sans-serif",
            fontSize: node.fontSize * zoom,
            color: node.textColor,
            lineHeight: 1.3,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            display: "flex",
            justifyContent: justify,
            zIndex: 20,
            caretColor: node.textColor,
          }}
        />
      );
    } else if (edge) {
      // Edge label edit — small centered textarea near midpoint
      const fromNode = mindMap.nodes.find((n) => n.id === edge.from);
      const toNode = mindMap.nodes.find((n) => n.id === edge.to);
      if (fromNode && toNode) {
        const mid = worldToScreen(
          { x: (fromNode.x + fromNode.w / 2 + toNode.x + toNode.w / 2) / 2, y: (fromNode.y + fromNode.h / 2 + toNode.y + toNode.h / 2) / 2 },
          pan, zoom
        );
        editOverlay = (
          <input
            autoFocus
            defaultValue={edge.label}
            onChange={(e) => { editTextRef.current = e.target.value; }}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
              if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
            }}
            style={{
              position: "absolute",
              left: mid.x - 60,
              top: mid.y - 12,
              width: 120,
              height: 24,
              background: "var(--mc-charcoal)",
              border: `1px solid ${edge.color}`,
              color: edge.color,
              fontFamily: "Manrope, sans-serif",
              fontSize: 11,
              padding: "0 6px",
              outline: "none",
              zIndex: 20,
              textAlign: "center",
            }}
          />
        );
      }
    }
  }

  const sortedNodes = [...mindMap.nodes].sort((a, b) => a.z - b.z);

  return (
    <div
      ref={canvasRef}
      tabIndex={0}
      style={{
        flex: 1,
        minHeight: 0,
        position: "relative",
        overflow: "hidden",
        background: "var(--mc-surface-warm)",
        outline: "none",
        cursor: ia.type === "panning" ? "grabbing" : "grab",
      }}
      onWheel={handleWheel}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ display: "block" }}
        onPointerDown={onSvgPointerDown}
        onPointerMove={onSvgPointerMove}
        onPointerUp={onSvgPointerUp}
        onDoubleClick={onSvgDoubleClick}
      >
        <defs>
          <pattern
            id="mmap-dotgrid"
            width={20 * zoom}
            height={20 * zoom}
            patternUnits="userSpaceOnUse"
            x={pan.x % (20 * zoom)}
            y={pan.y % (20 * zoom)}
          >
            <circle cx={1} cy={1} r={1} fill="var(--mc-border)" opacity={0.4} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mmap-dotgrid)" style={{ pointerEvents: "none" }} />

        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {/* Marquee selection box */}
          {marqueeRect && (
            <rect
              x={marqueeRect.x}
              y={marqueeRect.y}
              width={marqueeRect.w}
              height={marqueeRect.h}
              fill="rgba(90,138,176,0.08)"
              stroke="#5a8ab0"
              strokeWidth={1 / zoom}
              strokeDasharray={`${4 / zoom} ${3 / zoom}`}
              style={{ pointerEvents: "none" }}
            />
          )}

          {/* Edges layer */}
          {mindMap.edges.map((edge) => {
            const fromNode = mindMap.nodes.find((n) => n.id === edge.from);
            const toNode = mindMap.nodes.find((n) => n.id === edge.to);
            if (!fromNode || !toNode) return null;
            return (
              <MindMapEdge
                key={edge.id}
                edge={edge}
                fromNode={fromNode}
                toNode={toNode}
                isSelected={selectedEdgeId === edge.id}
                zoom={zoom}
                onSelect={(e) => {
                  e.stopPropagation();
                  setSelectedEdgeId(edge.id);
                  setSelectedNodeIds(new Set());
                }}
                onLabelEdit={() => {
                  editTextRef.current = edge.label;
                  setEditingEdgeLabelId(edge.id);
                }}
              />
            );
          })}

          {/* Nodes layer */}
          {sortedNodes.map((node) => (
            <MindMapNode
              key={node.id}
              node={node}
              isSelected={selectedNodeIds.has(node.id)}
              isHovered={hoveredNodeId === node.id}
              isEditing={editingNodeId === node.id}
              zoom={zoom}
              onPointerDown={(e) => onNodePointerDown(node.id, e)}
              onDoubleClick={(e) => onNodeDoubleClick(node.id, e)}
              onResizeStart={(corner, e) => onResizeStart(node.id, corner, e)}
              onConnectStart={(side, e) => onConnectStart(node.id, side, e)}
              onHover={(h) => setHoveredNodeId(h ? node.id : null)}
            />
          ))}

          {/* Ghost edge while connecting */}
          {ghostEdge}
        </g>
      </svg>

      {/* Inline editor overlay */}
      {editOverlay}

      {/* Bottom selection toolbar */}
      <BottomToolbar
        selectedNodeIds={selectedNodeIds}
        selectedEdgeId={selectedEdgeId}
        nodes={mindMap.nodes}
        edges={mindMap.edges}
        onPatchNode={patchNode}
        onPatchNodes={patchNodes}
        onPatchEdge={patchEdge}
        onDeleteSelection={deleteSelection}
        onDuplicate={duplicateSelected}
        onBringToFront={bringSelectionToFront}
      />

      <MindMapMinimap
        mindMap={mindMap}
        pan={panRef.current}
        zoom={zoomRef.current}
        canvasSize={canvasSize}
        onRecenter={(p) => {
          const newPan = {
            x: canvasSize.w / 2 - p.x * zoomRef.current,
            y: canvasSize.h / 2 - p.y * zoomRef.current,
          };
          panRef.current = newPan;
          rerender();
          onMindMapChange({ ...mindMap, viewport: { x: newPan.x, y: newPan.y, zoom: zoomRef.current } });
        }}
      />
    </div>
  );
}
