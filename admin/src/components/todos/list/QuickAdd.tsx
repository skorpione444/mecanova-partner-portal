"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

interface Props {
  onAdd: (title: string) => void;
  placeholder?: string;
  paddingLeft?: number;
}

export default function QuickAdd({ onAdd, placeholder = "New task…", paddingLeft = 32 }: Props) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed) { onAdd(trimmed); setValue(""); }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: `6px 16px 6px ${paddingLeft}px`,
        borderBottom: "1px solid var(--mc-border-light)",
      }}
    >
      <Plus size={13} style={{ color: "var(--mc-text-muted)", flexShrink: 0 }} />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } if (e.key === "Escape") { setValue(""); (e.target as HTMLInputElement).blur(); }}}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); }}
        placeholder={placeholder}
        style={{
          flex: 1,
          background: "none",
          border: "none",
          outline: "none",
          fontSize: 13,
          color: "var(--mc-text-secondary)",
          padding: 0,
        }}
      />
      {focused && value.trim() && (
        <button
          onMouseDown={(e) => { e.preventDefault(); submit(); }}
          style={{
            padding: "3px 10px",
            fontSize: 11,
            background: "var(--mc-cream)",
            color: "var(--mc-text-inverse)",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Add
        </button>
      )}
    </div>
  );
}
