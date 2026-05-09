import { useCallback, useRef, useState } from 'react';
import type { MindMap } from '../../lib/types';

const MAX_HISTORY = 100;

function clone(m: MindMap): MindMap {
  return {
    nodes: m.nodes.map((n) => ({ ...n })),
    edges: m.edges.map((e) => ({ ...e })),
    viewport: { ...m.viewport },
  };
}

export function useMindMapHistory() {
  const past = useRef<MindMap[]>([]);
  const future = useRef<MindMap[]>([]);
  const [version, setVersion] = useState(0);
  const tick = useCallback(() => setVersion((v) => v + 1), []);

  const pushHistory = useCallback((snapshot: MindMap) => {
    past.current.push(clone(snapshot));
    if (past.current.length > MAX_HISTORY) past.current.shift();
    future.current = [];
    tick();
  }, [tick]);

  const undo = useCallback((current: MindMap): MindMap | null => {
    const prev = past.current.pop();
    if (!prev) return null;
    future.current.push(clone(current));
    tick();
    return prev;
  }, [tick]);

  const redo = useCallback((current: MindMap): MindMap | null => {
    const next = future.current.pop();
    if (!next) return null;
    past.current.push(clone(current));
    tick();
    return next;
  }, [tick]);

  const reset = useCallback(() => {
    past.current = [];
    future.current = [];
    tick();
  }, [tick]);

  return {
    pushHistory,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    version,
  };
}
