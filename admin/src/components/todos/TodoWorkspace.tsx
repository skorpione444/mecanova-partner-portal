"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WorkspaceTabs from "./WorkspaceTabs";
import WorkspaceHeader from "./WorkspaceHeader";
import Toolbar from "./Toolbar";
import ListView from "./list/ListView";
import KanbanView from "./kanban/KanbanView";
import MindMapView from "./mindmap/MindMapView";
import TaskDrawer from "./TaskDrawer";
import WorkspaceSettingsModal from "./WorkspaceSettingsModal";
import EditStatusesModal from "./EditStatusesModal";
import NewWorkspaceModal from "./NewWorkspaceModal";
import type { Workspace, Status, Task, MindMap, ViewType, FilterState } from "./lib/types";
import { EMPTY_FILTERS } from "./lib/types";
import {
  fetchWorkspaces,
  createWorkspace,
  fetchStatuses,
  seedStatuses,
  fetchTasks,
  createTask,
  updateTask,
  fetchMindMap,
  saveMindMap,
  fetchStatusTemplates,
} from "./lib/queries";
import type { StatusTemplate } from "./lib/types";
import { toast } from "@/components/ui/Toast";

const DEFAULT_WORKSPACE: Partial<Workspace> = {
  name: "Inbox",
  description: "",
  icon: "📋",
  color: "#ecdfcc",
};

