
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  applyNodeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  ArrowLeft,
  RefreshCw,
  GitBranch,
  Play,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Loader2,
  Network,
  Undo2,
  Layers3,
} from "lucide-react";

const API = "http://127.0.0.1:8000";
const STORAGE_KEY = "flowmind_graph_dependencies_v1";

type Task = {
  id: number;
  title: string;
  department: string;
  assignee: string;
  priority: string;
  status: string;
  due: string;
};

type Dependency = {
  before: number;
  after: number;
};

type ScheduleItem = {
  order: number;
  id: number;
  title: string;
  priority: string;
  department: string;
};

type ScheduleResponse = {
  algorithm: string;
  total_tasks: number;
  total_dependencies: number;
  complexity: string;
  schedule: ScheduleItem[];
};

// ========================================
// CUSTOM STACK DATA STRUCTURE (LIFO)
// ========================================

class StackNode<T> {
  value: T;
  next: StackNode<T> | null;

  constructor(value: T, next: StackNode<T> | null = null) {
    this.value = value;
    this.next = next;
  }
}

class CustomStack<T> {
  private top: StackNode<T> | null = null;
  private count = 0;

  push(value: T): void {
    this.top = new StackNode(value, this.top);
    this.count++;
  }

  pop(): T | null {
    if (this.top === null) return null;

    const value = this.top.value;
    this.top = this.top.next;
    this.count--;

    return value;
  }

  size(): number {
    return this.count;
  }

  isEmpty(): boolean {
    return this.top === null;
  }

  clear(): void {
    this.top = null;
    this.count = 0;
  }
}

// ========================================
// GRAPH HELPERS
// ========================================

function priorityColor(priority: string): string {
  if (priority === "High") return "#fb7185";
  if (priority === "Medium") return "#fbbf24";
  return "#38bdf8";
}

function makeNodes(tasks: Task[]): Node[] {
  return tasks.map((task, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);

    return {
      id: String(task.id),
      position: {
        x: col * 280 + 40,
        y: row * 175 + 40,
      },
      data: {
        label: `${task.title} | ${task.priority}`,
      },
      style: {
        width: 215,
        padding: "17px 14px",
        background: "#161b2a",
        border: `1px solid ${priorityColor(task.priority)}`,
        borderRadius: 14,
        color: "#f8fafc",
        fontSize: 12,
        fontWeight: 600,
        textAlign: "center",
        boxShadow: "0 8px 25px rgba(0,0,0,0.25)",
      },
      sourcePosition: "right" as const,
      targetPosition: "left" as const,
    };
  });
}

function makeEdges(dependencies: Dependency[]): Edge[] {
  return dependencies.map((dep) => ({
    id: `edge-${dep.before}-${dep.after}`,
    source: String(dep.before),
    target: String(dep.after),
    animated: true,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: "#a78bfa",
    },
    style: {
      stroke: "#a78bfa",
      strokeWidth: 2,
    },
  }));
}

function isDependency(value: unknown): value is Dependency {
  if (typeof value !== "object" || value === null) return false;

  const item = value as Record<string, unknown>;

  return (
    typeof item.before === "number" &&
    Number.isInteger(item.before) &&
    typeof item.after === "number" &&
    Number.isInteger(item.after) &&
    item.before !== item.after
  );
}

