"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { ExternalLink, Scroll } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MetricsNav } from "@/components/metrics/MetricsNav";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorMessage } from "@/components/ui/error-message";
import {
  logSidequest,
  fetchMetricHistory,
  type MetricPoint,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const C = {
  grid: "#27272a",
  axis: "#71717a",
  sidequest: "#f59e0b",
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

interface QuestEntry {
  title: string;
  description?: string;
  link?: string;
  date: string;
}

function parseQuest(metric: MetricPoint): QuestEntry {
  const parts = (metric.notes ?? "").split(" | ");
  return {
    title: parts[0] ?? "Quest",
    description: parts[1],
    link: parts[2],
    date: metric.logged_at.slice(0, 10),
  };
}

function monthLabel(iso: string) {
  return new Date(iso + "-01").toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

function buildFrequencyChart(quests: MetricPoint[]) {
  const counts = new Map<string, number>();
  for (const q of quests) {
    const month = q.logged_at.slice(0, 7); // YYYY-MM
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([month, count]) => ({ month: monthLabel(month), count }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SideQuestsPage() {
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [questHistory, setQuestHistory] = useState<MetricPoint[]>([]);
  const [quests, setQuests] = useState<QuestEntry[]>([]);

  // Form state
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [xp, setXp] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setPageLoading(true);
    setPageError(null);
    try {
      const data = await fetchMetricHistory("sidequest", 365);
      setQuestHistory(data);
      setQuests([...data].reverse().map(parseQuest));
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Failed to load side quests");
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleLogQuest() {
    if (!title.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await logSidequest({
        title: title.trim(),
        description: description.trim() || undefined,
        link: link.trim() || undefined,
        date: date || undefined,
      });
      setXp(result.xp_awarded);
      const updated = await fetchMetricHistory("sidequest", 365);
      setQuestHistory(updated);
      setQuests([...[...updated].reverse().map(parseQuest)]);
      setTitle("");
      setDescription("");
      setLink("");
      setDate(new Date().toISOString().slice(0, 10));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to log quest");
    } finally {
      setLoading(false);
    }
  }

  if (pageLoading) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <MetricsNav />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
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

  const freqData = buildFrequencyChart(questHistory);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <MetricsNav />
        <h1
          className="mt-3 font-display text-2xl font-semibold"
          style={{ color: "#f59e0b" }}
        >
          Side Quests
        </h1>
      </div>

      {/* ── Log Quest Form ── */}
      <Card>
        <CardHeader>
          <CardTitle>Log a Quest</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-text-secondary">Title</label>
              <Input
                placeholder="What did you accomplish?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-text-secondary">Date</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-secondary">Description</label>
            <textarea
              className="h-20 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              placeholder="Describe what you did and why it matters…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-secondary">
              Link{" "}
              <span className="text-text-secondary/60">(optional)</span>
            </label>
            <Input
              placeholder="https://…"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              style={{ backgroundColor: "#f59e0b", color: "#0d0d0f" }}
              className="hover:opacity-90 font-semibold"
              onClick={handleLogQuest}
              disabled={loading || !title.trim()}
            >
              {loading ? "Logging…" : "Log Quest"}
            </Button>
            {xp != null && (
              <span className="text-sm font-semibold" style={{ color: "#f59e0b" }}>
                +{xp} XP
              </span>
            )}
            {error && (
              <span className="text-sm text-debuff-critical">{error}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Quest Frequency Chart ── */}
      <Card>
        <CardHeader>
          <CardTitle>Quest Frequency</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {freqData.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-secondary">
              No quests logged yet
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={freqData}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                <XAxis dataKey="month" stroke={C.axis} tick={{ fontSize: 11 }} />
                <YAxis
                  stroke={C.axis}
                  tick={{ fontSize: 11 }}
                  allowDecimals={false}
                />
                <Tooltip {...C.tooltip} />
                <Bar
                  dataKey="count"
                  fill={C.sidequest}
                  radius={[3, 3, 0, 0]}
                  name="Quests"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Quest History ── */}
      <Card>
        <CardHeader>
          <CardTitle>Quest History</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {quests.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-secondary">
              Your completed quests will appear here
            </p>
          ) : (
            <div className="space-y-3">
              {quests.map((q, i) => (
                <div
                  key={i}
                  className="flex gap-3 rounded-lg border border-border bg-surface-raised/40 p-3"
                >
                  <Scroll
                    size={16}
                    className="mt-0.5 shrink-0"
                    style={{ color: "#f59e0b" }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-medium text-text-primary">{q.title}</span>
                      <span className="text-xs text-text-secondary">{q.date}</span>
                    </div>
                    {q.description && (
                      <p className="mt-1 text-sm text-text-secondary">{q.description}</p>
                    )}
                    {q.link && (
                      <a
                        href={q.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                      >
                        <ExternalLink size={11} /> {q.link}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