export default function TodoWorkspace() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>("");
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [mindMap, setMindMap] = useState<MindMap>({
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  });
  const [view, setView] = useState<ViewType>("list");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [openSubtaskId, setOpenSubtaskId] = useState<string | null>(null);
  const [settingsWorkspace, setSettingsWorkspace] = useState<Workspace | null>(null);
  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState(false);
  const [editStatusesOpen, setEditStatusesOpen] = useState(false);
  const [templates, setTemplates] = useState<StatusTemplate[]>([]);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ taskId: string; statusId: string; unfinishedCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const mindMapDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── URL sync ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wsId = params.get("workspace");
    const v = params.get("view") as ViewType | null;
    const tId = params.get("task");
    if (v && ["list", "kanban", "mmap"].includes(v)) setView(v);
    if (tId) setSelectedTaskId(tId);
    if (wsId) setActiveWorkspaceId(wsId);
    const q = params.get("q");
    const status = params.get("status");
    const prio = params.get("prio");
    const tag = params.get("tag");
    const assignee = params.get("assignee");
    const overdue = params.get("overdue");
    const from = params.get("from");
    const to = params.get("to");
    if (q || status || prio || tag || assignee || overdue || from || to) {
      setFilters((prev) => ({
        ...prev,
        ...(q ? { search: q } : {}),
        ...(status ? { statusId: status } : {}),
        ...(prio ? { priority: prio } : {}),
        ...(tag ? { tag } : {}),
        ...(assignee ? { assignee } : {}),
        ...(overdue === "1" ? { overdue: true } : {}),
        ...(from ? { dueFrom: from } : {}),
        ...(to ? { dueTo: to } : {}),
      }));
    }
  }, []);

  const syncUrl = useCallback(
    (wsId: string, v: ViewType, tId: string | null, f: FilterState) => {
      const params = new URLSearchParams();
      if (wsId) params.set("workspace", wsId);
      params.set("view", v);
      if (tId) params.set("task", tId);
      if (f.search) params.set("q", f.search);
      if (f.statusId) params.set("status", f.statusId);
      if (f.priority) params.set("prio", f.priority);
      if (f.tag) params.set("tag", f.tag);
      if (f.assignee) params.set("assignee", f.assignee);
      if (f.overdue) params.set("overdue", "1");
      if (f.dueFrom) params.set("from", f.dueFrom);
      if (f.dueTo) params.set("to", f.dueTo);
      history.replaceState(null, "", `?${params.toString()}`);
    },
    []
  );

  useEffect(() => {
    syncUrl(activeWorkspaceId, view, selectedTaskId, filters);
  }, [activeWorkspaceId, view, selectedTaskId, filters, syncUrl]);

  // ── Load workspaces on mount ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let wsList = await fetchWorkspaces();
        if (wsList.length === 0) {
          const ws = await createWorkspace(DEFAULT_WORKSPACE);
          await seedStatuses(ws.id);
          wsList = [ws];
        }
        setWorkspaces(wsList);
        setActiveWorkspaceId((prev) => prev || wsList[0].id);
      } catch (err) {
        console.error("Failed to load workspaces", err);
        setDbError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refetchWorkspaceData = useCallback(async () => {
    if (!activeWorkspaceId) return;
    try {
      const [ss, ts, tmpl] = await Promise.all([
        fetchStatuses(activeWorkspaceId),
        fetchTasks(activeWorkspaceId),
        fetchStatusTemplates(),
      ]);
      setStatuses(ss);
      setTasks(ts);
      setTemplates(tmpl);
    } catch (err) {
      console.error("Failed to load workspace data", err);
    }
  }, [activeWorkspaceId]);

  // ── Load workspace data when active workspace changes ─────────────────────
  useEffect(() => {
    if (!activeWorkspaceId) return;
    (async () => {
      try {
        const [ss, ts, mm, tmpl] = await Promise.all([
          fetchStatuses(activeWorkspaceId),
          fetchTasks(activeWorkspaceId),
          fetchMindMap(activeWorkspaceId),
          fetchStatusTemplates(),
        ]);
        setStatuses(ss);
        setTasks(ts);
        setMindMap(mm);
        setTemplates(tmpl);
      } catch (err) {
        console.error("Failed to load workspace data", err);
      }
    })();
  }, [activeWorkspaceId]);

  // ── Workspace actions ─────────────────────────────────────────────────────
  const handleCreateWorkspace = () => {
    setShowNewWorkspaceModal(true);
  };

  const handleNewWorkspaceSubmit = async (
    name: string,
    icon: string,
    color: string,
    templateStatuses: Omit<import("./lib/types").Status, "id" | "workspace_id">[] | null
  ) => {
    setShowNewWorkspaceModal(false);
    try {
      const ws = await createWorkspace({ name, icon, color, description: "" });
      let ss: import("./lib/types").Status[];
      if (templateStatuses) {
        const { saveStatuses: saveSts, fetchStatuses: fetchSts } = await import("./lib/queries");
        const withIds = templateStatuses.map((s) => ({ ...s, id: crypto.randomUUID() }));
        await saveSts(ws.id, withIds);
        ss = await fetchSts(ws.id);
      } else {
        ss = await seedStatuses(ws.id);
      }
      setWorkspaces((prev) => [...prev, ws]);
      setActiveWorkspaceId(ws.id);
      setStatuses(ss);
      setTasks([]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleWorkspaceUpdated = (updated: Workspace) => {
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === updated.id ? updated : w))
    );
    if (settingsWorkspace?.id === updated.id) setSettingsWorkspace(updated);
  };

  const handleWorkspaceDeleted = (id: string) => {
    const remaining = workspaces.filter((w) => w.id !== id);
    setWorkspaces(remaining);
    setSettingsWorkspace(null);
    if (activeWorkspaceId === id) {
      setActiveWorkspaceId(remaining[0]?.id ?? "");
    }
  };

  // ── Task actions ──────────────────────────────────────────────────────────
  const handleNewTask = async () => {
    const firstStatus = statuses[0];
    if (!firstStatus || !activeWorkspaceId) return;
    try {
      const task = await createTask({
        workspace_id: activeWorkspaceId,
        parent_id: null,
        title: "Untitled task",
        description: "",
        notes: "",
        context: "",
        status_id: firstStatus.id,
        priority: "medium",
        tags: [],
        assignee: "",
        start_date: null,
        due_date: null,
        order_index: tasks.filter((t) => !t.parent_id).length,
      });
      setTasks((prev) => [...prev, task]);
      setSelectedTaskId(task.id);
      setOpenSubtaskId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickAdd = async (title: string, statusId: string) => {
    if (!activeWorkspaceId) return;
    try {
      const task = await createTask({
        workspace_id: activeWorkspaceId,
        parent_id: null,
        title,
        description: "",
        notes: "",
        context: "",
        status_id: statusId,
        priority: "medium",
        tags: [],
        assignee: "",
        start_date: null,
        due_date: null,
        order_index: tasks.filter(
          (t) => !t.parent_id && t.status_id === statusId
        ).length,
      });
      setTasks((prev) => [...prev, task]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheckTask = async (task: Task) => {
    const doneStatus =
      statuses.find((s) => s.is_terminal) ?? statuses[statuses.length - 1];
    if (!doneStatus || task.status_id === doneStatus.id) return;
    try {
      await updateTask(task.id, { status_id: doneStatus.id });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status_id: doneStatus.id } : t
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleTaskUpdated = (updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handlePatchTask = (taskId: string, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
    updateTask(taskId, patch).catch((err) => console.error(err));
  };

  const handleTaskDeleted = (id: string) => {
    setTasks((prev) =>
      prev.filter((t) => t.id !== id && t.parent_id !== id)
    );
    setSelectedTaskId(null);
    setOpenSubtaskId(null);
  };

  const handleSubtaskCreated = (subtask: Task) => {
    setTasks((prev) => [...prev, subtask]);
  };

  const handleAddSubtask = async (parentId: string, title: string) => {
    const parent = tasks.find((t) => t.id === parentId);
    if (!parent) return;
    try {
      const sub = await createTask({
        workspace_id: parent.workspace_id,
        parent_id: parentId,
        title,
        description: "",
        notes: "",
        context: "",
        status_id: parent.status_id,
        priority: "medium",
        tags: [],
        assignee: "",
        start_date: null,
        due_date: null,
        order_index: tasks.filter((t) => t.parent_id === parentId).length,
      });
      setTasks((prev) => [...prev, sub]);
    } catch (err) {
      console.error(err);
    }
  };

  const applyStatusChange = (taskId: string, statusId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status_id: statusId } : t))
    );
    updateTask(taskId, { status_id: statusId })
      .then(() => toast.success("Status updated"))
      .catch((err) => {
        console.error(err);
        toast.error("Failed to update status");
      });
  };

  const handleChangeStatus = (taskId: string, statusId: string) => {
    const newStatus = statuses.find((s) => s.id === statusId);
    if (newStatus?.is_terminal) {
      const unfinishedCount = tasks.filter((t) => {
        if (t.parent_id !== taskId) return false;
        const subStatus = statuses.find((s) => s.id === t.status_id);
        return !subStatus?.is_terminal;
      }).length;
      if (unfinishedCount > 0) {
        setPendingStatusChange({ taskId, statusId, unfinishedCount });
        return;
      }
    }
    applyStatusChange(taskId, statusId);
  };

  const handleReorder = async (
    taskId: string,
    newStatusId: string,
    newIndex: number,
    _allIds: string[]
  ) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === taskId);
      if (!task) return prev;
      const sameGroup = prev
        .filter(
          (t) => t.status_id === newStatusId && t.id !== taskId && !t.parent_id
        )
        .sort((a, b) => a.order_index - b.order_index);
      const before = sameGroup[newIndex - 1]?.order_index ?? 0;
      const after = sameGroup[newIndex]?.order_index ?? before + 2;
      const newOrderIndex = (before + after) / 2;
      const updated = {
        ...task,
        status_id: newStatusId,
        order_index: newOrderIndex,
      };
      updateTask(taskId, {
        status_id: newStatusId,
        order_index: newOrderIndex,
      }).catch(console.error);
      return prev.map((t) => (t.id === taskId ? updated : t));
    });
  };

  // ── Mind map autosave ─────────────────────────────────────────────────────
  const handleMindMapChange = (mm: MindMap) => {
    setMindMap(mm);
    if (mindMapDebounce.current) clearTimeout(mindMapDebounce.current);
    mindMapDebounce.current = setTimeout(() => {
      saveMindMap(activeWorkspaceId, mm).catch(console.error);
    }, 600);
  };

  // ── Derived filter options ────────────────────────────────────────────────
  const availableTags = useMemo(
    () => [...new Set(tasks.flatMap((t) => t.tags))].sort(),
    [tasks]
  );
  const availableAssignees = useMemo(
    () => [...new Set(tasks.map((t) => t.assignee).filter(Boolean))].sort(),
    [tasks]
  );

  // ── Render ────────────────────────────────────────────────────────────────
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const drawerTaskId = openSubtaskId ?? selectedTaskId;
  const selectedTask = drawerTaskId
    ? tasks.find((t) => t.id === drawerTaskId) ?? null
    : null;
  const parentTask =
    selectedTask?.parent_id
      ? tasks.find((t) => t.id === selectedTask.parent_id) ?? null
      : null;

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--mc-text-muted)",
          fontSize: 14,
        }}
      >
        Loading…
      </div>
    );
  }

  if (dbError) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: 12,
          color: "var(--mc-text-muted)",
          padding: 40,
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, fontSize: 14, color: "var(--mc-text-secondary)" }}>
          Database tables not found
        </p>
        <p style={{ margin: 0, fontSize: 12 }}>
          Run{" "}
          <code
            style={{
              padding: "2px 7px",
              background: "var(--mc-graphite)",
              color: "var(--mc-cream)",
            }}
          >
            npm run sb:push
          </code>{" "}
          in the project root to apply the migration.
        </p>
      </div>
    );
  }

  if (!activeWorkspace) return null;

  return (
    <div
      className="mc-fullheight-page"
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--mc-charcoal)",
        overflow: "hidden",
      }}
    >
      <WorkspaceTabs
        workspaces={workspaces}
        activeId={activeWorkspaceId}
        onSwitch={(id) => {
          setActiveWorkspaceId(id);
          setSelectedTaskId(null);
          setOpenSubtaskId(null);
          setFilters(EMPTY_FILTERS);
        }}
        onOpenSettings={(ws) => setSettingsWorkspace(ws)}
        onCreateWorkspace={handleCreateWorkspace}
      />

      <WorkspaceHeader workspace={activeWorkspace} />

      <Toolbar
        view={view}
        onViewChange={setView}
        filters={filters}
        onFiltersChange={setFilters}
        statuses={statuses}
        onNewTask={handleNewTask}
        onEditStatuses={() => setEditStatusesOpen(true)}
        availableTags={availableTags}
        availableAssignees={availableAssignees}
      />

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {view === "list" && (
          <ListView
            tasks={tasks}
            statuses={statuses}
            filters={filters}
            selectedTaskId={drawerTaskId}
            onSelectTask={(id) => {
              setSelectedTaskId(id);
              setOpenSubtaskId(null);
            }}
            onCheckTask={handleCheckTask}
            onQuickAdd={handleQuickAdd}
            onReorder={handleReorder}
            onChangeStatus={handleChangeStatus}
            onAddSubtask={handleAddSubtask}
            onPatchTask={handlePatchTask}
          />
        )}
        {view === "kanban" && (
          <KanbanView
            tasks={tasks}
            statuses={statuses}
            filters={filters}
            workspaceColor={activeWorkspace.color}
            selectedTaskId={selectedTaskId}
            onSelectTask={(id) => {
              setSelectedTaskId(id);
              setOpenSubtaskId(null);
            }}
            onCheckTask={handleCheckTask}
            onQuickAdd={handleQuickAdd}
            onReorder={handleReorder}
          />
        )}
        {view === "mmap" && (
          <MindMapView
            workspaceId={activeWorkspaceId}
            mindMap={mindMap}
            onMindMapChange={handleMindMapChange}
          />
        )}
      </div>

      {selectedTask && (
        <TaskDrawer
          task={selectedTask}
          parentTask={parentTask}
          statuses={statuses}
          allTasks={tasks}
          onClose={() => {
            setSelectedTaskId(null);
            setOpenSubtaskId(null);
          }}
          onTaskUpdated={handleTaskUpdated}
          onTaskDeleted={handleTaskDeleted}
          onOpenSubtask={(id) => setOpenSubtaskId(id)}
          onSubtaskCreated={handleSubtaskCreated}
        />
      )}

      {editStatusesOpen && activeWorkspaceId && (
        <EditStatusesModal
          workspaceId={activeWorkspaceId}
          statuses={statuses}
          tasks={tasks}
          templates={templates}
          onClose={() => setEditStatusesOpen(false)}
          onSaved={async () => {
            setEditStatusesOpen(false);
            await refetchWorkspaceData();
          }}
          onTemplatesChanged={setTemplates}
        />
      )}

      {settingsWorkspace && (
        <WorkspaceSettingsModal
          workspace={settingsWorkspace}
          statuses={
            settingsWorkspace.id === activeWorkspaceId ? statuses : []
          }
          onClose={() => setSettingsWorkspace(null)}
          onWorkspaceUpdated={handleWorkspaceUpdated}
          onWorkspaceDeleted={handleWorkspaceDeleted}
          onStatusesUpdated={(ss) => {
            setStatuses(ss);
            setSettingsWorkspace(null);
          }}
        />
      )}

      {showNewWorkspaceModal && (
        <NewWorkspaceModal
          onClose={() => setShowNewWorkspaceModal(false)}
          onSubmit={handleNewWorkspaceSubmit}
        />
      )}

      {pendingStatusChange && (() => {
        const targetStatus = statuses.find((s) => s.id === pendingStatusChange.statusId);
        const n = pendingStatusChange.unfinishedCount;
        return (
          <>
            <div onClick={() => setPendingStatusChange(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 49 }} />
            <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(420px, 94vw)", background: "var(--mc-surface)", border: "1px solid var(--mc-border)", boxShadow: "var(--mc-shadow-lg)", zIndex: 50, padding: "24px" }}>
              <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600, color: "var(--mc-text-primary)", fontFamily: "var(--font-jost), Jost, sans-serif" }}>
                Unfinished subtasks
              </p>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--mc-text-secondary)", lineHeight: 1.5 }}>
                This task has <strong>{n} unfinished subtask{n !== 1 ? "s" : ""}</strong>. Moving it to <strong>{targetStatus?.name ?? "this status"}</strong> will hide it from the list view while those subtasks remain open.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setPendingStatusChange(null)}
                  style={{ padding: "7px 16px", fontSize: 12, background: "none", border: "1px solid var(--mc-border)", color: "var(--mc-text-secondary)", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => { applyStatusChange(pendingStatusChange.taskId, pendingStatusChange.statusId); setPendingStatusChange(null); }}
                  style={{ padding: "7px 18px", fontSize: 12, fontWeight: 600, background: "var(--mc-cream)", color: "var(--mc-text-inverse)", border: "none", cursor: "pointer" }}
                >
                  Change status anyway
                </button>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