function filterDependencies(
  dependencies: Dependency[],
  validIds: Set<number>
): Dependency[] {
  const seen = new Set<string>();

  return dependencies.filter((dep) => {
    if (!validIds.has(dep.before) || !validIds.has(dep.after)) {
      return false;
    }

    const key = `${dep.before}-${dep.after}`;

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

// ========================================
// MAIN GRAPH STUDIO PAGE
// ========================================

export default function WorkflowGraphPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [schedule, setSchedule] = useState<ScheduleResponse | null>(
    null
  );

  const [storageReady, setStorageReady] = useState(false);
  const [undoCount, setUndoCount] = useState(0);

  // Custom stack stores previous dependency states.
  const undoStack = useRef(new CustomStack<Dependency[]>());

  // Keep latest dependencies available inside callbacks.
  const dependenciesRef = useRef<Dependency[]>([]);

  const activeTasks = useMemo(
    () => tasks.filter((task) => task.status !== "Completed"),
    [tasks]
  );

  const activeIds = useMemo(
    () => new Set(activeTasks.map((task) => task.id)),
    [activeTasks]
  );

  const edges = useMemo(
    () => makeEdges(dependencies),
    [dependencies]
  );

  const taskMap = useMemo(
    () => new Map(activeTasks.map((task) => [task.id, task])),
    [activeTasks]
  );

  // ========================================
  // LOCAL STORAGE
  // ========================================

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored) {
        const parsed: unknown = JSON.parse(stored);

        if (Array.isArray(parsed)) {
          const valid = parsed.filter(isDependency);
          dependenciesRef.current = valid;
          setDependencies(valid);
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady || loading) return;

    const valid = filterDependencies(
      dependenciesRef.current,
      activeIds
    );

    dependenciesRef.current = valid;
    setDependencies(valid);
  }, [storageReady, loading, activeIds]);

  useEffect(() => {
    if (!storageReady || loading) return;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(dependencies)
    );
  }, [dependencies, storageReady, loading]);

  // ========================================
  // LOAD TASKS
  // ========================================

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API}/tasks`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load tasks from FastAPI.");
      }

      const data: Task[] = await response.json();

      const active = data.filter(
        (task) => task.status !== "Completed"
      );

      const validIds = new Set(active.map((task) => task.id));

      setTasks(data);
      setNodes(makeNodes(active));

      const valid = filterDependencies(
        dependenciesRef.current,
        validIds
      );

      dependenciesRef.current = valid;
      setDependencies(valid);

      // Old undo states might reference deleted tasks.
      undoStack.current.clear();
      setUndoCount(0);

      setSchedule(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Cannot connect to backend."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  // ========================================
  // GRAPH NODE MOVEMENT
  // ========================================

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((current) =>
        applyNodeChanges(changes, current)
      );
    },
    []
  );

  // ========================================
  // STACK: SAVE PREVIOUS STATE
  // ========================================

  function saveUndoState() {
    const snapshot = dependenciesRef.current.map((dep) => ({
      ...dep,
    }));

    undoStack.current.push(snapshot);
    setUndoCount(undoStack.current.size());
  }

  function updateDependencies(next: Dependency[]) {
    dependenciesRef.current = next;
    setDependencies(next);
    setSchedule(null);
    setError("");
  }

  // ========================================
  // ADD GRAPH DEPENDENCY
  // ========================================

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const before = Number(connection.source);
      const after = Number(connection.target);

      if (!Number.isInteger(before) || !Number.isInteger(after)) {
        setError("Invalid graph connection.");
        return;
      }

      if (before === after) {
        setError("A task cannot depend on itself.");
        return;
      }

      if (!activeIds.has(before) || !activeIds.has(after)) {
        setError("Both tasks must be active.");
        return;
      }

      const current = dependenciesRef.current;

      if (
        current.some(
          (dep) =>
            dep.before === before &&
            dep.after === after
        )
      ) {
        setError("This dependency already exists.");
        return;
      }

      const snapshot = current.map((dep) => ({ ...dep }));

      undoStack.current.push(snapshot);
      setUndoCount(undoStack.current.size());

      const next = [...current, { before, after }];

      dependenciesRef.current = next;
      setDependencies(next);
      setSchedule(null);
      setError("");
      setMessage("Dependency connected. You can Undo this action.");
    },
    [activeIds]
  );

  // ========================================
  // REMOVE DEPENDENCY
  // ========================================

  function removeDependency(index: number) {
    const current = dependenciesRef.current;

    if (index < 0 || index >= current.length) return;

    saveUndoState();

    updateDependencies(
      current.filter((_, i) => i !== index)
    );

    setMessage("Dependency removed. Undo is available.");
  }

  // ========================================
  // CLEAR ALL DEPENDENCIES
  // ========================================

  function clearDependencies() {
    if (dependenciesRef.current.length === 0) return;

    saveUndoState();
    updateDependencies([]);

    setMessage("All connections cleared. Undo can restore them.");
  }

  // ========================================
  // STACK: UNDO LAST ACTION
  // ========================================

  function undoLastAction() {
    if (undoStack.current.isEmpty()) {
      setMessage("Nothing to undo.");
      return;
    }

    const previousState = undoStack.current.pop();

    if (previousState === null) return;

    const valid = filterDependencies(previousState, activeIds);

    updateDependencies(valid);

    setUndoCount(undoStack.current.size());
    setMessage("Undo successful! Previous graph state restored.");
  }

  // ========================================
  // RUN EXISTING DSA SCHEDULER
  // ========================================

  async function runAlgorithm() {
    setRunning(true);
    setError("");
    setMessage("");
    setSchedule(null);

    try {
      const response = await fetch(`${API}/smart-schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dependencies: dependenciesRef.current,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Algorithm failed."
        );
      }

      setSchedule(data as ScheduleResponse);
      setMessage(
        "Workflow validated! A valid execution order was generated."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setRunning(false);
    }
  }

  // ========================================
  // USER INTERFACE
  // ========================================

  return (
    <div className="min-h-screen bg-[#090b10] text-slate-100">
      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-10">

        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
            >
              <ArrowLeft size={16} />
              Back to Dashboard
            </Link>

            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-violet-600 p-3">
                <Network size={24} />
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-violet-400">
                  FlowMind Intelligence
                </p>

                <h1 className="text-2xl font-bold sm:text-3xl">
                  Workflow Graph Studio
                </h1>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-400">
              Connect tasks, run graph algorithms and undo actions
              using a custom Stack data structure.
            </p>
          </div>

          <button
            onClick={() => void loadTasks()}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#151923] px-4 py-3 text-sm hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw size={16} />
            Refresh Tasks
          </button>
        </header>

        {/* STATISTICS */}

        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          {[
            ["Active Tasks", activeTasks.length],
            ["Graph Edges", dependencies.length],
            ["Scheduled", schedule?.schedule.length ?? 0],
            ["Undo Stack", undoCount],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-[#11151e] p-5"
            >
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-3 text-3xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-5 flex gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
            <AlertCircle size={18} className="shrink-0" />
            {error}
          </div>
        )}

        {/* SUCCESS MESSAGE */}

        {message && (
          <div className="mb-5 flex gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            <CheckCircle2 size={18} className="shrink-0" />
            {message}
          </div>
        )}

        {/* GRAPH SECTION */}

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#11151e]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div>
              <h2 className="font-semibold">
                Interactive Task Graph
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Drag nodes to move them. Connect the handles
                to create dependencies.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-violet-500/10 px-3 py-1.5 text-xs text-violet-300">
                Directed Graph · Adjacency List
              </span>

              <span className="rounded-lg bg-sky-500/10 px-3 py-1.5 text-xs text-sky-300">
                Stack · LIFO
              </span>
            </div>
          </div>

          <div className="h-[510px] w-full bg-[#0c1019]">
            {loading ? (
              <div className="flex h-full items-center justify-center gap-3 text-slate-400">
                <Loader2 size={20} className="animate-spin" />
                Loading tasks...
              </div>
            ) : activeTasks.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <GitBranch size={34} className="text-slate-600" />

                <p className="text-sm text-slate-300">
                  No active tasks found.
                </p>

                <p className="text-xs text-slate-500">
                  Create Pending or In Progress tasks from the dashboard.
                </p>
              </div>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onConnect={onConnect}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                colorMode="dark"
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#253047" gap={22} size={1} />
                <Controls />
                <MiniMap
                  nodeColor="#8b5cf6"
                  maskColor="rgba(0,0,0,0.6)"
                />
              </ReactFlow>
            )}
          </div>
        </section>

        {/* UNDO TOOLBAR */}

        <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sky-500/20 bg-[#111923] p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-500/10 p-3 text-sky-300">
              <Layers3 size={21} />
            </div>

            <div>
              <h2 className="font-semibold">
                Stack-Based Undo System
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                LIFO: Last In, First Out ·
                {" "}{undoCount} action{undoCount === 1 ? "" : "s"} available
              </p>
            </div>
          </div>

          <button
            onClick={undoLastAction}
            disabled={undoCount === 0 || loading}
            className="flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Undo2 size={18} />
            Undo Last Action
          </button>
        </section>

        {/* DEPENDENCIES + SCHEDULER */}

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">

          {/* DEPENDENCY LIST */}

          <section className="rounded-2xl border border-white/10 bg-[#11151e] p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-semibold">
                <GitBranch size={18} className="text-violet-400" />
                Dependency Connections
              </h2>

              <button
                onClick={clearDependencies}
                disabled={dependencies.length === 0}
                className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 disabled:opacity-40"
              >
                <Trash2 size={14} />
                Clear All
              </button>
            </div>

            {dependencies.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                No connections yet. Connect nodes in the graph above.
              </div>
            ) : (
              <div className="space-y-3">
                {dependencies.map((dep, index) => (
                  <div
                    key={`${dep.before}-${dep.after}`}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0c1019] p-3"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs">
                      {taskMap.get(dep.before)?.title ?? dep.before}
                    </span>

                    <span className="text-violet-400">→</span>

                    <span className="min-w-0 flex-1 truncate text-xs">
                      {taskMap.get(dep.after)?.title ?? dep.after}
                    </span>

                    <button
                      onClick={() => removeDependency(index)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
                      title="Remove dependency"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* SCHEDULER */}

          <section className="rounded-2xl border border-white/10 bg-[#11151e] p-6">
            <h2 className="mb-5 flex items-center gap-2 font-semibold">
              <Play size={18} className="text-emerald-400" />
              DSA Algorithm Engine
            </h2>

            <p className="mb-5 text-sm leading-6 text-slate-400">
              Run priority-aware topological sorting to validate
              dependencies, detect cycles and generate an execution plan.
            </p>

            <button
              onClick={() => void runAlgorithm()}
              disabled={running || loading || activeTasks.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3.5 text-sm font-semibold hover:bg-violet-500 disabled:opacity-40"
            >
              {running ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Play size={18} />
              )}

              {running
                ? "Running DSA Algorithm..."
                : "Validate & Generate Schedule"}
            </button>

            {schedule ? (
              <div className="mt-6">
                <p className="mb-4 text-sm font-semibold text-emerald-300">
                  Valid Execution Order
                </p>

                <div className="max-h-[320px] space-y-2 overflow-y-auto">
                  {schedule.schedule.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#0c1019] p-3"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-sm font-bold text-violet-300">
                        {task.order}
                      </span>

                      <span className="min-w-0 flex-1 truncate text-sm">
                        {task.title}
                      </span>

                      <span
                        className="text-xs font-medium"
                        style={{
                          color: priorityColor(task.priority),
                        }}
                      >
                        {task.priority}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="mt-5 text-xs text-slate-500">
                  {schedule.algorithm} · {schedule.complexity}
                </p>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                Your algorithm results will appear here.
              </div>
            )}
          </section>
        </div>

        <footer className="py-8 text-center text-xs text-slate-600">
          FlowMind · Smart Workflow & Task Optimization System
        </footer>
      </div>
    </div>
  );
}
