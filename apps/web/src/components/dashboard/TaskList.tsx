"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useDashboardStore } from "@/store/useDashboardStore";
import { completeTask, removeFromSchedule } from "@/lib/api";
import { toast } from "sonner";
import type { Difficulty, Task } from "@/lib/types";

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  epic: "Epic",
};

function difficultyClasses(d: Difficulty): string {
  switch (d) {
    case "easy":
      return "bg-fitness/15 text-fitness";
    case "medium":
      return "bg-accent/15 text-accent";
    case "hard":
      return "bg-sidequest/15 text-sidequest";
    case "epic":
      return "bg-content/15 text-content";
  }
}

function TaskPopover({
  task,
  onClose,
}: {
  task: Task;
  onClose: () => void;
}) {
  return (
    <>
      {/* backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      {/* popover */}
      <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-border bg-surface p-4 shadow-xl sm:left-auto sm:right-0">
        <p className="mb-2 font-medium text-text-primary">{task.title}</p>
        <div className="space-y-1 text-xs text-text-secondary">
          <div className="flex justify-between">
            <span>Pillar</span>
            <span style={{ color: task.pillar_color }}>{task.pillar_name}</span>
          </div>
          <div className="flex justify-between">
            <span>Difficulty</span>
            <span>{DIFFICULTY_LABEL[task.difficulty]}</span>
          </div>
          <div className="flex justify-between">
            <span>XP reward</span>
            <span className="font-semibold text-accent">+{task.xp}</span>
          </div>
          <div className="flex justify-between">
            <span>Status</span>
            <span>{task.is_completed ? "Completed" : "Pending"}</span>
          </div>
        </div>
      </div>
    </>
  );
}

function TaskRow({ task }: { task: Task }) {
  const markTaskCompleted = useDashboardStore((s) => s.markTaskCompleted);
  const removeTaskFromToday = useDashboardStore((s) => s.removeTaskFromToday);
  const applyXpResult = useDashboardStore((s) => s.applyXpResult);
  const enqueueCelebration = useDashboardStore((s) => s.enqueueCelebration);
  const [pending, setPending] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const checkboxRef = useRef<HTMLDivElement>(null);

  async function handleComplete() {
    if (task.is_completed || pending) return;
    setPending(true);
    markTaskCompleted(task._id);
    try {
      const result = await completeTask(task._id);
      applyXpResult(result, { pillarId: task.pillar_id, pillarColor: task.pillar_color });

      const rect = checkboxRef.current?.getBoundingClientRect();
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
      const y = rect ? rect.top + rect.height / 2 : window.innerHeight * 0.5;

      enqueueCelebration({
        type: "xp_gain",
        data: {
          amount: result.xp_awarded,
          bonuses: result.bonuses_triggered,
          x,
          y,
        },
      });
    } catch {
      // On failure the next dashboard refresh corrects state.
    } finally {
      setPending(false);
    }
  }

  async function handleRemoveFromSchedule() {
    removeTaskFromToday(task._id);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await removeFromSchedule(today, task._id);
      toast.success("Removed from today");
    } catch {
      // On failure the next dashboard refresh corrects state.
    }
  }

  return (
    <div className="relative flex items-center gap-3 py-2">
      <div ref={checkboxRef} className="shrink-0">
        <Checkbox
          checked={task.is_completed}
          onCheck={handleComplete}
          disabled={pending}
          color={task.pillar_color}
          label={`Complete ${task.title}`}
        />
      </div>
      {/* Clickable title area opens popover */}
      <button
        className={`min-w-0 flex-1 truncate text-left text-sm ${
          task.is_completed
            ? "text-text-secondary line-through"
            : "text-text-primary"
        }`}
        onClick={() => setPopoverOpen((o) => !o)}
        title={task.title}
      >
        {task.title}
      </button>
      <Badge className={difficultyClasses(task.difficulty)}>
        {DIFFICULTY_LABEL[task.difficulty]}
      </Badge>
      <Badge className="bg-surface-raised text-text-secondary">+{task.xp}</Badge>
      <button
        type="button"
        onClick={handleRemoveFromSchedule}
        className="shrink-0 text-text-secondary transition-colors hover:text-debuff-critical"
        aria-label={`Remove ${task.title} from today`}
      >
        <X size={14} />
      </button>

      {popoverOpen && (
        <TaskPopover task={task} onClose={() => setPopoverOpen(false)} />
      )}
    </div>
  );
}

export function TaskList() {
  const tasks = useDashboardStore((s) => s.todays_tasks);

  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-secondary">
            No tasks scheduled for today.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group by pillar, preserving first-seen order.
  const groups: {
    pillar_id: string;
    name: string;
    color: string;
    tasks: Task[];
  }[] = [];
  for (const task of tasks) {
    let group = groups.find((g) => g.pillar_id === task.pillar_id);
    if (!group) {
      group = {
        pillar_id: task.pillar_id,
        name: task.pillar_name,
        color: task.pillar_color,
        tasks: [],
      };
      groups.push(group);
    }
    group.tasks.push(task);
  }

  const remaining = tasks.filter((t) => !t.is_completed).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Today&apos;s Tasks</CardTitle>
          <span className="text-xs tabular-nums text-text-secondary">
            {remaining} left
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {groups.map((group) => (
          <div
            key={group.pillar_id}
            className="rounded-lg border-l-2 pl-3"
            style={{ borderColor: group.color }}
          >
            <p
              className="mb-0.5 text-xs font-semibold uppercase tracking-wide"
              style={{ color: group.color }}
            >
              {group.name}
            </p>
            <div className="divide-y divide-border/60">
              {group.tasks.map((task) => (
                <TaskRow key={task._id} task={task} />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
