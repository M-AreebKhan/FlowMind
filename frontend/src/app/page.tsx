 
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  LayoutDashboard,
  ListTodo,
  Loader2,
  Network,
  GitBranch,
  CalendarClock,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

const API = "http://127.0.0.1:8000";

type Status = "Pending" | "In Progress" | "Completed";
type Priority = "High" | "Medium" | "Low";
type Tab = "Dashboard" | "Tasks" | "Workflows" | "Analytics";

type Task = {
  id: number;
  title: string;
  department: string;
  assignee: string;
  priority: Priority;
  status: Status;
  due: string;
};

type NewTask = {
  title: string;
  department: string;
  assignee: string;
  priority: Priority;
  due: string;
};

const navItems: {
  name: Tab;
  icon: typeof LayoutDashboard;
}[] = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Tasks", icon: ListTodo },
  { name: "Workflows", icon: Network },
  { name: "Analytics", icon: Activity },
];

const priorityColors: Record<Priority, string> = {
  High: "border-rose-500/20 bg-rose-500/10 text-rose-400",
  Medium: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  Low: "border-sky-500/20 bg-sky-500/10 text-sky-400",
};

const statusColors: Record<Status, string> = {
  Pending: "border-slate-500/20 bg-slate-500/10 text-slate-300",
  "In Progress": "border-violet-500/20 bg-violet-500/10 text-violet-300",
  Completed: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
};

const emptyForm: NewTask = {
  title: "",
  department: "Sales",
  assignee: "",
  priority: "Medium",
  due: "",
};

