import type { Priority } from './types';

// Color palette drawn from existing --mc-* tokens (hex values only, no CSS vars,
// so they work in SVG and as border/background inline styles)
export const COLOR_PALETTE = [
  { label: 'Muted',   value: '#7D7468' },
  { label: 'Info',    value: '#5a8ab0' },
  { label: 'Error',   value: '#c45a5a' },
  { label: 'Success', value: '#6b8f6e' },
  { label: 'Warning', value: '#c4a35a' },
  { label: 'Cream',   value: '#ecdfcc' },
  { label: 'Stone',   value: '#A89F91' },
];

export const DEFAULT_STATUSES = [
  { slug: 'open',        name: 'Open',        color: '#7D7468', is_terminal: false, order_index: 0 },
  { slug: 'in-progress', name: 'In Progress', color: '#5a8ab0', is_terminal: false, order_index: 1 },
  { slug: 'blocked',     name: 'Blocked',     color: '#c45a5a', is_terminal: false, order_index: 2 },
  { slug: 'done',        name: 'Done',        color: '#6b8f6e', is_terminal: true,  order_index: 3 },
  { slug: 'cancelled',   name: 'Cancelled',   color: '#7D7468', is_terminal: true,  order_index: 4 },
] as const;

export const WORKSPACE_ICONS = [
  '📁','🏗️','📦','🧪','🏭','🛠️','🚧','💡','🧱','🏢',
  '🚚','📋','📊','📈','💼','🔧','⚡','🌍','🔬','🧰',
  '📐','🏷️','💰','📝','🎯','🗂️','🔍','🧭',
];

export const PRIORITY_LABELS: Record<Priority, string> = {
  low:    'Low',
  medium: 'Medium',
  high:   'High',
  urgent: 'Urgent',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low:    '#7D7468',
  medium: '#A89F91',
  high:   '#c4a35a',
  urgent: '#c45a5a',
};

/** Hex color with 12% opacity for status chip backgrounds */
export function colorBg(hex: string): string {
  // Convert hex to rgba at low opacity
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},0.12)`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date(new Date().toDateString());
}
