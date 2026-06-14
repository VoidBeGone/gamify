"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MetricsNav } from "@/components/metrics/MetricsNav";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorMessage } from "@/components/ui/error-message";
import {
  fetchMetricHistory,
  logMetric,
  type MetricPoint,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const C = {
  grid: "#27272a",
  axis: "#71717a",
  content: "#a855f7",
  target: "#a855f760",
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

const FOLLOWER_TARGET = 10_000;
const TARGET_DATE = new Date("2027-01-01");

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Merges actual follower history with a projected target line
function buildFollowerChart(history: MetricPoint[]) {
  const actual = new Map(
    history.map((p) => [p.logged_at.slice(0, 10), p.value]),
  );

  const dates = [...actual.keys()].sort();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const currentFollowers = actual.get(dates.at(-1) ?? todayStr) ?? 0;

  const msToTarget = TARGET_DATE.getTime() - today.getTime();
  const daysToTarget = Math.max(1, msToTarget / (1000 * 60 * 60 * 24));
  const dailyGrowth = (FOLLOWER_TARGET - currentFollowers) / daysToTarget;

  // Build result: historical points + today + mid-point + target date
  const resultMap = new Map<string, { actual?: number; target?: number }>();

  for (const [date, v] of actual) {
    resultMap.set(date, { actual: v });
  }

  const addTarget = (date: string, daysFromToday: number) => {
    const t = Math.round(currentFollowers + dailyGrowth * daysFromToday);
    const existing = resultMap.get(date) ?? {};
    resultMap.set(date, { ...existing, target: Math.min(t, FOLLOWER_TARGET) });
  };

  addTarget(todayStr, 0);
  const midDate = new Date(today.getTime() + msToTarget / 2);
  addTarget(midDate.toISOString().slice(0, 10), daysToTarget / 2);
  addTarget("2027-01-01", daysToTarget);

  return [...resultMap.entries()]
    .map(([date, vals]) => ({ date, ...vals }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Per-post form row
// ---------------------------------------------------------------------------

interface PostRow {
  id: number;
  title: string;
  date: string;
  views: string;
  likes: string;
  shares: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ContentMetricsPage() {
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [followerHistory, setFollowerHistory] = useState<MetricPoint[]>([]);
  const [postHistory, setPostHistory] = useState<MetricPoint[]>([]);

  // Snapshot form
  const [followers, setFollowers] = useState("");
  const [reelViews, setReelViews] = useState("");
  const [engagementRate, setEngagementRate] = useState("");
  const [snapLoading, setSnapLoading] = useState(false);
  const [snapError, setSnapError] = useState<string | null>(null);

  // Per-post log
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [newPost, setNewPost] = useState<Omit<PostRow, "id">>({
    title: "",
    date: new Date().toISOString().slice(0, 10),
    views: "",
    likes: "",
    shares: "",
  });
  const [postLoading, setPostLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setPageLoading(true);
    setPageError(null);
    try {
      const [fh, ph] = await Promise.all([
        fetchMetricHistory("instagram_followers", 365),
        fetchMetricHistory("instagram_post", 365),
      ]);
      setFollowerHistory(fh);
      setPostHistory(ph);
      const parsed: PostRow[] = ph
        .map((p, i) => {
          try {
            const data = JSON.parse(p.notes ?? "{}") as Partial<PostRow>;
            return {
              id: i,
              title: data.title ?? "Post",
              date: p.logged_at.slice(0, 10),
              views: String(p.value ?? 0),
              likes: String(p.secondary_value ?? 0),
              shares: data.shares ?? "0",
            };
          } catch {
            return null;
          }
        })
        .filter((p): p is PostRow => p !== null)
        .reverse();
      setPosts(parsed);
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Failed to load content data");
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ---------- Snapshot ----------

  async function handleLogSnapshot() {
    const n = parseFloat(followers);
    if (isNaN(n)) return;
    setSnapLoading(true);
    setSnapError(null);
    try {
      const jobs: Promise<unknown>[] = [
        logMetric("instagram_followers", n),
      ];
      if (reelViews)
        jobs.push(logMetric("instagram_reel_views", parseFloat(reelViews)));
      if (engagementRate)
        jobs.push(
          logMetric("instagram_engagement_rate", parseFloat(engagementRate)),
        );
      await Promise.all(jobs);
      setFollowers("");
      setReelViews("");
      setEngagementRate("");
      const updated = await fetchMetricHistory("instagram_followers", 365);
      setFollowerHistory(updated);
      toast.success("Snapshot saved");
    } catch (e) {
      setSnapError(e instanceof Error ? e.message : "Failed to save snapshot");
    } finally {
      setSnapLoading(false);
    }
  }

  // ---------- Per-post ----------

  async function handleAddPost() {
    if (!newPost.title || !newPost.views) return;
    setPostLoading(true);
    try {
      const notes = JSON.stringify({
        title: newPost.title,
        shares: newPost.shares,
      });
      await logMetric("instagram_post", parseFloat(newPost.views) || 0, {
        secondary_value: parseFloat(newPost.likes) || 0,
        notes,
      });
      const updated = await fetchMetricHistory("instagram_post", 365);
      setPostHistory(updated);
      setPosts((prev) => [
        {
          ...newPost,
          id: Date.now(),
        },
        ...prev,
      ]);
      setNewPost({
        title: "",
        date: new Date().toISOString().slice(0, 10),
        views: "",
        likes: "",
        shares: "",
      });
      toast.success("Post added");
    } catch {
      // silent
    } finally {
      setPostLoading(false);
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

  const chartData = buildFollowerChart(followerHistory);

  // Current followers (latest actual point)
  const currentFollowers =
    followerHistory.at(-1)?.value ??
    chartData.find((d) => d.actual != null)?.actual ??
    0;

  const daysLeft = Math.ceil(
    (TARGET_DATE.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <MetricsNav />
        <h1
          className="mt-3 font-display text-2xl font-semibold"
          style={{ color: "#a855f7" }}
        >
          Content
        </h1>
      </div>

      {/* ── Instagram Snapshot ── */}
      <Card>
        <CardHeader>
          <CardTitle>Instagram Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs text-text-secondary">Followers</label>
              <Input
                type="number"
                placeholder="1,234"
                value={followers}
                onChange={(e) => setFollowers(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-text-secondary">
                Avg Reel Views{" "}
                <span className="text-text-secondary/60">(optional)</span>
              </label>
              <Input
                type="number"
                placeholder="5,000"
                value={reelViews}
                onChange={(e) => setReelViews(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-text-secondary">
                Engagement Rate %{" "}
                <span className="text-text-secondary/60">(optional)</span>
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="3.5"
                value={engagementRate}
                onChange={(e) => setEngagementRate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              style={{
                backgroundColor: "#a855f7",
                color: "#0d0d0f",
              }}
              className="hover:opacity-90"
              onClick={handleLogSnapshot}
              disabled={snapLoading || !followers}
            >
              {snapLoading ? "Saving…" : "Log Snapshot"}
            </Button>
            {snapError && (
              <span className="text-sm text-debuff-critical">{snapError}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Follower Growth Chart ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-baseline gap-3">
            Follower Growth
            <span className="text-xs font-normal text-text-secondary">
              Target: 10,000 by Jan 1 2027 ({daysLeft} days left)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {chartData.length < 2 ? (
            <p className="py-8 text-center text-sm text-text-secondary">
              Log at least two snapshots to see the chart
            </p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-text-secondary">
                <span>
                  Current:{" "}
                  <span className="font-semibold" style={{ color: "#a855f7" }}>
                    {currentFollowers.toLocaleString()}
                  </span>
                </span>
                <span>
                  Needed to hit target:{" "}
                  <span className="font-semibold text-text-primary">
                    {Math.max(0, FOLLOWER_TARGET - currentFollowers).toLocaleString()}
                  </span>
                </span>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                  <XAxis dataKey="date" stroke={C.axis} tick={{ fontSize: 11 }} />
                  <YAxis stroke={C.axis} tick={{ fontSize: 11 }} />
                  <Tooltip {...C.tooltip} />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: C.axis }}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke={C.content}
                    strokeWidth={2}
                    dot={{ r: 3, fill: C.content }}
                    name="Actual"
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="target"
                    stroke={C.content}
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Target"
                    opacity={0.5}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Per-Post Log ── */}
      <Card>
        <CardHeader>
          <CardTitle>Per-Post Log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          {/* Add post form */}
          <div className="space-y-3 rounded-lg border border-border bg-surface-raised/40 p-3">
            <p className="text-xs font-medium text-text-secondary">Add Post</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
              <Input
                placeholder="Post title"
                value={newPost.title}
                onChange={(e) => setNewPost((p) => ({ ...p, title: e.target.value }))}
              />
              <Input
                type="date"
                value={newPost.date}
                onChange={(e) => setNewPost((p) => ({ ...p, date: e.target.value }))}
              />
              <Input
                type="number"
                placeholder="Views"
                value={newPost.views}
                onChange={(e) => setNewPost((p) => ({ ...p, views: e.target.value }))}
              />
              <Input
                type="number"
                placeholder="Likes"
                value={newPost.likes}
                onChange={(e) => setNewPost((p) => ({ ...p, likes: e.target.value }))}
              />
              <Input
                type="number"
                placeholder="Shares"
                value={newPost.shares}
                onChange={(e) => setNewPost((p) => ({ ...p, shares: e.target.value }))}
              />
            </div>
            <Button
              style={{ backgroundColor: "#a855f7", color: "#0d0d0f" }}
              className="hover:opacity-90"
              size="sm"
              onClick={handleAddPost}
              disabled={postLoading || !newPost.title || !newPost.views}
            >
              <Plus size={14} /> Add Post
            </Button>
          </div>

          {/* Post table */}
          {posts.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-text-secondary">
                    <th className="pb-2 pr-4 font-medium">Post</th>
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 pr-4 font-medium">Views</th>
                    <th className="pb-2 pr-4 font-medium">Likes</th>
                    <th className="pb-2 font-medium">Shares</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr key={post.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4 font-medium text-text-primary">
                        {post.title}
                      </td>
                      <td className="py-2 pr-4 text-text-secondary">{post.date}</td>
                      <td className="py-2 pr-4" style={{ color: "#a855f7" }}>
                        {parseInt(post.views).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 text-text-secondary">
                        {post.likes || "—"}
                      </td>
                      <td className="py-2 text-text-secondary">
                        {post.shares || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {posts.length === 0 && postHistory.length === 0 && (
            <p className="py-4 text-center text-sm text-text-secondary">
              No posts logged yet
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
