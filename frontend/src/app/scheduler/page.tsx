
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  GitBranch,
  Loader2,
  Network,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  AlertCircle,
  Zap,
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

type ScheduleResult = {
  algorithm: string;
  total_tasks: number;
  total_dependencies: number;
  complexity: string;
  schedule: ScheduleItem[];
};

function readDependencies(): Dependency[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is Dependency =>
        typeof item === "object" &&
        item !== null &&
        Number.isInteger(item.before) &&
        Number.isInteger(item.after)
    );
  } catch {
    return [];
  }
}

function priorityColor(priority: string) {
  if (priority === "High") return "text-rose-400";
  if (priority === "Medium") return "text-amber-400";
  return "text-sky-400";
}

export default function SchedulerPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [firstTask, setFirstTask] = useState("");
  const [nextTask, setNextTask] = useState("");
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [storageReady, setStorageReady] = useState(false);

  const activeTasks = useMemo(
    () => tasks.filter((task) => task.status !== "Completed"),
    [tasks]
  );

  const taskMap = useMemo(
    () => new Map(activeTasks.map((task) => [task.id, task])),
    [activeTasks]
  );

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API}/tasks`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Could not load tasks from backend.");
      }

      const data: Task[] = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("Invalid tasks response.");
      }

      setTasks(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Backend connection failed."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setDependencies(readDependencies());
    setStorageReady(true);
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (!storageReady) return;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(dependencies)
    );
  }, [dependencies, storageReady]);

  useEffect(() => {
    function syncFromGraph() {
      setDependencies(readDependencies());
      setResult(null);
    }

    window.addEventListener("focus", syncFromGraph);
    window.addEventListener("storage", syncFromGraph);

    return () => {
      window.removeEventListener("focus", syncFromGraph);
      window.removeEventListener("storage", syncFromGraph);
    };
  }, []);

  function addDependency() {
    const before = Number(firstTask);
    const after = Number(nextTask);

    setError("");
    setSuccess("");

    if (!firstTask || !nextTask) {
      setError("Please select both tasks.");
      return;
    }

    if (before === after) {
      setError("A task cannot depend on itself.");
      return;
    }

    if (
      dependencies.some(
        (dep) => dep.before === before && dep.after === after
      )
    ) {
      setError("This dependency already exists.");
      return;
    }

    setDependencies((current) => [
      ...current,
      { before, after },
    ]);

    setFirstTask("");
    setNextTask("");
    setResult(null);
    setSuccess("Dependency added successfully.");
  }

  function removeDependency(index: number) {
    setDependencies((current) =>
      current.filter((_, i) => i !== index)
    );
    setResult(null);
    setError("");
    setSuccess("Dependency removed.");
  }

  async function generateSchedule() {
    setRunning(true);
    setError("");
    setSuccess("");
    setResult(null);

    try {
      const validIds = new Set(activeTasks.map((task) => task.id));

      const validDependencies = dependencies.filter(
        (dep) =>
          validIds.has(dep.before) &&
          validIds.has(dep.after)
      );

      const response = await fetch(`${API}/smart-schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dependencies: validDependencies,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const detail = data.detail;

        throw new Error(
          typeof detail === "string"
            ? detail
            : "Could not generate schedule."
        );
      }

      setResult(data as ScheduleResult);
      setSuccess("Smart schedule generated successfully!");
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
                <GitBranch size={24} />
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-violet-400">
                  FlowMind Intelligence
                </p>
                <h1 className="text-2xl font-bold sm:text-3xl">
                  Smart Workflow Scheduler
                </h1>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-400">
              Organize dependencies and optimize task execution using DSA.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/graph"
              className="inline-flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-300 hover:bg-violet-500/20"
            >
              <Network size={16} />
              Graph Studio
            </Link>

            <button
              onClick={() => {
                setDependencies(readDependencies());
                setResult(null);
                void loadTasks();
              }}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#151923] px-4 py-3 text-sm hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw size={16} />
              Refresh Tasks
            </button>
          </div>
        </header>

        <div className="mb-7 grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "Active Tasks",
              value: activeTasks.length,
            },
            {
              label: "Dependencies",
              value: dependencies.length,
            },
            {
              label: "Scheduled",
              value: result?.schedule.length ?? 0,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/10 bg-[#11151e] p-6"
            >
              <p className="text-sm text-slate-400">
                {stat.label}
              </p>
              <p className="mt-3 text-3xl font-bold">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-2">

          <section className="rounded-2xl border border-white/10 bg-[#11151e] p-6">
            <div className="mb-7">
              <h2 className="flex items-center gap-3 text-lg font-semibold">
                <GitBranch
                  size={22}
                  className="text-violet-400"
                />
                Dependency Builder
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Define which task must happen first.
              </p>
            </div>

            <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              FIRST — Prerequisite Task
            </label>

            <select
              value={firstTask}
              onChange={(event) =>
                setFirstTask(event.target.value)
              }
              className="w-full rounded-xl border border-white/10 bg-[#0b0e15] p-4 text-sm text-white outline-none focus:border-violet-500"
            >
              <option value="">Select first task...</option>

              {activeTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title} — {task.priority}
                </option>
              ))}
            </select>

            <div className="my-6 flex justify-center">
              <div className="rounded-full border border-violet-500/30 bg-violet-500/10 p-3 text-violet-400">
                <ArrowRight
                  size={20}
                  className="rotate-90"
                />
              </div>
            </div>

            <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              THEN — Dependent Task
            </label>

            <select
              value={nextTask}
              onChange={(event) =>
                setNextTask(event.target.value)
              }
              className="w-full rounded-xl border border-white/10 bg-[#0b0e15] p-4 text-sm text-white outline-none focus:border-violet-500"
            >
              <option value="">Select next task...</option>

              {activeTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title} — {task.priority}
                </option>
              ))}
            </select>

            <button
              onClick={addDependency}
              disabled={
                !firstTask ||
                !nextTask ||
                firstTask === nextTask
              }
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-4 text-sm font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={18} />
              Add Dependency
            </button>

            <div className="mt-8 border-t border-white/10 pt-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h3 className="font-semibold">
                  Workflow Connections
                </h3>
                <span className="text-xs text-slate-500">
                  {dependencies.length} edges
                </span>
              </div>

              {dependencies.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                  No dependencies added yet.
                  Tasks without dependencies can still be scheduled.
                </div>
              ) : (
                <div className="space-y-3">
                  {dependencies.map((dep, index) => (
                    <div
                      key={`${dep.before}-${dep.after}`}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0b0e15] p-3"
                    >
                      <span className="min-w-0 flex-1 truncate text-xs text-slate-200">
                        {taskMap.get(dep.before)?.title ??
                          `Task ${dep.before}`}
                      </span>

                      <ArrowRight
                        size={17}
                        className="shrink-0 text-violet-400"
                      />

                      <span className="min-w-0 flex-1 truncate text-xs text-slate-200">
                        {taskMap.get(dep.after)?.title ??
                          `Task ${dep.after}`}
                      </span>

                      <button
                        onClick={() => removeDependency(index)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
                        title="Remove dependency"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#11151e] p-6">
            <div className="mb-7">
              <h2 className="flex items-center gap-3 text-lg font-semibold">
                <Zap
                  size={22}
                  className="text-emerald-400"
                />
                Intelligent Execution Plan
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Powered by graph algorithms and a min-heap.
              </p>
            </div>

            <button
              onClick={() => void generateSchedule()}
              disabled={
                running ||
                loading ||
                activeTasks.length === 0
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 py-4 text-sm font-semibold hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {running ? (
                <Loader2
                  size={18}
                  className="animate-spin"
                />
              ) : (
                <Sparkles size={18} />
              )}

              {running
                ? "Generating Schedule..."
                : "Generate Smart Schedule"}
            </button>

            {loading && (
              <p className="mt-4 text-center text-xs text-slate-500">
                Loading tasks...
              </p>
            )}

            {result ? (
              <div className="mt-7">
                <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-emerald-400">
                  <CheckCircle2 size={18} />
                  Valid Execution Order
                </div>

                <div className="space-y-3">
                  {result.schedule.map((task, index) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-4 rounded-xl border border-white/10 bg-[#0b0e15] p-4"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-sm font-bold text-violet-300">
                        {task.order ?? index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {task.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {task.department}
                        </p>
                      </div>

                      <span
                        className={`text-xs font-semibold ${priorityColor(
                          task.priority
                        )}`}
                      >
                        {task.priority}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-xl border border-white/10 bg-[#0b0e15] p-5">
                  <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Algorithm Analysis
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">
                        Algorithm
                      </span>
                      <span className="text-right">
                        {result.algorithm}
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">
                        Tasks / Vertices
                      </span>
                      <span>{result.total_tasks}</span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">
                        Dependencies / Edges
                      </span>
                      <span>{result.total_dependencies}</span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">
                        Time Complexity
                      </span>
                      <span className="font-mono text-violet-300">
                        {result.complexity}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-7 rounded-xl border border-dashed border-white/10 px-6 py-12 text-center">
                <Network
                  size={35}
                  className="mx-auto mb-4 text-slate-600"
                />

                <p className="text-sm font-medium text-slate-300">
                  Your execution plan will appear here
                </p>

                <p className="mx-auto mt-2 max-w-xs text-xs leading-6 text-slate-500">
                  Add dependencies and generate a schedule
                  to see the recommended task order.
                </p>
              </div>
            )}
          </section>
        </div>

        <section className="mt-7 rounded-2xl border border-white/10 bg-[#11151e] p-6">
          <h2 className="mb-6 flex items-center gap-2 font-semibold">
            <Network
              size={18}
              className="text-violet-400"
            />
            How the DSA Engine Works
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "01 — Directed Graph",
                description:
                  "Tasks are vertices. Dependencies are directed edges.",
              },
              {
                title: "02 — Topological Sort",
                description:
                  "Kahn's Algorithm checks prerequisites and detects cycles.",
              },
              {
                title: "03 — Min-Heap",
                description:
                  "High-priority available tasks are selected first.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-white/10 bg-[#0b0e15] p-5"
              >
                <h3 className="text-sm font-semibold text-violet-300">
                  {item.title}
                </h3>
                <p className="mt-3 text-xs leading-6 text-slate-400">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <footer className="py-8 text-center text-xs text-slate-600">
          FlowMind · Smart Workflow & Task Optimization System
        </footer>
      </div>
    </div>
  );
}
