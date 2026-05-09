"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Undo2, Redo2, Minus, Maximize2, Minimize2, HelpCircle } from "lucide-react";
import type { MindMap, MmapNode } from "../lib/types";
import { COLOR_PALETTE } from "../lib/statuses";
import { nodesBoundingBox } from "./lib/geometry";
import { useMindMapHistory } from "./lib/history";
import MindMapCanvas from "./MindMapCanvas";

interface Props {
  workspaceId: string;
  mindMap: MindMap;
  onMindMapChange: (mm: MindMap) => void;
}

const DEFAULT_NODE: Omit<MmapNode, "id" | "x" | "y"> = {
  w: 160,
  h: 60,
  text: "",
  shape: "rounded",
  fill: COLOR_PALETTE[1].value,
  border: COLOR_PALETTE[6].value,
  borderStyle: "solid",
  textColor: "#ecdfcc",
  fontSize: 14,
  textAlign: "center",
  textVAlign: "middle",
  z: 0,
};

const SHORTCUTS = [
  { keys: ["Double-click"],              action: "New box / edit text" },
  { keys: ["Cmd", "Click"],             action: "Multi-select (also Shift+Click)" },
  { keys: ["Delete"],                    action: "Delete selection" },
  { keys: ["Ctrl", "D"],                action: "Duplicate" },
  { keys: ["Ctrl", "Z"],                action: "Undo" },
  { keys: ["Shift", "Z"],               action: "Redo" },
  { keys: ["Ctrl", "A"],                action: "Select all" },
  { keys: ["↑ ↓ ← →"],                  action: "Nudge (+Shift: 10 px)" },
  { keys: ["Enter"],                     action: "Edit text" },
  { keys: ["Tab"],                       action: "New connected box to the right" },
  { keys: ["Scroll"],                    action: "Zoom at cursor" },
  { keys: ["Drag background"],           action: "Pan canvas" },
  { keys: ["Shift", "Drag"],            action: "Marquee select" },
  { keys: ["Alt", "Drag"],              action: "Disable grid snap" },
];

