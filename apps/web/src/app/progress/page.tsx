"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { CheckCircle, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorMessage } from "@/components/ui/error-message";
import { fmtCalLong } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompletedTask {
  _id: string;
  title: string;
  completed_at?: string;
  base_xp: number;
  difficulty: string;
}

interface SubgoalProgress {
  _id: string;
  title: string;
  status: string;
  completed_tasks: CompletedTask[];
}

interface GoalProgress {
  title: string;
  deadline?: string;
  status: string;
  tasks_completed: number;
  tasks_total: number;
  subgoals_completed: number;
  subgoals_total: number;
  subgoals: SubgoalProgress[];
}

interface PillarProgress {
  pillar_name: string;
  color: string;
  rank_name: string;
  rank_tier: number;
  xp: number;
  tasks_completed: number;
  tasks_total: number;
  xp_earned: number;
  goals: GoalProgress[];
}

interface XpHistoryPoint {
  date: string;
  xp_earned: number;
}

interface StreakRecord {
  type: string;
  current: number;
  longest: number;
}

interface GlobalProgress {
  total_tasks_completed: number;
  total_xp_earned: number;
  total_tasks_completed_alltime: number;
  total_xp_alltime: number;
  per_pillar: PillarProgress[];
  xp_history: XpHistoryPoint[];
  milestones_hit: number;
  current_streaks: StreakRecord[];
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body.data as T;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const C = {
  grid: "#27272a",
  axis: "#71717a",
  tooltip: {
    contentStyle: {
      backgroundColor: "#1a1a1f",
      border: "1px solid #27272a",
      borderRadius: "8px",
      color: "#f4f4f5",
      fontSize: "12px",
    },
    itemStyle: { color: "#f4f4f5" },
    labelStyle: { color: "#71717a" },
  },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function SubgoalRow({ subgoal, color }: { subgoal: SubgoalProgress; color: string }) {
  const [expanded, setExpanded] = useState(false);

  if (subgoal.completed_tasks.length === 0) return null;

  return (
    <div className="mt-2 border-l-2 pl-3" style={{ borderColor: `${color}40` }}>
      <p className="text-xs font-medium text-text-secondary">{subgoal.title}</p>
      <button
        className="mt-1 flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
        onClick={() => setExpanded((o) => !o)}
      >
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        Completed Tasks ({subgoal.completed_tasks.length})
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1.5">
          {subgoal.completed_tasks.map((task) => (
            <div key={task._id} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <CheckCircle size={11} style={{ color }} />
                <span className="text-text-primary">{task.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-text-secondary">
                  {task.completed_at ? fmtDate(task.completed_at) : "—"}
                </span>
                <span
                  className="rounded px-1.5 py-0.5 font-medium"
                  style={{ backgroundColor: `${color}20`, color }}
                >
                  +{task.base_xp} XP
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GoalRow({ goal, color }: { goal: GoalProgress; color: string }) {
  const pct =
    goal.tasks_total > 0
      ? Math.round((goal.tasks_completed / goal.tasks_total) * 100)
      : 0;
  const dl = goal.deadline ? fmtCalLong(goal.deadline) : null;

  return (
    <div className="space-y-1 py-2">
      <div className="flex items-center justify-between text-sm">
        <span className={`font-medium ${goal.status === "completed" ? "text-text-secondary line-through" : "text-text-primary"}`}>
          {goal.title}
        </span>
        <span className="tabular-nums text-xs text-text-secondary">
          {goal.tasks_completed}/{goal.tasks_total} tasks
        </span>
      </div>
      <ProgressBar value={goal.tasks_completed} max={goal.tasks_total} color={color} />
      <div className="flex items-center gap-3 text-xs text-text-secondary">
        <span>{pct}%</span>
        <span>
          {goal.subgoals_completed}/{goal.subgoals_total} subgoals
        </span>
        {dl && <span>Due {dl}</span>}
        <span className="capitalize">{goal.status}</span>
      </div>
      {goal.subgoals && goal.subgoals.some((sg) => sg.completed_tasks.length > 0) && (
        <div className="mt-2 space-y-2">
          {goal.subgoals.map((sg) => (
            <SubgoalRow key={sg._id} subgoal={sg} color={color} />
          ))}
        </div>
      )}
    </div>
  );
}

function PillarSection({ pillar }: { pillar: PillarProgress }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card style={{ borderColor: `${pillar.color}30` }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle style={{ color: pillar.color }}>{pillar.pillar_name}</CardTitle>
            <p className="mt-0.5 text-xs text-text-secondary">
              {pillar.rank_name} T{pillar.rank_tier} · {pillar.xp.toLocaleString()} XP
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold text-text-primary">
              {pillar.tasks_completed.toLocaleString()} tasks
            </p>
            <p className="text-xs text-text-secondary">
              +{pillar.xp_earned.toLocaleString()} XP earned
            </p>
          </div>
        </div>

        {/* XP bar */}
        <div className="mt-3 space-y-1">
          <ProgressBar value={pillar.tasks_completed} max={Math.max(pillar.tasks_total, 1)} color={pillar.color} />
          <p className="text-xs text-text-secondary">
            {pillar.tasks_completed}/{pillar.tasks_total} tasks across all goals
          </p>
        </div>
      </CardHeader>

      {pillar.goals.length > 0 && (
        <CardContent className="pt-0">
          <button
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary mb-2"
            onClick={() => setExpanded((o) => !o)}
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Goals ({pillar.goals.length})
          </button>
          {expanded && (
            <div className="divide-y divide-border/50">
              {pillar.goals.map((g, i) => (
                <GoalRow key={i} goal={g} color={pillar.color} />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProgressPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GlobalProgress | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiFetch<GlobalProgress>("/progress/global");
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load progress");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-8 w-32" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <ErrorMessage message={error ?? "No data"} onRetry={load} />
      </main>
    );
  }

  const chartData = data.xp_history.map((p) => ({
    date: fmtDate(p.date),
    xp: p.xp_earned,
  }));

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      {/* ── Trophy shelf ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div
          className="rounded-xl border border-border p-6 text-center"
          style={{ backgroundColor: "#1A1A1F" }}
        >
          <p className="text-4xl font-bold tabular-nums" style={{ color: "#3B82F6" }}>
            {data.total_tasks_completed_alltime.toLocaleString()}
          </p>
          <p className="mt-1.5 text-sm text-text-secondary">Tasks Completed</p>
        </div>
        <div
          className="rounded-xl border border-border p-6 text-center"
          style={{ backgroundColor: "#1A1A1F" }}
        >
          <p className="text-4xl font-bold tabular-nums" style={{ color: "#3B82F6" }}>
            {data.total_xp_alltime.toLocaleString()}
            <span className="ml-1 text-xl font-semibold">XP</span>
          </p>
          <p className="mt-1.5 text-sm text-text-secondary">Total XP Earned</p>
        </div>
      </div>

      <h1 className="font-display text-2xl font-semibold text-text-primary">Progress</h1>

      {/* ── Totals ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface-raised p-4 text-center">
          <p className="text-2xl font-bold text-text-primary">
            {data.total_xp_earned.toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs text-text-secondary">Total XP</p>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-4 text-center">
          <p className="text-2xl font-bold text-text-primary">
            {data.total_tasks_completed.toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs text-text-secondary">Tasks Done</p>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-4 text-center">
          <p className="text-2xl font-bold text-text-primary">{data.milestones_hit}</p>
          <p className="mt-0.5 text-xs text-text-secondary">Milestones</p>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-4 text-center">
          <p className="text-2xl font-bold text-text-primary">{data.per_pillar.length}</p>
          <p className="mt-0.5 text-xs text-text-secondary">Pillars Active</p>
        </div>
      </div>

      {/* ── Per-pillar sections ── */}
      <div className="space-y-4">
        {data.per_pillar.map((p) => (
          <PillarSection key={p.pillar_name} pillar={p} />
        ))}
      </div>

      {/* ── XP History Chart ── */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>XP History — Last 90 Days</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                <XAxis dataKey="date" stroke={C.axis} tick={{ fontSize: 11 }} />
                <YAxis stroke={C.axis} tick={{ fontSize: 11 }} />
                <Tooltip {...C.tooltip} />
                <Line
                  type="monotone"
                  dataKey="xp"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="XP"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Streak Records ── */}
      {data.current_streaks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Streak Records</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="divide-y divide-border/50">
              {data.current_streaks.map((s) => (
                <div key={s.type} className="flex items-center justify-between py-2">
                  <span className="text-sm capitalize text-text-primary">{s.type}</span>
                  <div className="flex gap-6 text-sm">
                    <span className="tabular-nums text-text-primary">
                      {s.current}
                      <span className="ml-0.5 text-xs text-text-secondary"> current</span>
                    </span>
                    <span className="tabular-nums text-text-secondary">
                      {s.longest}
                      <span className="ml-0.5 text-xs"> best</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
