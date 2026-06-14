"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/cn";
import type { Difficulty } from "@/lib/types";
import { toast } from "sonner";
import { ErrorMessage } from "@/components/ui/error-message";
import {
  fetchGoal,
  completeTask,
  uncompleteTask,
  completeSubgoal,
  createSubgoal,
  createTask,
  deleteTask,
  deleteSubgoal,
  deleteGoal,
  type GoalItem,
  type GoalSubgoal,
  type GoalTask,
} from "@/lib/api";
import { useDashboardStore } from "@/store/useDashboardStore";
import { fmtCalShort, fmtCalLong } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const XP_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 10,
  medium: 25,
  hard: 50,
  epic: 100,
};

const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  easy: "#22c55e",
  medium: "#f59e0b",
  hard: "#f97316",
  epic: "#a855f7",
};

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "epic"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string) {
  return fmtCalLong(iso);
}

function fmtShort(iso: string) {
  return fmtCalShort(iso);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Difficulty badge
// ---------------------------------------------------------------------------

function DiffBadge({ difficulty }: { difficulty: Difficulty }) {
  const color = DIFFICULTY_COLOR[difficulty];
  return (
    <Badge style={{ backgroundColor: color + "22", color }}>
      {difficulty}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Difficulty select (shared)
// ---------------------------------------------------------------------------

function DiffSelect({
  value,
  onChange,
  showXp,
}: {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
  showXp?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Difficulty)}
        className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        {DIFFICULTIES.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      {showXp && (
        <Badge
          style={{
            backgroundColor: DIFFICULTY_COLOR[value] + "22",
            color: DIFFICULTY_COLOR[value],
          }}
        >
          {XP_BY_DIFFICULTY[value]} XP
        </Badge>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task row
// ---------------------------------------------------------------------------

function TaskRow({
  task,
  pillarColor,
  onComplete,
  onUncomplete,
  onDelete,
}: {
  task: GoalTask;
  pillarColor: string;
  onComplete: (checkboxRect: DOMRect | null) => void;
  onUncomplete: () => void;
  onDelete: () => void;
}) {
  const checkboxRef = useRef<HTMLDivElement>(null);

  function handleCheck() {
    const rect = checkboxRef.current?.getBoundingClientRect() ?? null;
    onComplete(rect);
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-3 border-b border-border/30 py-2 last:border-0",
        task.is_completed && "opacity-50",
      )}
    >
      <div ref={checkboxRef}>
        <Checkbox
          checked={task.is_completed}
          onCheck={handleCheck}
          onUncheck={onUncomplete}
          color={pillarColor}
          label={`Complete ${task.title}`}
        />
      </div>
      <span
        className={cn(
          "min-w-0 flex-1 text-sm text-text-primary",
          task.is_completed && "line-through",
        )}
      >
        {task.title}
      </span>
      <div className="flex shrink-0 items-center gap-2 text-xs">
        {task.scheduled_date && (
          <span className="text-text-secondary">{fmtShort(task.scheduled_date)}</span>
        )}
        <Badge
          style={{
            backgroundColor: DIFFICULTY_COLOR[task.difficulty] + "22",
            color: DIFFICULTY_COLOR[task.difficulty],
          }}
        >
          +{task.base_xp} XP
        </Badge>
        <button
          type="button"
          onClick={onDelete}
          className="text-text-secondary opacity-0 transition-opacity hover:text-debuff-critical group-hover:opacity-100 sm:opacity-100"
          aria-label={`Delete ${task.title}`}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Task inline form
// ---------------------------------------------------------------------------

function AddTaskForm({
  subgoalId,
  onAdded,
  onCancel,
}: {
  subgoalId: string;
  onAdded: (task: GoalTask) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const task = await createTask({
        subgoal_id: subgoalId,
        title: title.trim(),
        difficulty,
        scheduled_date: date || undefined,
      });
      onAdded(task);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add task");
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 space-y-2 rounded-lg border border-border/60 bg-surface/40 p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-0 flex-1 text-sm"
          autoFocus
        />
        <DiffSelect value={difficulty} onChange={setDifficulty} showXp />
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-36 text-sm"
        />
        <Button type="submit" size="sm" disabled={saving || !title.trim()}>
          {saving ? "…" : "Add"}
        </Button>
      </div>
      {error && <p className="text-xs text-debuff-critical">{error}</p>}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onCancel}
        className="text-xs"
      >
        Cancel
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Subgoal item
// ---------------------------------------------------------------------------

function SubgoalItem({
  subgoal,
  pillarColor,
  onTaskComplete,
  onTaskUncomplete,
  onTaskAdded,
  onTaskDelete,
  onDelete,
}: {
  subgoal: GoalSubgoal;
  pillarColor: string;
  onTaskComplete: (taskId: string, rect: DOMRect | null) => void;
  onTaskUncomplete: (taskId: string) => void;
  onTaskAdded: (subgoalId: string, task: GoalTask) => void;
  onTaskDelete: (taskId: string) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showTaskForm, setShowTaskForm] = useState(false);

  const isDone = subgoal.status === "completed";

  function statusBadgeClass() {
    if (subgoal.status === "completed")
      return "bg-[#22c55e22] text-[#22c55e]";
    if (subgoal.status === "in_progress")
      return "bg-accent/15 text-accent";
    return "bg-surface-raised text-text-secondary";
  }

  function statusLabel() {
    if (subgoal.status === "completed") return "Done";
    if (subgoal.status === "in_progress") return "In Progress";
    return "Pending";
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface-raised/30",
        isDone && "opacity-50",
      )}
    >
      {/* Header */}
      <div className="group flex items-center gap-2.5 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          {expanded ? (
            <ChevronDown size={13} className="shrink-0 text-text-secondary" />
          ) : (
            <ChevronRight size={13} className="shrink-0 text-text-secondary" />
          )}
          <span
            className={cn(
              "min-w-0 flex-1 text-sm font-medium text-text-primary",
              isDone && "line-through",
            )}
          >
            {subgoal.title}
          </span>
        </button>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <DiffBadge difficulty={subgoal.difficulty} />
          {subgoal.deadline && (
            <Badge className="bg-surface text-text-secondary">
              <Calendar size={9} />
              {fmtShort(subgoal.deadline)}
            </Badge>
          )}
          <Badge className={statusBadgeClass()}>{statusLabel()}</Badge>
          <button
            type="button"
            onClick={onDelete}
            className="ml-1 text-text-secondary opacity-0 transition-opacity hover:text-debuff-critical group-hover:opacity-100 sm:opacity-100"
            aria-label={`Delete subgoal ${subgoal.title}`}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Expanded: task list + add task */}
      {expanded && (
        <div className="border-t border-border/40 px-4 pb-3 pt-2">
          {subgoal.tasks.length === 0 && !showTaskForm && (
            <p className="py-1.5 text-xs text-text-secondary">No tasks yet</p>
          )}

          {subgoal.tasks.map((task) => (
            <TaskRow
              key={task._id}
              task={task}
              pillarColor={pillarColor}
              onComplete={(rect) => onTaskComplete(task._id, rect)}
              onUncomplete={() => onTaskUncomplete(task._id)}
              onDelete={() => onTaskDelete(task._id)}
            />
          ))}

          {showTaskForm ? (
            <AddTaskForm
              subgoalId={subgoal._id}
              onAdded={(task) => {
                onTaskAdded(subgoal._id, task);
                setShowTaskForm(false);
              }}
              onCancel={() => setShowTaskForm(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowTaskForm(true)}
              className="mt-2 flex items-center gap-1.5 text-xs text-text-secondary transition-colors hover:text-text-primary"
            >
              <Plus size={11} />
              Add task
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Subgoal inline form
// ---------------------------------------------------------------------------

function AddSubgoalForm({
  onAdded,
  onCancel,
  goalId,
}: {
  goalId: string;
  onAdded: (subgoal: GoalSubgoal) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const subgoal = await createSubgoal({
        goal_id: goalId,
        title: title.trim(),
        difficulty,
        deadline: deadline || undefined,
      });
      onAdded(subgoal);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add subgoal",
      );
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-accent/30 bg-surface-raised/40 p-4"
    >
      <p className="mb-3 text-xs font-medium text-text-secondary">
        New Subgoal
      </p>
      <div className="space-y-3">
        <Input
          placeholder="Subgoal title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <div className="flex flex-wrap items-center gap-3">
          <DiffSelect value={difficulty} onChange={setDifficulty} showXp />
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-secondary">Deadline</label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-36 text-sm"
            />
          </div>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-debuff-critical">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button type="submit" size="sm" disabled={saving || !title.trim()}>
          {saving ? "Adding…" : "Add Subgoal"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GoalDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const applyXpResult = useDashboardStore((s) => s.applyXpResult);
  const revertXp = useDashboardStore((s) => s.revertXp);
  const enqueueCelebration = useDashboardStore((s) => s.enqueueCelebration);
  const storePillars = useDashboardStore((s) => s.pillars);

  const [goal, setGoal] = useState<GoalItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSubgoalForm, setShowSubgoalForm] = useState(false);

  // Delete confirmation state
  const [deleteGoalConfirm, setDeleteGoalConfirm] = useState(false);
  const [deleteSubgoalId, setDeleteSubgoalId] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setLoading(true);
    fetchGoal(id)
      .then(setGoal)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load goal"),
      )
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const pillar = storePillars.find((p) => p._id === goal?.pillar_id);
  const pillarColor = pillar?.color ?? "#3b82f6";
  const pillarName = pillar?.name ?? "";

  // -- Mutations --

  async function handleTaskComplete(taskId: string, rect: DOMRect | null) {
    if (!goal) return;
    // Optimistic update
    setGoal((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        subgoals: prev.subgoals.map((sg) => ({
          ...sg,
          tasks: sg.tasks.map((t) =>
            t._id === taskId ? { ...t, is_completed: true } : t,
          ),
        })),
      };
    });
    try {
      const result = await completeTask(taskId);
      applyXpResult(result, {
        pillarId: goal.pillar_id,
        pillarColor,
      });
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
      const y = rect ? rect.top + rect.height / 2 : window.innerHeight * 0.4;
      enqueueCelebration({
        type: "xp_gain",
        data: { amount: result.xp_awarded, bonuses: result.bonuses_triggered, x, y },
      });
    } catch {
      // Revert
      setGoal((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          subgoals: prev.subgoals.map((sg) => ({
            ...sg,
            tasks: sg.tasks.map((t) =>
              t._id === taskId ? { ...t, is_completed: false } : t,
            ),
          })),
        };
      });
    }
  }

  async function handleTaskUncomplete(taskId: string) {
    if (!goal) return;
    setGoal((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        subgoals: prev.subgoals.map((sg) => ({
          ...sg,
          tasks: sg.tasks.map((t) =>
            t._id === taskId ? { ...t, is_completed: false, completed_at: undefined } : t,
          ),
        })),
      };
    });
    try {
      const { xp_reverted } = await uncompleteTask(taskId);
      revertXp(xp_reverted, goal.pillar_id);
    } catch {
      setGoal((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          subgoals: prev.subgoals.map((sg) => ({
            ...sg,
            tasks: sg.tasks.map((t) =>
              t._id === taskId ? { ...t, is_completed: true } : t,
            ),
          })),
        };
      });
    }
  }

  function handleTaskAdded(subgoalId: string, task: GoalTask) {
    setGoal((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        subgoals: prev.subgoals.map((sg) =>
          sg._id === subgoalId ? { ...sg, tasks: [...sg.tasks, task] } : sg,
        ),
      };
    });
  }

  function handleSubgoalAdded(subgoal: GoalSubgoal) {
    setGoal((prev) => {
      if (!prev) return prev;
      return { ...prev, subgoals: [...prev.subgoals, subgoal] };
    });
    setShowSubgoalForm(false);
    toast.success("Subgoal added");
  }

  async function handleGoalDelete() {
    if (!goal) return;
    try {
      await deleteGoal(goal._id);
      router.push("/goals");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete goal");
    }
  }

  async function handleSubgoalDelete(subgoalId: string) {
    try {
      await deleteSubgoal(subgoalId);
      setGoal((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          subgoals: prev.subgoals.filter((sg) => sg._id !== subgoalId),
        };
      });
      toast.success("Subgoal deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete subgoal");
    }
  }

  async function handleTaskDelete(taskId: string) {
    setGoal((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        subgoals: prev.subgoals.map((sg) => ({
          ...sg,
          tasks: sg.tasks.filter((t) => t._id !== taskId),
        })),
      };
    });
    try {
      await deleteTask(taskId);
    } catch (err) {
      // Revert optimistic removal
      load();
      toast.error(err instanceof Error ? err.message : "Failed to delete task");
    }
  }

  // -- Render --

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-8 h-5 w-16 animate-pulse rounded bg-surface-raised" />
        <div className="space-y-3">
          <div className="h-8 w-2/3 animate-pulse rounded-lg bg-surface-raised" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-surface-raised" />
          <div className="mt-6 h-24 animate-pulse rounded-xl bg-surface-raised" />
          <div className="h-24 animate-pulse rounded-xl bg-surface-raised" />
        </div>
      </main>
    );
  }

  if (error || !goal) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href="/goals"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={14} /> Goals
        </Link>
        <div className="mt-4">
          <ErrorMessage message={error ?? "Goal not found"} onRetry={error ? load : undefined} />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Back */}
      <Link
        href="/goals"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
      >
        <ArrowLeft size={14} /> Goals
      </Link>

      {/* Goal header */}
      <div className="mb-8 mt-2">
        <div className="flex flex-wrap items-start gap-3">
          <h1 className="flex-1 font-display text-2xl font-semibold text-text-primary">
            {goal.title}
          </h1>
          {pillarName && (
            <Badge
              style={{
                backgroundColor: pillarColor + "22",
                color: pillarColor,
              }}
            >
              {pillarName}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteGoalConfirm(true)}
            className="gap-1.5 text-text-secondary hover:text-debuff-critical"
          >
            <Trash2 size={14} />
            Delete Goal
          </Button>
        </div>
        {goal.deadline && (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-text-secondary">
            <Calendar size={13} />
            Due {fmtDate(goal.deadline)}
          </p>
        )}
        {goal.description && (
          <p className="mt-2 text-sm text-text-secondary">{goal.description}</p>
        )}
      </div>

      {/* Subgoals section */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
          Subgoals
        </h2>

        {goal.subgoals.length === 0 && !showSubgoalForm && (
          <p className="py-2 text-sm text-text-secondary">
            No subgoals yet — add one below.
          </p>
        )}

        {goal.subgoals.map((subgoal) => (
          <SubgoalItem
            key={subgoal._id}
            subgoal={subgoal}
            pillarColor={pillarColor}
            onTaskComplete={handleTaskComplete}
            onTaskUncomplete={handleTaskUncomplete}
            onTaskAdded={handleTaskAdded}
            onTaskDelete={handleTaskDelete}
            onDelete={() => setDeleteSubgoalId(subgoal._id)}
          />
        ))}

        {showSubgoalForm ? (
          <AddSubgoalForm
            goalId={goal._id}
            onAdded={handleSubgoalAdded}
            onCancel={() => setShowSubgoalForm(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowSubgoalForm(true)}
            className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-text-secondary transition-colors hover:border-border/80 hover:text-text-primary"
          >
            <Plus size={14} />
            Add Subgoal
          </button>
        )}
      </div>

      <ConfirmDialog
        open={deleteGoalConfirm}
        title="Delete this goal?"
        description="This will delete the goal and all its subgoals and tasks. This cannot be undone."
        confirmLabel="Delete Goal"
        destructive
        onConfirm={() => {
          setDeleteGoalConfirm(false);
          void handleGoalDelete();
        }}
        onCancel={() => setDeleteGoalConfirm(false)}
      />

      <ConfirmDialog
        open={deleteSubgoalId !== null}
        title="Delete this subgoal?"
        description="This will delete the subgoal and all its tasks. This cannot be undone."
        confirmLabel="Delete Subgoal"
        destructive
        onConfirm={() => {
          const sid = deleteSubgoalId;
          setDeleteSubgoalId(null);
          if (sid) void handleSubgoalDelete(sid);
        }}
        onCancel={() => setDeleteSubgoalId(null)}
      />
    </main>
  );
}
