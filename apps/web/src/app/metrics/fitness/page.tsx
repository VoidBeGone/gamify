"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MetricsNav } from "@/components/metrics/MetricsNav";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorMessage } from "@/components/ui/error-message";
import {
  fetchLatestMetrics,
  fetchMetricHistory,
  fetchExercisePrs,
  fetchTodayWorkout,
  logMetric,
  completeWorkout,
  logRun,
  type LatestMetric,
  type MetricPoint,
  type ExercisePr,
  type TodayWorkout,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const C = {
  grid: "#27272a",
  axis: "#71717a",
  fitness: "#22c55e",
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

function secsToPace(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function latestVal(metrics: LatestMetric[], type: string) {
  return metrics.find((m) => m.metric_type === type)?.value;
}

function isToday(iso: string) {
  return iso.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Body stats row
// ---------------------------------------------------------------------------

interface StatRowProps {
  label: string;
  unit: string;
  metricType: string;
  step?: string;
  latest?: number;
  onLogged: () => void;
}

function StatRow({ label, unit, metricType, step = "0.1", latest, onLogged }: StatRowProps) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);

  async function handleLog() {
    const n = parseFloat(value);
    if (isNaN(n)) return;
    setLoading(true);
    try {
      await logMetric(metricType, n);
      setValue("");
      setOk(true);
      onLogged();
      setTimeout(() => setOk(false), 2000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 text-sm text-text-secondary">{label}</span>
      <Input
        type="number"
        step={step}
        placeholder={latest != null ? String(latest) : "—"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="max-w-28"
        onKeyDown={(e) => e.key === "Enter" && handleLog()}
      />
      <span className="text-xs text-text-secondary">{unit}</span>
      <Button
        size="sm"
        variant="secondary"
        className={ok ? "text-fitness border-fitness/40" : ""}
        onClick={handleLog}
        disabled={loading || !value}
      >
        {ok ? "Saved" : "Log"}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page skeleton
// ---------------------------------------------------------------------------

function FitnessSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-48 rounded-2xl" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exercise row type
// ---------------------------------------------------------------------------

interface ExRow {
  id: number;
  name: string;
  weight: string;
  sets: string;
  reps: string;
  fromTemplate?: boolean;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FitnessMetricsPage() {
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [latest, setLatest] = useState<LatestMetric[]>([]);
  const [weightHistory, setWeightHistory] = useState<MetricPoint[]>([]);
  const [fatHistory, setFatHistory] = useState<MetricPoint[]>([]);
  const [runHistory, setRunHistory] = useState<MetricPoint[]>([]);
  const [prs, setPrs] = useState<ExercisePr[]>([]);

  // Workout logger state
  const [exercises, setExercises] = useState<ExRow[]>([
    { id: 1, name: "", weight: "", sets: "", reps: "" },
  ]);
  const [workoutLoading, setWorkoutLoading] = useState(false);
  const [workoutXp, setWorkoutXp] = useState<number | null>(null);
  const [workoutError, setWorkoutError] = useState<string | null>(null);
  const [todaySession, setTodaySession] = useState<TodayWorkout | null>(null);
  const [isRestDay, setIsRestDay] = useState(false);

  // Run logger state
  const [runDist, setRunDist] = useState("");
  const [runPace, setRunPace] = useState("");
  const [runDur, setRunDur] = useState("");
  const [runNotes, setRunNotes] = useState("");
  const [runLoading, setRunLoading] = useState(false);
  const [runXp, setRunXp] = useState<number | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // Nutrition state
  const [protein, setProtein] = useState("");
  const [calories, setCalories] = useState("");
  const [water, setWater] = useState("");
  const [onPlan, setOnPlan] = useState(false);
  const [nutLoading, setNutLoading] = useState(false);

  const loadLatest = useCallback(async () => {
    try {
      const data = await fetchLatestMetrics();
      setLatest(data);
    } catch {
      // silent refresh
    }
  }, []);

  const loadAll = useCallback(async () => {
    setPageLoading(true);
    setPageError(null);
    try {
      const [latestData, wt, fat, runs, prData, todayW] = await Promise.all([
        fetchLatestMetrics(),
        fetchMetricHistory("body_weight_kg", 90),
        fetchMetricHistory("body_fat_pct", 90),
        fetchMetricHistory("run", 90),
        fetchExercisePrs(),
        fetchTodayWorkout().catch(() => null),
      ]);
      setLatest(latestData);
      setWeightHistory(wt);
      setFatHistory(fat);
      setRunHistory(runs);
      setPrs(prData);

      if (todayW) {
        setIsRestDay(todayW.is_rest_day);
        setTodaySession(todayW);
        if (!todayW.is_rest_day && todayW.session?.exercises?.length) {
          setExercises(
            todayW.session.exercises.map((ex, i) => ({
              id: Date.now() + i,
              name: ex.name,
              weight: "",
              sets: String(ex.sets),
              reps: ex.reps,
              fromTemplate: true,
            }))
          );
        }
      }
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Failed to load fitness data");
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ---------- Workout ----------

  function addExercise() {
    setExercises((prev) => [
      ...prev,
      { id: Date.now(), name: "", weight: "", sets: "", reps: "" },
    ]);
  }

  function removeExercise(id: number) {
    setExercises((prev) => prev.filter((e) => e.id !== id));
  }

  function updateExercise(id: number, field: keyof Omit<ExRow, "id">, val: string) {
    setExercises((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: val } : e)),
    );
  }

  async function handleCompleteWorkout() {
    const valid = exercises
      .filter((e) => e.name.trim() && e.sets && e.reps)
      .map((e) => ({
        name: e.name.trim(),
        sets: parseInt(e.sets, 10),
        reps: e.reps,
        weight: e.weight ? parseFloat(e.weight) : undefined,
      }));
    if (!valid.length) return;
    setWorkoutLoading(true);
    setWorkoutError(null);
    try {
      const result = await completeWorkout(valid);
      setWorkoutXp(result.xp_awarded);
      setExercises([{ id: Date.now(), name: "", weight: "", sets: "", reps: "" }]);
      setTodaySession(null);
      setIsRestDay(false);
      await fetchExercisePrs().then(setPrs).catch(() => {});
    } catch (e) {
      setWorkoutError(e instanceof Error ? e.message : "Failed to log workout");
    } finally {
      setWorkoutLoading(false);
    }
  }

  // ---------- Run ----------

  async function handleLogRun() {
    const dist = parseFloat(runDist);
    if (isNaN(dist)) return;
    setRunLoading(true);
    setRunError(null);
    try {
      const result = await logRun({
        distance_km: dist,
        pace_per_km: runPace || undefined,
        duration_minutes: runDur ? parseFloat(runDur) : undefined,
      });
      setRunXp(result.xp_awarded);
      setRunDist("");
      setRunPace("");
      setRunDur("");
      setRunNotes("");
      const updated = await fetchMetricHistory("run", 90);
      setRunHistory(updated);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Failed to log run");
    } finally {
      setRunLoading(false);
    }
  }

  // ---------- Nutrition ----------

  const todayNut = {
    protein: latest.find((m) => m.metric_type === "nutrition_protein_g" && isToday(m.logged_at)),
    calories: latest.find((m) => m.metric_type === "nutrition_calories_kcal" && isToday(m.logged_at)),
    water: latest.find((m) => m.metric_type === "nutrition_water_ml" && isToday(m.logged_at)),
  };

  async function handleLogNutrition() {
    setNutLoading(true);
    try {
      const jobs: Promise<unknown>[] = [];
      if (protein) jobs.push(logMetric("nutrition_protein_g", parseFloat(protein)));
      if (calories) jobs.push(logMetric("nutrition_calories_kcal", parseFloat(calories)));
      if (water) jobs.push(logMetric("nutrition_water_ml", parseFloat(water)));
      jobs.push(logMetric("nutrition_on_plan", onPlan ? 1 : 0));
      await Promise.all(jobs);
      setProtein("");
      setCalories("");
      setWater("");
      await loadLatest();
      toast.success("Nutrition logged");
    } catch {
      // silent
    } finally {
      setNutLoading(false);
    }
  }

  // ---------- Chart data ----------

  const weightData = weightHistory.map((p) => ({
    date: fmtDate(p.logged_at),
    value: p.value,
  }));

  const fatData = fatHistory.map((p) => ({
    date: fmtDate(p.logged_at),
    value: p.value,
  }));

  const runDistData = runHistory.map((p) => ({
    date: fmtDate(p.logged_at),
    km: p.value,
  }));

  const runPaceData = runHistory
    .filter((p) => p.secondary_value != null)
    .map((p) => ({
      date: fmtDate(p.logged_at),
      seconds: p.secondary_value!,
      label: secsToPace(p.secondary_value!),
    }));

  if (pageLoading) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <MetricsNav />
        <FitnessSkeleton />
      </main>
    );
  }

  if (pageError) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <MetricsNav />
        <div className="mt-4">
          <ErrorMessage message={pageError} onRetry={loadAll} />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <MetricsNav />
        <h1
          className="mt-3 font-display text-2xl font-semibold"
          style={{ color: "#22c55e" }}
        >
          Fitness & Nutrition
        </h1>
      </div>

      {/* ── Body Stats ── */}
      <Card>
        <CardHeader>
          <CardTitle>Body Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <StatRow
            label="Weight"
            unit="lbs"
            metricType="body_weight_kg"
            step="0.1"
            latest={latestVal(latest, "body_weight_kg")}
            onLogged={loadAll}
          />
          <StatRow
            label="Body Fat"
            unit="%"
            metricType="body_fat_pct"
            step="0.1"
            latest={latestVal(latest, "body_fat_pct")}
            onLogged={loadAll}
          />
          <StatRow
            label="Water Weight"
            unit="%"
            metricType="body_water_pct"
            step="0.1"
            latest={latestVal(latest, "body_water_pct")}
            onLogged={loadAll}
          />
        </CardContent>
      </Card>

      {/* ── Workout Logger ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Workout Logger</CardTitle>
            {todaySession && !isRestDay && todaySession.session && (
              <span className="text-xs font-medium text-fitness">
                Today: {todaySession.session.session_type}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          {isRestDay && (
            <p className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-secondary">
              Rest day — but you can still log any activity below.
            </p>
          )}
          <div className="hidden grid-cols-[1fr_80px_60px_80px_36px] gap-2 text-xs text-text-secondary sm:grid">
            <span>Exercise</span>
            <span>Weight (lbs)</span>
            <span>Sets</span>
            <span>Reps</span>
            <span />
          </div>
          {exercises.map((ex) => (
            <div
              key={ex.id}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_80px_60px_80px_36px]"
            >
              <Input
                placeholder="Exercise name"
                value={ex.name}
                onChange={(e) => updateExercise(ex.id, "name", e.target.value)}
              />
              <Input
                type="number"
                placeholder="lbs"
                value={ex.weight}
                onChange={(e) => updateExercise(ex.id, "weight", e.target.value)}
              />
              <Input
                type="number"
                placeholder="Sets"
                value={ex.sets}
                onChange={(e) => updateExercise(ex.id, "sets", e.target.value)}
              />
              <Input
                placeholder="Reps"
                value={ex.reps}
                onChange={(e) => updateExercise(ex.id, "reps", e.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeExercise(ex.id)}
                disabled={exercises.length === 1}
                className="text-text-secondary hover:text-debuff-critical"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button variant="ghost" size="sm" onClick={addExercise}>
              <Plus size={14} /> Add Exercise
            </Button>
            <Button
              className="bg-fitness text-background hover:bg-fitness/90"
              onClick={handleCompleteWorkout}
              disabled={workoutLoading}
            >
              {workoutLoading ? "Logging…" : "Complete Workout"}
            </Button>
            {workoutXp != null && (
              <span className="text-sm font-semibold text-fitness">
                +{workoutXp} XP
              </span>
            )}
            {workoutError && (
              <span className="text-sm text-debuff-critical">{workoutError}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Run Logger ── */}
      <Card>
        <CardHeader>
          <CardTitle>Run Logger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs text-text-secondary">Distance (km)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="5.0"
                value={runDist}
                onChange={(e) => setRunDist(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-text-secondary">Pace (MM:SS/km)</label>
              <Input
                placeholder="5:30"
                value={runPace}
                onChange={(e) => setRunPace(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-text-secondary">Duration (min)</label>
              <Input
                type="number"
                placeholder="30"
                value={runDur}
                onChange={(e) => setRunDur(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-text-secondary">Notes</label>
              <Input
                placeholder="Optional"
                value={runNotes}
                onChange={(e) => setRunNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              className="bg-fitness text-background hover:bg-fitness/90"
              onClick={handleLogRun}
              disabled={runLoading || !runDist}
            >
              {runLoading ? "Logging…" : "Log Run"}
            </Button>
            {runXp != null && (
              <span className="text-sm font-semibold text-fitness">+{runXp} XP</span>
            )}
            {runError && (
              <span className="text-sm text-debuff-critical">{runError}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Nutrition Logger ── */}
      <Card>
        <CardHeader>
          <CardTitle>Nutrition</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          {(todayNut.protein || todayNut.calories || todayNut.water) && (
            <div className="flex flex-wrap gap-4 rounded-lg border border-fitness/20 bg-fitness/5 px-4 py-2 text-sm">
              <span className="text-text-secondary">Today logged:</span>
              {todayNut.protein && (
                <span className="text-fitness">{todayNut.protein.value}g protein</span>
              )}
              {todayNut.calories && (
                <span className="text-fitness">{todayNut.calories.value} kcal</span>
              )}
              {todayNut.water && (
                <span className="text-fitness">{todayNut.water.value} ml water</span>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs text-text-secondary">Protein (g)</label>
              <Input
                type="number"
                placeholder="182"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-text-secondary">Calories</label>
              <Input
                type="number"
                placeholder="2400"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-text-secondary">Water (ml)</label>
              <Input
                type="number"
                placeholder="2000"
                value={water}
                onChange={(e) => setWater(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={onPlan}
                onChange={(e) => setOnPlan(e.target.checked)}
                className="h-4 w-4 rounded accent-fitness"
              />
              On-plan day
            </label>
          </div>
          <div className="flex items-center gap-3">
            <Button
              className="bg-fitness text-background hover:bg-fitness/90"
              onClick={handleLogNutrition}
              disabled={nutLoading || (!protein && !calories && !water)}
            >
              {nutLoading ? "Saving…" : "Log Day"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Body Weight */}
        <Card>
          <CardHeader>
            <CardTitle>Body Weight (lbs)</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {weightData.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-secondary">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weightData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                  <XAxis dataKey="date" stroke={C.axis} tick={{ fontSize: 11 }} />
                  <YAxis stroke={C.axis} tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                  <Tooltip {...C.tooltip} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={C.fitness}
                    strokeWidth={2}
                    dot={false}
                    name="lbs"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Body Fat */}
        <Card>
          <CardHeader>
            <CardTitle>Body Fat (%)</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {fatData.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-secondary">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={fatData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                  <XAxis dataKey="date" stroke={C.axis} tick={{ fontSize: 11 }} />
                  <YAxis stroke={C.axis} tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                  <Tooltip {...C.tooltip} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={C.fitness}
                    strokeWidth={2}
                    dot={false}
                    name="%"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Run Distance */}
        <Card>
          <CardHeader>
            <CardTitle>Running Distance (km)</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {runDistData.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-secondary">No runs logged yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={runDistData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                  <XAxis dataKey="date" stroke={C.axis} tick={{ fontSize: 11 }} />
                  <YAxis stroke={C.axis} tick={{ fontSize: 11 }} />
                  <Tooltip {...C.tooltip} />
                  <Bar dataKey="km" fill={C.fitness} radius={[3, 3, 0, 0]} name="km" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Run Pace — lower is better */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-baseline gap-2">
              Running Pace{" "}
              <span className="text-xs font-normal text-text-secondary">
                (min/km — lower is better)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {runPaceData.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-secondary">No runs with pace logged</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={runPaceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                  <XAxis dataKey="date" stroke={C.axis} tick={{ fontSize: 11 }} />
                  <YAxis
                    stroke={C.axis}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => secsToPace(v)}
                    reversed
                  />
                  <Tooltip
                    {...C.tooltip}
                    formatter={(v) =>
                      typeof v === "number" ? [secsToPace(v), "Pace"] : ["-", "Pace"]
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="seconds"
                    stroke={C.fitness}
                    strokeWidth={2}
                    dot={false}
                    name="Pace"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Exercise PRs ── */}
      <Card>
        <CardHeader>
          <CardTitle>Exercise PRs</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {prs.length === 0 ? (
            <p className="py-4 text-center text-sm text-text-secondary">
              Log workouts with weights to track PRs
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-text-secondary">
                    <th className="pb-2 pr-4 font-medium">Exercise</th>
                    <th className="pb-2 pr-4 font-medium">PR Weight</th>
                    <th className="pb-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {prs.map((pr) => (
                    <tr key={pr.exercise} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4 font-medium text-text-primary">
                        {pr.exercise}
                      </td>
                      <td className="py-2 pr-4 text-fitness font-semibold">
                        {pr.weight_kg} lbs
                      </td>
                      <td className="py-2 text-text-secondary">
                        {fmtDate(pr.date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