export default function MindMapView({ mindMap, onMindMapChange }: Props) {
  const { pushHistory, undo, redo, canUndo, canRedo } = useMindMapHistory();
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [, forceRender] = useState(0);
  const rerender = useCallback(() => forceRender((v) => v + 1), []);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync viewport
  const _panRef = useRef({ x: mindMap.viewport.x, y: mindMap.viewport.y });
  const _zoomRef = useRef(mindMap.viewport.zoom);
  useEffect(() => {
    _panRef.current = { x: mindMap.viewport.x, y: mindMap.viewport.y };
    _zoomRef.current = mindMap.viewport.zoom;
    rerender();
  }, [mindMap.viewport, rerender]);

  // Undo/redo + ? shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "z" && !e.shiftKey) { e.preventDefault(); const prev = undo(mindMap); if (prev) onMindMapChange(prev); return; }
      if (meta && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); const next = redo(mindMap); if (next) onMindMapChange(next); return; }
      if (e.key === "?") { e.preventDefault(); setShowShortcuts((v) => !v); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mindMap, onMindMapChange, undo, redo]);

  // Fullscreen detection
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Auto-fit on initial mount when nodes exist
  const didInitialFit = useRef(false);
  useEffect(() => {
    if (didInitialFit.current) return;
    if (mindMap.nodes.length === 0) return;
    const id = requestAnimationFrame(() => {
      handleFit();
      didInitialFit.current = true;
    });
    return () => cancelAnimationFrame(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mindMap.nodes.length]);

  function handleAddNode() {
    const vp = mindMap.viewport;
    const el = document.getElementById("mmap-canvas-root");
    const cw = el?.clientWidth ?? 800;
    const ch = el?.clientHeight ?? 600;
    const centerWorld = {
      x: (cw / 2 - vp.x) / vp.zoom - DEFAULT_NODE.w / 2,
      y: (ch / 2 - vp.y) / vp.zoom - DEFAULT_NODE.h / 2,
    };
    const newNode: MmapNode = { ...DEFAULT_NODE, id: crypto.randomUUID(), x: centerWorld.x, y: centerWorld.y, z: mindMap.nodes.length };
    pushHistory(mindMap);
    onMindMapChange({ ...mindMap, nodes: [...mindMap.nodes, newNode] });
    setSelectedNodeIds(new Set([newNode.id]));
  }

  function handleFit() {
    const box = nodesBoundingBox(mindMap.nodes);
    const el = document.getElementById("mmap-canvas-root");
    if (!el) return;
    const { clientWidth: cw, clientHeight: ch } = el;
    if (!box) { onMindMapChange({ ...mindMap, viewport: { x: 0, y: 0, zoom: 1 } }); return; }
    const pad = 80;
    const zoom = Math.min(3, Math.max(0.25, Math.min((cw - pad * 2) / box.w, (ch - pad * 2) / box.h)));
    onMindMapChange({ ...mindMap, viewport: { x: (cw - box.w * zoom) / 2 - box.x * zoom, y: (ch - box.h * zoom) / 2 - box.y * zoom, zoom } });
  }

  function zoomAround(factor: number) {
    const vp = mindMap.viewport;
    const el = document.getElementById("mmap-canvas-root");
    if (!el) return;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    const wx = (cx - vp.x) / vp.zoom;
    const wy = (cy - vp.y) / vp.zoom;
    const newZoom = Math.min(3, Math.max(0.25, vp.zoom * factor));
    onMindMapChange({ ...mindMap, viewport: { x: cx - wx * newZoom, y: cy - wy * newZoom, zoom: newZoom } });
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  }

  const zoomPct = Math.round(mindMap.viewport.zoom * 100);

  const btn: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "0 9px", height: 30, minWidth: 30,
    fontSize: 12, fontFamily: "Manrope, sans-serif",
    background: "var(--mc-surface-elevated)",
    color: "var(--mc-text-secondary)",
    border: "none", borderRight: "1px solid var(--mc-border)",
    cursor: "pointer", outline: "none", flexShrink: 0,
  };

  const keyChip: React.CSSProperties = {
    display: "inline-flex", alignItems: "center",
    padding: "1px 6px", fontSize: 10, fontFamily: "Manrope, sans-serif",
    background: "var(--mc-surface-elevated)",
    color: "var(--mc-text-secondary)",
    border: "1px solid var(--mc-border)",
    whiteSpace: "nowrap",
  };

  return (
    <div
      ref={containerRef}
      id="mmap-canvas-root"
      style={{ flex: 1, minHeight: 0, position: "relative", display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      <MindMapCanvas
        mindMap={mindMap}
        onMindMapChange={onMindMapChange}
        pushHistory={pushHistory}
        selectedNodeIds={selectedNodeIds}
        selectedEdgeId={selectedEdgeId}
        setSelectedNodeIds={setSelectedNodeIds}
        setSelectedEdgeId={setSelectedEdgeId}
      />

      {/* ── Top-left toolbar ── */}
      <div
        style={{
          position: "absolute", top: 12, left: 12,
          display: "flex", alignItems: "center",
          border: "1px solid var(--mc-border)",
          background: "var(--mc-surface-elevated)",
          zIndex: 10, overflow: "hidden",
        }}
      >
        {/* + Box */}
        <button
          onClick={handleAddNode}
          style={{ ...btn, background: "var(--mc-cream)", color: "var(--mc-charcoal, #1a1a18)", gap: 5, paddingLeft: 10, paddingRight: 10 }}
          title="Add box"
        >
          <Plus size={13} strokeWidth={2.5} />
          Box
        </button>

        {/* Undo / Redo */}
        <button onClick={() => { const prev = undo(mindMap); if (prev) onMindMapChange(prev); }} disabled={!canUndo} title="Undo (⌘Z)" style={{ ...btn, opacity: canUndo ? 1 : 0.3 }}>
          <Undo2 size={13} />
        </button>
        <button onClick={() => { const next = redo(mindMap); if (next) onMindMapChange(next); }} disabled={!canRedo} title="Redo (⌘⇧Z)" style={{ ...btn, opacity: canRedo ? 1 : 0.3 }}>
          <Redo2 size={13} />
        </button>

        {/* Zoom */}
        <button onClick={() => zoomAround(1 / 1.2)} style={btn} title="Zoom out"><Minus size={13} /></button>
        <button onClick={() => zoomAround(1 / mindMap.viewport.zoom)} style={{ ...btn, minWidth: 52, fontSize: 11 }} title="Reset zoom (100%)">
          {zoomPct} %
        </button>
        <button onClick={() => zoomAround(1.2)} style={btn} title="Zoom in">+</button>
        <button onClick={handleFit} style={{ ...btn, fontSize: 11, paddingLeft: 10, paddingRight: 10 }} title="Fit all to view">Fit</button>

        {/* Fullscreen */}
        <button onClick={toggleFullscreen} style={{ ...btn, borderRight: "none" }} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
          {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>

      {/* ── Top-right ? button ── */}
      <button
        onClick={() => setShowShortcuts((v) => !v)}
        title="Keyboard shortcuts (?)"
        style={{
          position: "absolute", top: 12, right: 12,
          width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
          background: showShortcuts ? "var(--mc-surface-elevated)" : "var(--mc-surface)",
          border: "1px solid var(--mc-border)",
          color: "var(--mc-text-secondary)",
          cursor: "pointer", outline: "none", zIndex: 11,
        }}
      >
        <HelpCircle size={15} />
      </button>

      {/* ── Keyboard shortcuts overlay ── */}
      {showShortcuts && (
        <>
          <div onClick={() => setShowShortcuts(false)} style={{ position: "fixed", inset: 0, zIndex: 9 }} />
          <div
            style={{
              position: "absolute", top: 48, right: 12,
              width: 340, zIndex: 12,
              background: "var(--mc-surface)",
              border: "1px solid var(--mc-border)",
              boxShadow: "var(--mc-shadow-lg, 0 8px 24px rgba(0,0,0,0.5))",
              padding: "12px 0",
              fontFamily: "Manrope, sans-serif",
            }}
          >
            <div style={{ padding: "0 16px 10px", fontSize: 12, fontWeight: 700, color: "var(--mc-text-primary)", letterSpacing: "0.02em" }}>
              Keyboard Shortcuts
            </div>
            {SHORTCUTS.map(({ keys, action }) => (
              <div key={action} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 16px", gap: 12 }}>
                <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                  {keys.map((k, i) => (
                    <span key={i}>
                      {i > 0 && keys.length > 1 && <span style={{ fontSize: 10, color: "var(--mc-text-muted)", margin: "0 2px" }}>+</span>}
                      <span style={keyChip}>{k}</span>
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: 11, color: "var(--mc-text-muted)", textAlign: "right" }}>{action}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
