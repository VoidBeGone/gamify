"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorMessage } from "@/components/ui/error-message";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkoutExercise {
  name: string;
  weight?: number;
  sets?: number;
  reps?: string;
}

interface WorkoutDay {
  date: string;
  session_type: string;
  exercises: WorkoutExercise[];
  volume: number;
}

interface NutritionMeal {
  name: string;
  protein_g: number;
  calories: number;
}

interface NutritionDay {
  date: string;
  meals: NutritionMeal[];
  protein_g: number;
  calories: number;
  on_plan: boolean;
  protein_target_hit: boolean;
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

const SESSION_COLORS: Record<string, string> = {
  Push: "#ef4444",
  Pull: "#3b82f6",
  Legs: "#22c55e",
  Upper: "#a855f7",
  Conditioning: "#f59e0b",
  Training: "#71717a",
};

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// ---------------------------------------------------------------------------
// Calendar grid
// ---------------------------------------------------------------------------

interface CalendarProps<T> {
  year: number;
  month: number;
  dataByDate: Map<string, T>;
  renderDot: (item: T) => React.ReactNode;
  onSelect: (key: string, item: T | undefined) => void;
  selectedKey: string | null;
}

function CalendarGrid<T>({ year, month, dataByDate, renderDot, onSelect, selectedKey }: CalendarProps<T>) {
  const firstDay = startOfMonth(year, month);
  const totalDays = daysInMonth(year, month);
  const startDow = firstDay.getDay(); // 0=Sun

  const cells: (number | null)[] = Array(startDow).fill(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div>
      <div className="grid grid-cols-7 gap-px text-center text-xs text-text-secondary">
        {DOW.map((d) => (
          <div key={d} className="py-1 font-medium">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const item = dataByDate.get(key);
          const isSelected = selectedKey === key;
          const isToday = key === dayKey(new Date());

          return (
            <button
              key={i}
              onClick={() => onSelect(key, item)}
              className={`flex min-h-[52px] flex-col items-center rounded-lg border p-1 transition-colors ${
                isSelected
                  ? "border-accent bg-accent/10"
                  : isToday
                  ? "border-border bg-surface-raised"
                  : "border-transparent hover:border-border hover:bg-surface-raised"
              }`}
            >
              <span
                className={`text-xs ${
                  isToday ? "font-semibold text-accent" : "text-text-secondary"
                }`}
              >
                {day}
              </span>
              {item && <div className="mt-1">{renderDot(item)}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workout tab
// ---------------------------------------------------------------------------

function WorkoutTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutDay[]>([]);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [panel, setPanel] = useState<WorkoutDay | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<WorkoutDay[]>("/history/workouts");
      setWorkouts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load workout history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byDate = new Map(workouts.map((w) => [w.date, w]));

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); } else setMonth((m) => m + 1);
  }

  function handleSelect(key: string, item: WorkoutDay | undefined) {
    setSelectedKey(key);
    setPanel(item ?? null);
    setPanelOpen(!!item);
  }

  if (loading) return <Skeleton className="h-64 rounded-2xl" />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  const monthName = new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="rounded-md p-1 text-text-secondary hover:text-text-primary">
          <ChevronLeft size={18} />
        </button>
        <span className="font-medium text-text-primary">{monthName}</span>
        <button onClick={nextMonth} className="rounded-md p-1 text-text-secondary hover:text-text-primary">
          <ChevronRight size={18} />
        </button>
      </div>

      <CalendarGrid
        year={year}
        month={month}
        dataByDate={byDate}
        renderDot={(w) => (
          <span
            className="block h-2 w-2 rounded-full"
            style={{ backgroundColor: SESSION_COLORS[w.session_type] ?? SESSION_COLORS.Training }}
            title={w.session_type}
          />
        )}
        onSelect={handleSelect}
        selectedKey={selectedKey}
      />

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-text-secondary">
        {Object.entries(SESSION_COLORS)
          .filter(([k]) => k !== "Training")
          .map(([label, color]) => (
            <span key={label} className="flex items-center gap-1">
              <span className="block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              {label}
            </span>
          ))}
      </div>

      {/* Side panel */}
      {panelOpen && panel && (
        <Card className="border-border">
          <CardContent className="pt-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-text-primary">{panel.session_type}</p>
                <p className="text-xs text-text-secondary">
                  {new Date(panel.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </p>
              </div>
              <button
                onClick={() => setPanelOpen(false)}
                className="text-xs text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-secondary">
                  <th className="pb-1.5 pr-3 text-left font-medium">Exercise</th>
                  <th className="pb-1.5 pr-3 text-left font-medium">Weight (lbs)</th>
                  <th className="pb-1.5 pr-3 text-left font-medium">Sets</th>
                  <th className="pb-1.5 text-left font-medium">Reps</th>
                </tr>
              </thead>
              <tbody>
                {panel.exercises.map((ex, i) => (
                  <tr key={i} className="border-b border-border/40 last:border-0">
                    <td className="py-1.5 pr-3 text-text-primary">{ex.name}</td>
                    <td className="py-1.5 pr-3 text-text-secondary">{ex.weight ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-text-secondary">{ex.sets ?? "—"}</td>
                    <td className="py-1.5 text-text-secondary">{ex.reps ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {panel.volume > 0 && (
              <p className="mt-3 text-xs text-text-secondary">
                Total volume: <span className="font-semibold text-text-primary">{panel.volume.toLocaleString()} lbs</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nutrition tab
// ---------------------------------------------------------------------------

function NutritionTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<NutritionDay[]>([]);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [panel, setPanel] = useState<NutritionDay | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<NutritionDay[]>("/history/nutrition");
      setDays(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load nutrition history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byDate = new Map(days.map((d) => [d.date, d]));

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); } else setMonth((m) => m + 1);
  }

  function handleSelect(key: string, item: NutritionDay | undefined) {
    setSelectedKey(key);
    setPanel(item ?? null);
    setPanelOpen(!!item);
  }

  if (loading) return <Skeleton className="h-64 rounded-2xl" />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  const monthName = new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const PROTEIN_TARGET = 175;

  function dotColor(d: NutritionDay): string {
    if (d.protein_g >= PROTEIN_TARGET) return "#22c55e";
    if (d.protein_g >= PROTEIN_TARGET * 0.7) return "#f59e0b";
    return "#ef4444";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="rounded-md p-1 text-text-secondary hover:text-text-primary">
          <ChevronLeft size={18} />
        </button>
        <span className="font-medium text-text-primary">{monthName}</span>
        <button onClick={nextMonth} className="rounded-md p-1 text-text-secondary hover:text-text-primary">
          <ChevronRight size={18} />
        </button>
      </div>

      <CalendarGrid
        year={year}
        month={month}
        dataByDate={byDate}
        renderDot={(d) => (
          <span
            className="block h-2 w-2 rounded-full"
            style={{ backgroundColor: dotColor(d) }}
          />
        )}
        onSelect={handleSelect}
        selectedKey={selectedKey}
      />

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-text-secondary">
        <span className="flex items-center gap-1"><span className="block h-2 w-2 rounded-full bg-[#22c55e]" /> Hit target</span>
        <span className="flex items-center gap-1"><span className="block h-2 w-2 rounded-full bg-[#f59e0b]" /> Partial</span>
        <span className="flex items-center gap-1"><span className="block h-2 w-2 rounded-full bg-[#ef4444]" /> Missed</span>
      </div>

      {panelOpen && panel && (
        <Card>
          <CardContent className="pt-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-text-primary">
                  {new Date(panel.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </p>
                <p className="text-xs text-text-secondary">
                  {panel.protein_g}g protein · {panel.calories.toLocaleString()} kcal ·{" "}
                  <span className={panel.protein_target_hit ? "text-[#22c55e]" : "text-[#f59e0b]"}>
                    {panel.protein_target_hit ? "Target hit" : "Target missed"}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setPanelOpen(false)}
                className="text-xs text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>
            {panel.meals.length > 0 ? (
              <div className="space-y-1">
                {panel.meals.map((m, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-border/40 py-1.5 last:border-0">
                    <span className="text-sm text-text-primary">{m.name}</span>
                    <span className="text-xs text-text-secondary">
                      {m.protein_g}g · {m.calories} kcal
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-sm font-semibold text-text-primary">Total</span>
                  <span className="text-xs font-semibold text-text-primary">
                    {panel.protein_g}g protein · {panel.calories.toLocaleString()} kcal
                  </span>
                </div>
                <p className="text-xs text-text-secondary">
                  Target: {PROTEIN_TARGET}g protein
                </p>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">No meal-level data logged.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HistoryPage() {
  const [tab, setTab] = useState<"workouts" | "nutrition">("workouts");

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="font-display text-2xl font-semibold text-text-primary">History</h1>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-surface-raised p-1">
        {(["workouts", "nutrition"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t === "workouts" ? "Workouts" : "Nutrition"}
          </button>
        ))}
      </div>

      {tab === "workouts" ? <WorkoutTab /> : <NutritionTab />}
    </main>
  );
}
