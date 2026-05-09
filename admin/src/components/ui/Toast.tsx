"use client";

import { useState, useEffect } from "react";

type ToastType = "success" | "error";
type ToastItem = { id: number; message: string; type: ToastType };

let listeners: Array<(items: ToastItem[]) => void> = [];
let items: ToastItem[] = [];
let nextId = 0;

function emit() {
  listeners.forEach((l) => l([...items]));
}

function add(message: string, type: ToastType, durationMs: number) {
  const id = nextId++;
  items = [...items, { id, message, type }];
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, durationMs);
}

export const toast = {
  success: (message: string) => add(message, "success", 2500),
  error: (message: string) => add(message, "error", 3500),
};

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.push(setToasts);
    return () => {
      listeners = listeners.filter((l) => l !== setToasts);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: t.type === "error" ? "var(--mc-error)" : "var(--mc-charcoal)",
            color: t.type === "error" ? "#fff" : "var(--mc-cream)",
            border: `1px solid ${t.type === "error" ? "transparent" : "var(--mc-border-warm)"}`,
            padding: "10px 16px",
            fontSize: 13,
            fontFamily: "Manrope, sans-serif",
            fontWeight: 500,
            boxShadow: "var(--mc-shadow-lg)",
            whiteSpace: "nowrap",
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
