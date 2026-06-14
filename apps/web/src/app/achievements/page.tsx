"use client";

import { useCallback, useEffect, useState } from "react";
import { Trophy, Lock, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { ErrorMessage } from "@/components/ui/error-message";
import {
  fetchAchievements,
  fetchPillars,
  type AchievementItem,
} from "@/lib/api";
import type { Pillar } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function triggerLabel(metric: string, value: number): string {
  switch (metric) {
    case "followers":
      return `Reach ${value.toLocaleString()} followers`;
    case "video_views":
      return `Get ${value.toLocaleString()} views on a video`;
    case "workouts_logged":
      return `Log ${value} workouts`;
    case "run_distance_km":
      return `Run ${value} km in a single run`;
    case "run_pace_seconds_per_km":
      return `Run sub-${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}/km pace`;
    case "body_fat_pct_delta":
      return `Lose ${value}% body fat`;
    case "lean_mass_gained_lbs":
      return `Gain ${value} lbs lean mass`;
    case "nutrition_streak":
      return `${value}-day nutrition streak`;
    case "lift_weight_kg":
      return `Log a lift PR`;
    default:
      return `${metric} ≥ ${value}`;
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Achievement Card
// ---------------------------------------------------------------------------

function AchievementCard({
  ach,
  color,
}: {
  ach: AchievementItem;
  color: string;
}) {
  if (ach.is_triggered) {
    return (
      <div
        className="relative rounded-2xl border p-4 transition-colors"
        style={{ borderColor: color + "40", backgroundColor: color + "0d" }}
      >
        <span className="absolute -right-1.5 -top-1.5 rounded-full bg-background p-0.5">
          <CheckCircle2 size={16} className="text-fitness" />
        </span>
        <div className="mb-2 flex items-start justify-between gap-2">
          <Trophy size={16} style={{ color, flexShrink: 0, marginTop: 2 }} />
          <span
            className="text-xs font-bold"
            style={{ color }}
          >
            +{ach.xp_reward} XP
          </span>
        </div>
        <p className="mb-0.5 text-sm font-semibold text-text-primary leading-snug">
          {ach.title}
        </p>
        {ach.description && (
          <p className="mb-2 text-xs text-text-secondary leading-snug">
            {ach.description}
          </p>
        )}
        {ach.triggered_at && (
          <p className="text-xs text-text-secondary/70">
            Unlocked {fmtDate(ach.triggered_at)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 opacity-40">
      <div className="mb-2 flex items-start justify-between gap-2">
        <Lock size={14} className="mt-0.5 shrink-0 text-text-secondary" />
        <span className="text-xs font-medium text-text-secondary">
          {ach.xp_reward} XP
        </span>
      </div>
      <p className="mb-1 text-sm font-semibold text-text-primary leading-snug">
        {ach.title}
      </p>
      {ach.description && (
        <p className="mb-1.5 text-xs text-text-secondary leading-snug">
          {ach.description}
        </p>
      )}
      <p className="text-xs text-text-secondary/70">
        {triggerLabel(ach.trigger_metric, ach.trigger_value)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [activeTab, setActiveTab] = useState<string>("global");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setLoading(true);
    Promise.all([fetchAchievements(), fetchPillars()])
      .then(([achs, pils]) => {
        setAchievements(achs);
        setPillars(pils);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load achievements"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Build tab list: Global first, then each pillar that has achievements
  const pillarById = new Map(pillars.map((p) => [p._id, p]));

  const pillarTabs = pillars.filter((p) =>
    achievements.some((a) => a.pillar_id === p._id),
  );

  const activeAchs =
    activeTab === "global"
      ? achievements.filter((a) => !a.pillar_id)
      : achievements.filter((a) => a.pillar_id === activeTab);

  const unlocked = activeAchs.filter((a) => a.is_triggered).length;
  const total = activeAchs.length;

  const activeColor =
    activeTab === "global"
      ? "#3b82f6"
      : (pillarById.get(activeTab)?.color ?? "#71717a");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-text-primary">
          Achievements
        </h1>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorMessage message={error} onRetry={load} />
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-surface-raised"
            />
          ))}
        </div>
      ) : (
        <>
          {/* ── Tabs ── */}
          <div className="mb-2 flex overflow-x-auto border-b border-border">
            <button
              onClick={() => setActiveTab("global")}
              className={cn(
                "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                activeTab === "global"
                  ? "border-accent text-accent"
                  : "border-transparent text-text-secondary hover:text-text-primary",
              )}
            >
              Global
            </button>
            {pillarTabs.map((p) => (
              <button
                key={p._id}
                onClick={() => setActiveTab(p._id)}
                className={cn(
                  "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                  activeTab === p._id
                    ? "border-transparent text-text-primary"
                    : "border-transparent text-text-secondary hover:text-text-primary",
                )}
                style={
                  activeTab === p._id
                    ? { color: p.color, borderColor: p.color }
                    : undefined
                }
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* ── Count badge + legend ── */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <span
              className="rounded-full px-3 py-0.5 text-xs font-semibold"
              style={{
                backgroundColor: activeColor + "20",
                color: activeColor,
              }}
            >
              {unlocked} / {total} unlocked
            </span>
            <span className="flex items-center gap-1 rounded-full border border-fitness/30 bg-fitness/10 px-2.5 py-0.5 text-xs font-medium text-fitness">
              <CheckCircle2 size={11} /> Unlocked
            </span>
            <span className="flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-text-secondary opacity-60">
              <Lock size={11} /> Locked
            </span>
          </div>

          {/* ── Grid ── */}
          {total === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Trophy
                  size={32}
                  className="mb-3"
                  style={{ color: activeColor + "60" }}
                />
                <p className="text-sm text-text-secondary">
                  No achievements in this category yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {/* Unlocked first */}
              {[
                ...activeAchs.filter((a) => a.is_triggered),
                ...activeAchs.filter((a) => !a.is_triggered),
              ].map((ach) => (
                <AchievementCard
                  key={ach._id}
                  ach={ach}
                  color={activeColor}
                />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
