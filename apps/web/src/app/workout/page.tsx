"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Archive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorMessage } from "@/components/ui/error-message";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest_seconds?: number;
  notes?: string;
  exercise_type?: string;
}

interface WorkoutDay {
  day_name: string;
  session_type: string;
  exercises: Exercise[];
}

interface WorkoutTemplate {
  _id: string;
  program_name: string;
  split_type: string;
  days_per_week: number;
  is_active: boolean;
  archived_at?: string;
  created_at: string;
  schedule: WorkoutDay[];
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";

async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      ...opts.headers,
    },
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body.data as T;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DayRow({ day }: { day: WorkoutDay }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-2 text-sm text-text-primary"
      >
        <span className="font-medium">{day.day_name}</span>
        <span className="flex items-center gap-2 text-xs text-text-secondary">
          <span>{day.session_type}</span>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {open && (
        <div className="pb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/40 text-left text-text-secondary">
                <th className="pb-1.5 pr-3 font-medium">Exercise</th>
                <th className="pb-1.5 pr-3 font-medium">Sets</th>
                <th className="pb-1.5 pr-3 font-medium">Reps</th>
                <th className="pb-1.5 font-medium">Rest</th>
              </tr>
            </thead>
            <tbody>
              {day.exercises.map((ex, i) => (
                <tr key={i} className="border-b border-border/20 last:border-0">
                  <td className="py-1 pr-3 text-text-primary">{ex.name}</td>
                  <td className="py-1 pr-3 text-text-secondary">{ex.sets}</td>
                  <td className="py-1 pr-3 text-text-secondary">{ex.reps}</td>
                  <td className="py-1 text-text-secondary">
                    {ex.rest_seconds != null ? `${ex.rest_seconds}s` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {day.exercises.some((e) => e.notes) && (
            <div className="mt-1.5 space-y-0.5">
              {day.exercises
                .filter((e) => e.notes)
                .map((e, i) => (
                  <p key={i} className="text-xs text-text-secondary">
                    <span className="text-text-primary">{e.name}:</span> {e.notes}
                  </p>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProgramCard({ template }: { template: WorkoutTemplate }) {
  const [expanded, setExpanded] = useState(false);
  const dateStr = new Date(template.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const archivedStr = template.archived_at
    ? new Date(template.archived_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <button
        className="flex w-full items-center justify-between"
        onClick={() => setExpanded((o) => !o)}
      >
        <div className="text-left">
          <p className="font-semibold text-text-primary">{template.program_name}</p>
          <p className="text-xs text-text-secondary">
            {template.split_type} · {template.days_per_week}×/week ·{" "}
            {archivedStr ? `${dateStr} → ${archivedStr}` : `Started ${dateStr}`}
          </p>
        </div>
        {expanded ? <ChevronDown size={16} className="text-text-secondary" /> : <ChevronRight size={16} className="text-text-secondary" />}
      </button>
      {expanded && (
        <div className="mt-3 divide-y divide-border/30">
          {template.schedule.map((day, i) => (
            <DayRow key={i} day={day} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WorkoutPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<WorkoutTemplate | null>(null);
  const [history, setHistory] = useState<WorkoutTemplate[]>([]);
  const [archiving, setArchiving] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await apiFetch<WorkoutTemplate[]>("/workout/history");
      const act = all.find((t) => t.is_active) ?? null;
      const past = all.filter((t) => !t.is_active);
      setActive(act);
      setHistory(past);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load workout data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleArchive() {
    setArchiving(true);
    try {
      await apiFetch("/workout/archive", { method: "POST" });
      await load();
      setShowModal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to archive template");
    } finally {
      setArchiving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <ErrorMessage message={error} onRetry={load} />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="font-display text-2xl font-semibold text-text-primary">Workout</h1>

      {/* ── Current Program ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-text-secondary">
          Current Program
        </h2>

        {active ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{active.program_name}</CardTitle>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    {active.split_type} · {active.days_per_week} days/week
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowModal(true)}
                  className="gap-1.5"
                >
                  <Archive size={13} />
                  Archive &amp; Replace
                </Button>
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-border/50 pt-2">
              {active.schedule.map((day, i) => (
                <DayRow key={i} day={day} />
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-text-secondary">No active workout program.</p>
              <p className="mt-2 text-xs text-text-secondary">
                Go to Claude.ai with your MCP connected and say:
              </p>
              <p className="mt-1 rounded-md border border-border bg-surface-raised px-4 py-2 text-xs font-mono text-accent">
                Generate me a new workout routine and save it via set_workout_template
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── Past Programs ── */}
      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-text-secondary">
            Past Programs
          </h2>
          <div className="space-y-3">
            {history.map((t) => (
              <ProgramCard key={t._id} template={t} />
            ))}
          </div>
        </section>
      )}

      {/* ── Archive modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <h3 className="mb-3 font-display text-lg font-semibold text-text-primary">
              Archive &amp; Replace Program
            </h3>
            <p className="mb-4 text-sm text-text-secondary">
              This will archive your current program. Then connect your MCP and say:
            </p>
            <div className="mb-5 rounded-lg border border-border bg-surface-raised px-4 py-3 font-mono text-sm text-accent">
              Generate me a new workout routine and save it via set_workout_template
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                className="bg-fitness text-background hover:bg-fitness/90"
                onClick={handleArchive}
                disabled={archiving}
              >
                {archiving ? "Archiving…" : "Archive Current Program"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
