export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type ViewType = 'list' | 'kanban' | 'mmap';

export interface Workspace {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Status {
  id: string;
  workspace_id: string;
  slug: string;
  name: string;
  color: string;
  is_terminal: boolean;
  order_index: number;
}

export interface Task {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  title: string;
  description: string;
  notes: string;
  context: string;
  status_id: string | null;
  priority: Priority;
  start_date: string | null;
  due_date: string | null;
  tags: string[];
  assignee: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface StatusTemplate {
  id: string;
  name: string;
  statuses: Omit<Status, 'id' | 'workspace_id'>[];
  created_at: string;
}

export type MmapShape = 'rect' | 'rounded' | 'circle' | 'diamond' | 'sticky';
export type MmapSide = 'n' | 'e' | 's' | 'w';

export interface MmapNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  shape: MmapShape;
  fill: string;
  border: string;
  borderStyle: 'solid' | 'dashed' | 'dotted';
  textColor: string;
  fontSize: 12 | 14 | 18 | 24;
  textAlign: 'left' | 'center' | 'right';
  textVAlign: 'top' | 'middle' | 'bottom';
  z: number;
}

export interface MmapEdge {
  id: string;
  from: string;
  to: string;
  fromSide: MmapSide;
  toSide: MmapSide;
  label: string;
  color: string;
  width: 1 | 2 | 3 | 4;
  arrow: 'none' | 'end' | 'start' | 'both';
  style?: 'curved' | 'straight';
}

export interface MindMap {
  nodes: MmapNode[];
  edges: MmapEdge[];
  viewport: { x: number; y: number; zoom: number };
}

export interface FilterState {
  search: string;
  statusId: string;
  priority: string;
  tag: string;
  assignee: string;
  overdue: boolean;
  dueFrom: string;
  dueTo: string;
}

export const EMPTY_FILTERS: FilterState = {
  search: "",
  statusId: "",
  priority: "",
  tag: "",
  assignee: "",
  overdue: false,
  dueFrom: "",
  dueTo: "",
};
