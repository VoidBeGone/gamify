"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Calendar, Target } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ErrorMessage } from "@/components/ui/error-message";
import { cn } from "@/lib/cn";
import {
  fetchGoals,
  createGoal,
  type PillarGroup,
  type GoalItem,
} from "@/lib/api";
import { fmtCalShort } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string) {
  return fmtCalShort(iso);
}

function taskProgress(goal: GoalItem) {
  const total = goal.subgoals.reduce((s, sg) => s + sg.tasks.length, 0);
  const done = goal.subgoals.reduce(
    (s, sg) => s + sg.tasks.filter((t) => t.is_completed).length,
    0,
  );
  return { total, done };
}

// ---------------------------------------------------------------------------
// New Goal Modal
// ---------------------------------------------------------------------------

interface NewGoalModalProps {
  pillars: { _id: string; name: string; color: string }[];
  onClose: () => void;
  onCreated: () => void;
}

function NewGoalModal({ pillars, onClose, onCreated }: NewGoalModalProps) {
  const [pillarId, setPillarId] = useState(pillars[0]?._id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await createGoal({
        pillar_id: pillarId,
        title: title.trim(),
        description: description.trim() || undefined,
        deadline: deadline || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create goal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-5 font-display text-lg font-semibold text-text-primary">
          New Goal
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-text-secondary">Pillar</label>
            <select
              value={pillarId}
              onChange={(e) => setPillarId(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              {pillars.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-secondary">Title</label>
            <Input
              placeholder="What's the goal?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-secondary">
              Description{" "}
              <span className="text-text-secondary/60">(optional)</span>
            </label>
            <Input
              placeholder="What are you working towards?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-secondary">
              Deadline{" "}
              <span className="text-text-secondary/60">(optional)</span>
            </label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-debuff-critical">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex-1"
            >
              {loading ? "Creating…" : "Create Goal"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goal Card
// ---------------------------------------------------------------------------

function GoalCard({
  goal,
  pillarColor,
}: {
  goal: GoalItem;
  pillarColor: string;
}) {
  const { total, done } = taskProgress(goal);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Link href={`/goals/${goal._id}`}>
      <Card className="cursor-pointer transition-colors hover:bg-surface-raised/30">
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">
              {goal.title}
            </p>
            {goal.deadline && (
              <Badge className="shrink-0 bg-surface-raised text-text-secondary">
                <Calendar size={10} />
                {fmtDate(goal.deadline)}
              </Badge>
            )}
          </div>
          {goal.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-text-secondary">
              {goal.description}
            </p>
          )}
          {total > 0 ? (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-xs text-text-secondary">
                <span>
                  {done}/{total} tasks
                </span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: pillarColor,
                  }}
                />
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-text-secondary/50">No tasks yet</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GoalsPage() {
  const [groups, setGroups] = useState<PillarGroup[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setLoading(true);
    fetchGoals()
      .then(setGroups)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load goals"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeGroup = groups[activeIdx];
  const pillars = groups.map((g) => g.pillar);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-text-primary">
          Goals
        </h1>
        <Button
          size="sm"
          onClick={() => setShowModal(true)}
          disabled={pillars.length === 0}
        >
          <Plus size={14} />
          New Goal
        </Button>
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
          {/* Pillar tabs */}
          {groups.length > 0 && (
            <div className="mb-5 flex border-b border-border">
              {groups.map((g, i) => (
                <button
                  key={g.pillar._id}
                  onClick={() => setActiveIdx(i)}
                  className={cn(
                    "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                    activeIdx === i
                      ? "text-text-primary"
                      : "border-transparent text-text-secondary hover:text-text-primary",
                  )}
                  style={
                    activeIdx === i
                      ? { color: g.pillar.color, borderColor: g.pillar.color }
                      : undefined
                  }
                >
                  {g.pillar.name}
                </button>
              ))}
            </div>
          )}

          {/* Goal cards */}
          {activeGroup && (
            <div className="space-y-3">
              {activeGroup.goals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Target
                    size={32}
                    className="mb-3 text-text-secondary/40"
                    style={{ color: activeGroup.pillar.color + "60" }}
                  />
                  <p className="text-sm text-text-secondary">
                    No goals yet for this pillar
                  </p>
                  <button
                    onClick={() => setShowModal(true)}
                    className="mt-2 text-sm font-medium transition-colors hover:text-text-primary"
                    style={{ color: activeGroup.pillar.color }}
                  >
                    Create the first one →
                  </button>
                </div>
              ) : (
                activeGroup.goals.map((goal) => (
                  <GoalCard
                    key={goal._id}
                    goal={goal}
                    pillarColor={activeGroup.pillar.color}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {showModal && (
        <NewGoalModal
          pillars={pillars}
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            toast.success("Goal created");
            fetchGoals().then(setGroups).catch(() => {});
          }}
        />
      )}
    </main>
  );
}