async function apiRequest<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
  } catch {
    throw new Error(
      "Cannot connect to backend. Make sure FastAPI is running on port 8000."
    );
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const data = await response.json();
      if (typeof data.detail === "string") {
        message = data.detail;
      }
    } catch {
      // Keep the default error message.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewTask>(emptyForm);

  useEffect(() => {
    let cancelled = false;

    async function loadTasks() {
      try {
        const data = await apiRequest<Task[]>("/tasks");

        if (!cancelled) {
          setTasks(data);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load tasks."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTasks();

    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(
    () => ({
      total: tasks.length,
      completed: tasks.filter((t) => t.status === "Completed").length,
      active: tasks.filter((t) => t.status === "In Progress").length,
      pending: tasks.filter((t) => t.status === "Pending").length,
    }),
    [tasks]
  );

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) =>
        `${task.title} ${task.department} ${task.assignee}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [tasks, search]
  );

  async function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim() || saving) return;

    setSaving(true);
    setError("");

    try {
      const created = await apiRequest<Task>("/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(),
          department: form.department,
          assignee: form.assignee.trim() || "Unassigned",
          priority: form.priority,
          due: form.due.trim() || "Not set",
        }),
      });

      setTasks((current) => [created, ...current]);
      setForm(emptyForm);
      setShowModal(false);
      setTab("Tasks");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create task."
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(task: Task) {
    if (busyId !== null || task.status === "Completed") return;

    setBusyId(task.id);
    setError("");

    try {
      const updated = await apiRequest<Task>(
        `/tasks/${task.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "Completed" }),
        }
      );

      setTasks((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update task."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function deleteTask(task: Task) {
    if (busyId !== null) return;

    const confirmed = window.confirm(
      `Delete "${task.title}" permanently?`
    );

    if (!confirmed) return;

    setBusyId(task.id);
    setError("");

    try {
      await apiRequest<{ message: string }>(`/tasks/${task.id}`, {
        method: "DELETE",
      });

      setTasks((current) =>
        current.filter((item) => item.id !== task.id)
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete task."
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#090b10] text-slate-100">
      <div className="flex min-h-screen">
        {/* SIDEBAR */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-[#0d1017] md:flex">
          <div className="flex h-20 items-center gap-3 px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 shadow-lg shadow-violet-600/20">
              <Network size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                FlowMind
              </h1>
              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                Workspace
              </p>
            </div>
          </div>

          <div className="px-4 pt-6">
            <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-600">
              Workspace
            </p>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.name}
                    onClick={() => setTab(item.name)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                      tab === item.name
                        ? "bg-violet-500/15 font-medium text-violet-300"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon size={18} />
                    {item.name}

                    {item.name === "Tasks" && (
                      <span className="ml-auto rounded-md bg-white/5 px-2 py-0.5 text-xs">
                        {tasks.length}
                      </span>
                    )}
                  </button>
                );
              })}
              <div className="my-4 border-t border-white/10" />
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-600">
                DSA Intelligence
              </p>
              <Link href="/scheduler" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-400 transition hover:bg-violet-500/10 hover:text-violet-300">
                <CalendarClock size={18} /> Smart Scheduler
              </Link>
              <Link href="/graph" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-400 transition hover:bg-violet-500/10 hover:text-violet-300">
                <GitBranch size={18} /> Graph Studio
              </Link>
            </nav>
          </div>

          <div className="mt-10 px-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
              <p className="text-xs font-semibold">
                Operations Workspace
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Connected to SQLite database
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {error ? "Connection needs attention" : "API connected"}
              </div>
            </div>
          </div>

          <div className="mt-auto p-4">
            <div className="rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/10 to-transparent p-4">
              <Sparkles size={19} className="mb-3 text-violet-400" />
              <p className="text-sm font-semibold">
                Work smarter.
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Manage tasks with real-time database updates.
              </p>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="min-w-0 flex-1">
          <header className="flex min-h-20 flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4 lg:px-10">
            <div>
              <p className="text-xs text-slate-500">
                Workspace <span className="mx-2">/</span> {tab}
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                {tab}
              </h2>
            </div>

            <button
              onClick={() => {
                setError("");
                setShowModal(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500"
            >
              <Plus size={17} />
              New Task
            </button>
          </header>

          <div className="mx-auto max-w-7xl p-5 lg:p-10">
            {/* MOBILE NAVIGATION */}
            <div className="mb-7 flex flex-wrap gap-2 md:hidden">
              {navItems.map((item) => (
                <button
                  key={item.name}
                  onClick={() => setTab(item.name)}
                  className={`rounded-lg px-3 py-2 text-xs ${
                    tab === item.name
                      ? "bg-violet-600"
                      : "bg-white/5 text-slate-400"
                  }`}
                >
                  {item.name}
                </button>
              ))}
                <Link href="/scheduler" className="rounded-lg bg-violet-500/15 px-3 py-2 text-xs text-violet-200">Scheduler</Link>
                <Link href="/graph" className="rounded-lg bg-violet-500/15 px-3 py-2 text-xs text-violet-200">Graph Studio</Link>
            </div>

            {/* HEADING */}
            <div className="mb-8">
              <p className="mb-2 flex items-center gap-2 text-xs font-medium text-violet-400">
                <Sparkles size={14} />
                FLOWMIND OPERATIONS
              </p>

              <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {tab === "Dashboard"
                  ? "Keep work moving."
                  : tab === "Tasks"
                  ? "Manage your tasks."
                  : tab === "Workflows"
                  ? "Visualize your workflow."
                  : "Track your progress."}
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Your tasks are now stored in a real SQLite database.
              </p>
            </div>

            {/* ERRORS */}
            {error && (
              <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
                <strong>Backend error:</strong> {error}
              </div>
            )}

            {/* STATS */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Total Tasks",
                  value: stats.total,
                  icon: ListTodo,
                  color: "text-violet-400",
                  bg: "bg-violet-500/10",
                },
                {
                  label: "In Progress",
                  value: stats.active,
                  icon: Clock3,
                  color: "text-sky-400",
                  bg: "bg-sky-500/10",
                },
                {
                  label: "Completed",
                  value: stats.completed,
                  icon: CheckCircle2,
                  color: "text-emerald-400",
                  bg: "bg-emerald-500/10",
                },
                {
                  label: "Pending",
                  value: stats.pending,
                  icon: Circle,
                  color: "text-amber-400",
                  bg: "bg-amber-500/10",
                },
              ].map((stat) => {
                const Icon = stat.icon;

                return (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-white/[0.07] bg-[#11151e] p-5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">
                        {stat.label}
                      </span>
                      <span className={`rounded-xl p-2.5 ${stat.bg}`}>
                        <Icon size={18} className={stat.color} />
                      </span>
                    </div>

                    <p className="mt-5 text-3xl font-semibold">
                      {loading
                        ? "..."
                        : stat.value.toString().padStart(2, "0")}
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      Stored in database
                    </p>
                  </div>
                );
              })}
            </div>

            {/* WORKFLOW PREVIEW */}
            {tab === "Workflows" ? (
              <section className="mt-6 rounded-2xl border border-white/[0.07] bg-[#11151e] p-6">
                <div className="mb-6 flex items-center gap-2">
                  <Network size={19} className="text-violet-400" />
                  <h4 className="font-semibold">
                    Order Fulfillment Workflow
                  </h4>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {[
                    "Order Received",
                    "Payment Check",
                    "Packaging",
                    "Dispatch",
                  ].map((step, index) => (
                    <div key={step} className="flex items-center gap-3">
                      <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-4 text-sm text-violet-200">
                        <span className="mb-1 block text-[10px] text-violet-400">
                          STEP {index + 1}
                        </span>
                        {step}
                      </div>

                      {index < 3 && (
                        <ArrowRight
                          size={18}
                          className="text-slate-500"
                        />
                      )}
                    </div>
                  ))}
                </div>

                <p className="mt-7 text-xs text-slate-400">
                  Build real task dependencies and generate an optimized execution order using the DSA engine.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href="/graph" className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-medium hover:bg-violet-500">
                    <GitBranch size={17} /> Open Graph Studio <ArrowRight size={16} />
                  </Link>
                  <Link href="/scheduler" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10">
                    <CalendarClock size={17} /> Open Smart Scheduler <ArrowRight size={16} />
                  </Link>
                </div>
              </section>
            ) : (
              <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_300px]">
                {/* TASK TABLE */}
                <section className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#11151e]">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] p-5">
                    <div>
                      <h4 className="font-semibold">
                        {tab === "Analytics"
                          ? "Task Breakdown"
                          : "Recent Tasks"}
                      </h4>
                      <p className="mt-1 text-xs text-slate-500">
                        Live data from FastAPI + SQLite
                      </p>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0b0e15] px-3 py-2">
                      <Search size={15} className="text-slate-500" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search tasks..."
                        className="w-32 bg-transparent text-xs text-white outline-none placeholder:text-slate-600 sm:w-40"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] text-left text-sm">
                      <thead className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-5 py-4 font-medium">Task</th>
                          <th className="px-4 py-4 font-medium">
                            Priority
                          </th>
                          <th className="px-4 py-4 font-medium">
                            Status
                          </th>
                          <th className="px-4 py-4 font-medium">Due</th>
                          <th className="px-4 py-4 font-medium">
                            Actions
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredTasks.map((task) => (
                          <tr
                            key={task.id}
                            className="border-b border-white/[0.045] transition hover:bg-white/[0.025]"
                          >
                            <td className="px-5 py-4">
                              <p className="font-medium text-slate-200">
                                {task.title}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {task.department} · {task.assignee}
                              </p>
                            </td>

                            <td className="px-4 py-4">
                              <span
                                className={`rounded-md border px-2.5 py-1 text-xs ${priorityColors[task.priority]}`}
                              >
                                {task.priority}
                              </span>
                            </td>

                            <td className="px-4 py-4">
                              <span
                                className={`rounded-md border px-2.5 py-1 text-xs ${statusColors[task.status]}`}
                              >
                                {task.status}
                              </span>
                            </td>

                            <td className="px-4 py-4 text-xs text-slate-400">
                              {task.due}
                            </td>

                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => void changeStatus(task)}
                                  disabled={
                                    busyId !== null ||
                                    task.status === "Completed"
                                  }
                                  title="Mark completed"
                                  className="rounded-lg border border-white/10 p-2 text-slate-400 hover:text-emerald-400 disabled:cursor-not-allowed disabled:opacity-30"
                                >
                                  {busyId === task.id ? (
                                    <Loader2
                                      size={16}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <Check size={16} />
                                  )}
                                </button>

                                <button
                                  onClick={() => void deleteTask(task)}
                                  disabled={busyId !== null}
                                  title="Delete task"
                                  className="rounded-lg border border-white/10 p-2 text-slate-400 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-30"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {loading && (
                      <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-400">
                        <Loader2 size={18} className="animate-spin" />
                        Loading tasks...
                      </div>
                    )}

                    {!loading && filteredTasks.length === 0 && (
                      <p className="p-10 text-center text-sm text-slate-500">
                        No tasks found. Create your first task.
                      </p>
                    )}
                  </div>
                </section>

                {/* RIGHT PANEL */}
                <div className="space-y-6">
                  <section className="rounded-2xl border border-white/[0.07] bg-[#11151e] p-5">
                    <div className="flex items-center gap-2">
                      <Activity
                        size={18}
                        className="text-violet-400"
                      />
                      <h4 className="font-semibold">
                        Task Completion
                      </h4>
                    </div>

                    <div className="my-7 flex justify-center">
                      <div
                        className="flex h-40 w-40 items-center justify-center rounded-full"
                        style={{
                          background: `conic-gradient(#8b5cf6 ${
                            stats.total
                              ? (stats.completed / stats.total) * 100
                              : 0
                          }%, #242936 0)`,
                        }}
                      >
                        <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-[#11151e]">
                          <p className="text-3xl font-bold">
                            {stats.total
                              ? Math.round(
                                  (stats.completed / stats.total) * 100
                                )
                              : 0}
                            %
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Completed
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between border-t border-white/[0.06] pt-4 text-xs">
                      <span className="text-slate-400">
                        Tasks finished
                      </span>
                      <span className="font-semibold">
                        {stats.completed} / {stats.total}
                      </span>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-white/[0.07] bg-[#11151e] p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Sparkles
                        size={18}
                        className="text-violet-400"
                      />
                      <h4 className="font-semibold">
                        Quick Actions
                      </h4>
                    </div>

                    <button
                      onClick={() => setShowModal(true)}
                      className="mb-2 flex w-full items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-sm text-slate-300 hover:bg-white/5"
                    >
                      Create a new task
                      <Plus size={17} />
                    </button>

                    <Link href="/scheduler" className="mb-2 flex w-full items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-sm text-slate-300 hover:bg-white/5">
                      Smart Scheduler <CalendarClock size={17} />
                    </Link>
                    <Link href="/graph" className="flex w-full items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-sm text-slate-300 hover:bg-white/5">
                      Graph Studio <GitBranch size={17} />
                    </Link>
                  </section>
                </div>
              </div>
            )}

            <p className="mt-8 text-center text-xs text-slate-600">
              FlowMind · Smart Workflow & Task Optimization System
            </p>
          </div>
        </main>
      </div>

      {/* CREATE TASK MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#151923] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  Create New Task
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  This task will be saved to SQLite.
                </p>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-white/5"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={(event) => void addTask(event)} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs text-slate-400">
                  Task name
                </label>
                <input
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="e.g. Verify customer payment"
                  className="w-full rounded-xl border border-white/10 bg-[#0b0e15] px-4 py-3 text-sm outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs text-slate-400">
                  Department
                </label>
                <select
                  value={form.department}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      department: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#0b0e15] px-4 py-3 text-sm outline-none focus:border-violet-500"
                >
                  {[
                    "Sales",
                    "Finance",
                    "Warehouse",
                    "Inventory",
                    "Logistics",
                  ].map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs text-slate-400">
                  Assignee
                </label>
                <input
                  value={form.assignee}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      assignee: event.target.value,
                    }))
                  }
                  placeholder="e.g. Ali"
                  className="w-full rounded-xl border border-white/10 bg-[#0b0e15] px-4 py-3 text-sm outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-xs text-slate-400">
                    Priority
                  </label>
                  <select
                    value={form.priority}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        priority: event.target.value as Priority,
                      }))
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#0b0e15] px-4 py-3 text-sm outline-none focus:border-violet-500"
                  >
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs text-slate-400">
                    Due
                  </label>
                  <input
                    value={form.due}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        due: event.target.value,
                      }))
                    }
                    placeholder="Today"
                    className="w-full rounded-xl border border-white/10 bg-[#0b0e15] px-4 py-3 text-sm outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium hover:bg-violet-500 disabled:opacity-50"
                >
                  {saving && (
                    <Loader2 size={16} className="animate-spin" />
                  )}
                  {saving ? "Saving..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
