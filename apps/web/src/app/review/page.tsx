"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Trophy, AlertTriangle, Flame } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import { fetchWeeklyReview, type WeeklyReview } from "@/lib/api";
import { fmtCalShort } from "@/lib/dates";

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

function pillarColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("fitness") || n.includes("nutrition")) return "#22c55e";
  if (n.includes("content")) return "#a855f7";
  if (n.includes("side")) return "#f59e0b";
  if (name === "Bonus") return "#3b82f6";
  return "#71717a";
}

function fmtWeek(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = fmtCalShort(start);
  const [y] = end.slice(0, 10).split("-").map(Number);
  const e = fmtCalShort(end);
  return `${s} – ${e}, ${y}`;
}

function fmtDate(iso: string) {
  return fmtCalShort(iso);
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ReviewSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface-raised" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReviewPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState<WeeklyReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((offset: number) => {
    setLoading(true);
    setError(null);
    fetchWeeklyReview(offset)
      .then(setData)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load review"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(weekOffset);
  }, [weekOffset, load]);

  function prevWeek() {
    setWeekOffset((n) => n - 1);
  }
  function nextWeek() {
    if (weekOffset < 0) setWeekOffset((n) => n + 1);
  }

  // ── Chart data ──
  const barData = data
    ? Object.entries(data.xp_by_pillar)
        .sort((a, b) => b[1] - a[1])
        .map(([pillar, xp]) => ({ pillar, xp, color: pillarColor(pillar) }))
    : [];

  const taskData =
    data && data.tasks_scheduled > 0
      ? [
          { name: "Done", value: data.tasks_completed, color: "#22c55e" },
          {
            name: "Remaining",
            value: Math.max(0, data.tasks_scheduled - data.tasks_completed),
            color: "#27272a",
          },
        ]
      : null;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-text-primary">
          Weekly Review
        </h1>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={prevWeek} disabled={loading}>
            <ChevronLeft size={16} />
          </Button>
          <span className="min-w-[160px] text-center text-sm text-text-secondary">
            {data ? fmtWeek(data.week_start, data.week_end) : "—"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={nextWeek}
            disabled={loading || weekOffset >= 0}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={() => load(weekOffset)} />}

      {loading ? (
        <ReviewSkeleton />
      ) : data ? (
        <>
          {/* ── Total XP ── */}
          <Card>
            <CardContent className="flex items-center justify-between py-6">
              <span className="text-sm text-text-secondary">XP earned this week</span>
              <span className="font-display text-4xl font-bold text-accent glow-accent">
                {data.xp_earned.toLocaleString()}
              </span>
            </CardContent>
          </Card>

          {/* ── XP by Pillar ── */}
          {barData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>XP by Pillar</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={barData.length * 52 + 20}>
                  <BarChart
                    data={barData}
                    layout="vertical"
                    margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={C.grid}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      stroke={C.axis}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: number) => v.toLocaleString()}
                    />
                    <YAxis
                      type="category"
                      dataKey="pillar"
                      stroke={C.axis}
                      tick={{ fontSize: 12 }}
                      width={140}
                    />
                    <Tooltip
                      {...C.tooltip}
                      formatter={(v) => [
                        typeof v === "number" ? v.toLocaleString() : String(v ?? 0),
                        "XP",
                      ]}
                    />
                    <Bar dataKey="xp" radius={[0, 4, 4, 0]}>
                      {barData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* ── Tasks + Streak ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Tasks donut */}
            <Card>
              <CardHeader>
                <CardTitle>Tasks Completed</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-6 pt-0">
                {taskData ? (
                  <>
                    <div className="relative shrink-0">
                      <PieChart width={120} height={120}>
                        <Pie
                          data={taskData}
                          cx={55}
                          cy={55}
                          innerRadius={36}
                          outerRadius={52}
                          dataKey="value"
                          startAngle={90}
                          endAngle={-270}
                          strokeWidth={0}
                        >
                          {taskData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-display text-lg font-bold text-text-primary">
                          {data.tasks_scheduled > 0
                            ? `${Math.round((data.tasks_completed / data.tasks_scheduled) * 100)}%`
                            : "—"}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="font-display text-2xl font-semibold text-fitness">
                        {data.tasks_completed}
                        <span className="text-base font-normal text-text-secondary">
                          {" "}/ {data.tasks_scheduled}
                        </span>
                      </p>
                      <p className="text-sm text-text-secondary">tasks done</p>
                    </div>
                  </>
                ) : (
                  <p className="py-4 text-sm text-text-secondary">
                    No tasks scheduled this week
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Streak */}
            <Card>
              <CardHeader>
                <CardTitle>Streak</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-4 pt-0">
                <Flame size={32} className="shrink-0 text-sidequest" />
                {data.streak ? (
                  <div>
                    <p className="font-display text-2xl font-semibold text-text-primary">
                      {data.streak.current_streak}
                      <span className="text-sm font-normal text-text-secondary"> days</span>
                    </p>
                    <p className="text-sm text-text-secondary">
                      Longest: {data.streak.longest_streak} days
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">No streak data</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Running ── */}
          {(data.running_actual_km > 0 || data.running_target_km != null) && (
            <Card>
              <CardHeader>
                <CardTitle>Running</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="font-display text-2xl font-semibold text-fitness">
                      {data.running_actual_km.toFixed(1)}
                      <span className="text-sm font-normal text-text-secondary"> km actual</span>
                    </p>
                    {data.running_target_km != null && (
                      <p className="text-sm text-text-secondary">
                        Target: {data.running_target_km.toFixed(1)} km
                      </p>
                    )}
                  </div>
                  {data.running_target_km != null && data.running_target_km > 0 && (
                    <span
                      className="text-sm font-medium"
                      style={{
                        color:
                          data.running_actual_km >= data.running_target_km
                            ? "#22c55e"
                            : "#ef4444",
                      }}
                    >
                      {data.running_actual_km >= data.running_target_km
                        ? "Target hit ✓"
                        : `${(data.running_target_km - data.running_actual_km).toFixed(1)} km to go`}
                    </span>
                  )}
                </div>
                {data.running_target_km != null && data.running_target_km > 0 && (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-raised">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, (data.running_actual_km / data.running_target_km) * 100).toFixed(1)}%`,
                        backgroundColor: "#22c55e",
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Achievements ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy size={16} className="text-sidequest" />
                Achievements Unlocked
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {data.achievements.length === 0 ? (
                <p className="py-4 text-center text-sm text-text-secondary">
                  No achievements yet this week. Go earn one.
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.achievements.map((a) => (
                    <li
                      key={a._id}
                      className="flex items-center justify-between rounded-lg border border-sidequest/20 bg-sidequest/5 px-4 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{a.title}</p>
                        <p className="text-xs text-text-secondary">
                          {fmtDate(a.triggered_at)}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-sidequest">
                        +{a.xp_reward} XP
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* ── Debuffs ── */}
          {data.debuffs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-debuff-warning" />
                  Neglected Pillars
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {data.debuffs.map((d) => (
                  <div
                    key={d.pillar}
                    className="flex items-center justify-between rounded-lg border border-debuff-warning/20 bg-debuff-warning/5 px-4 py-2"
                  >
                    <span className="text-sm font-medium text-text-primary">
                      {d.pillar}
                    </span>
                    <span
                      className="text-xs font-semibold capitalize"
                      style={{
                        color:
                          d.status === "critical" ? "#ef4444" : "#eab308",
                      }}
                    >
                      {d.status} · {Math.round(d.xp_multiplier * 100)}% XP
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ── Nudge ── */}
          <Card className="border-accent/20 bg-accent/5">
            <CardContent className="py-5">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-accent/70">
                Focus for next week
              </p>
              <p className="text-sm text-text-primary">{data.nudge}</p>
            </CardContent>
          </Card>
        </>
      ) : null}
    </main>
  );
}
