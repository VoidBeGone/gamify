/**
 * Scheduling & progress tools — the "intelligence layer".
 *
 * The read-side functions are exported individually so the weekly-schedule
 * prompt can gather the same context without round-tripping through MCP.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  api,
  resolvePillar,
  getPillars,
  PILLAR,
  type Streak,
  type MetricLatest,
  type MetricLog,
} from '../api.js';
import { tool, formatPace, formatDate, daysUntil } from '../format.js';

// ---------------------------------------------------------------------------
// Context gatherers (reused by the weekly-schedule prompt)
// ---------------------------------------------------------------------------

export async function getProgressSummary(): Promise<string> {
  const [pillars, streaks, latest] = await Promise.all([
    getPillars(),
    api.get<Streak[]>('/streaks'),
    api.get<MetricLatest[]>('/metrics/latest'),
  ]);

  const lines: string[] = ['📊 PROGRESS SUMMARY', ''];

  lines.push('Pillars:');
  for (const p of pillars) {
    const debuff =
      p.neglect_status === 'healthy'
        ? ''
        : ` — ⚠️ ${p.neglect_status} (XP ×${p.xp_multiplier})`;
    lines.push(`  • ${p.name}: ${p.xp} XP, ${p.rank_name} (tier ${p.rank_tier})${debuff}`);
  }

  lines.push('', 'Streaks:');
  const active = streaks.filter((s) => s.current_streak > 0);
  if (!active.length) lines.push('  • none active');
  for (const s of active) {
    lines.push(`  • ${s.streak_type}: ${s.current_streak}🔥 (best ${s.longest_streak})`);
  }

  lines.push('', 'Latest metrics:');
  if (!latest.length) lines.push('  • none logged yet');
  for (const m of latest) {
    const sec = m.secondary_value != null ? ` / ${m.secondary_value}` : '';
    lines.push(`  • ${m.metric_type}: ${m.value}${sec} (${formatDate(m.logged_at)})`);
  }

  return lines.join('\n');
}

interface GoalGroup {
  pillar: { _id: string; name: string };
  goals: {
    _id: string;
    title: string;
    deadline?: string;
    status: string;
    subgoals: { status: string; tasks: { is_completed: boolean }[] }[];
  }[];
}

export async function getGoalDeadlines(): Promise<string> {
  const groups = await api.get<GoalGroup[]>('/goals');
  const lines: string[] = ['🎯 GOAL DEADLINES', ''];

  let any = false;
  for (const group of groups) {
    const activeGoals = group.goals.filter((g) => g.status === 'active');
    if (!activeGoals.length) continue;
    lines.push(`${group.pillar.name}:`);
    for (const g of activeGoals) {
      any = true;
      const subs = g.subgoals ?? [];
      const total = subs.length;
      const done = subs.filter((s) => s.status === 'completed').length;
      const pct = total ? Math.round((done / total) * 100) : 0;
      const dleft = daysUntil(g.deadline);
      const deadlineStr = g.deadline
        ? ` — due ${formatDate(g.deadline)}${dleft != null ? ` (${dleft}d)` : ''}`
        : '';
      lines.push(`  • ${g.title}: ${pct}% (${done}/${total} subgoals)${deadlineStr} [id ${g._id}]`);
    }
  }

  if (!any) lines.push('  • no active goals');
  return lines.join('\n');
}

export async function getLastWeekActivity(): Promise<string> {
  const r = await api.get<{
    week_start: string;
    week_end: string;
    xp_earned: number;
    xp_by_pillar: Record<string, number>;
    tasks_completed: number;
    tasks_scheduled: number;
    streak: Streak | null;
    debuffs: { pillar: string; status: string }[];
    nudge?: string | null;
  }>('/review/weekly');

  const lines: string[] = [
    '📅 LAST WEEK ACTIVITY',
    `Week of ${formatDate(r.week_start)} → ${formatDate(r.week_end)}`,
    '',
    `XP earned: ${r.xp_earned}`,
    `Tasks: ${r.tasks_completed}/${r.tasks_scheduled} completed`,
  ];

  const byPillar = Object.entries(r.xp_by_pillar);
  if (byPillar.length) {
    lines.push('XP by pillar:');
    for (const [name, xp] of byPillar) lines.push(`  • ${name}: ${xp}`);
  }
  if (r.streak) lines.push(`Global streak: ${r.streak.current_streak}🔥`);
  if (r.debuffs.length) {
    lines.push(`Debuffs: ${r.debuffs.map((d) => `${d.pillar} (${d.status})`).join(', ')}`);
  }
  if (r.nudge) lines.push(`Nudge: ${r.nudge}`);

  return lines.join('\n');
}

export async function getRunningHistory(): Promise<string> {
  const fitness = await resolvePillar(PILLAR.fitness);
  const all = await api.get<MetricLog[]>(`/metrics/pillar/${fitness._id}`);
  const cutoff = Date.now() - 28 * 86_400_000;
  const runs = all
    .filter((m) => m.metric_type === 'run' && new Date(m.logged_at).getTime() >= cutoff)
    .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());

  const lines: string[] = ['🏃 RUNNING HISTORY (last 4 weeks)', ''];
  if (!runs.length) {
    lines.push('  • no runs logged in the last 4 weeks');
    return lines.join('\n');
  }

  let totalDist = 0;
  for (const r of runs) {
    totalDist += r.value;
    lines.push(`  • ${formatDate(r.logged_at)}: ${r.value}km @ ${formatPace(r.secondary_value)}`);
  }

  const first = runs[0];
  const last = runs[runs.length - 1];
  lines.push('', `Total: ${totalDist.toFixed(1)}km over ${runs.length} run(s).`);
  if (runs.length > 1) {
    const distTrend = last.value - first.value;
    lines.push(
      `Distance trend: ${distTrend >= 0 ? '+' : ''}${distTrend.toFixed(1)}km from first to latest.`
    );
    if (first.secondary_value != null && last.secondary_value != null) {
      const paceDelta = last.secondary_value - first.secondary_value;
      lines.push(
        `Pace trend: ${paceDelta <= 0 ? 'faster' : 'slower'} by ${Math.abs(paceDelta)}s/km.`
      );
    }
  }

  return lines.join('\n');
}

export async function getInstagramMetrics(): Promise<string> {
  const content = await resolvePillar(PILLAR.content);
  const all = await api.get<MetricLog[]>(`/metrics/pillar/${content._id}`);
  const snaps = all
    .filter((m) => m.metric_type === 'instagram')
    .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());

  const lines: string[] = ['📸 INSTAGRAM METRICS', ''];
  if (!snaps.length) {
    lines.push('  • no Instagram snapshots logged yet');
    return lines.join('\n');
  }

  for (const s of snaps) {
    const views = s.secondary_value != null ? `, ${s.secondary_value} avg views` : '';
    lines.push(`  • ${formatDate(s.logged_at)}: ${s.value} followers${views}`);
  }

  const first = snaps[0];
  const last = snaps[snaps.length - 1];
  const growth = last.value - first.value;
  lines.push('', `Follower change: ${growth >= 0 ? '+' : ''}${growth} since ${formatDate(first.logged_at)}.`);

  // Posting frequency: posts logged as a "post" metric, if present.
  const posts = all.filter((m) => m.metric_type === 'post' || m.metric_type === 'reel');
  if (posts.length) lines.push(`Posts logged: ${posts.length}.`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Goals summary (for week planning context)
// ---------------------------------------------------------------------------

interface GoalSummarySubgoal {
  _id: string;
  title: string;
  status: string;
  task_count: number;
  completed_task_count: number;
  next_scheduled_task_date: string | null;
}

interface GoalSummaryItem {
  _id: string;
  pillar_name: string;
  title: string;
  deadline?: string;
  subgoals: GoalSummarySubgoal[];
}

export async function getGoalsSummary(): Promise<string> {
  const goals = await api.get<GoalSummaryItem[]>('/goals/summary');
  const lines: string[] = ['🎯 GOALS SUMMARY', ''];

  if (!goals.length) {
    lines.push('  • no active goals');
    return lines.join('\n');
  }

  for (const g of goals) {
    const dl = g.deadline ? ` (due ${formatDate(g.deadline)})` : '';
    lines.push(`[${g.pillar_name}] ${g.title}${dl} [id ${g._id}]`);
    for (const sg of g.subgoals) {
      const pct = sg.task_count ? Math.round((sg.completed_task_count / sg.task_count) * 100) : 0;
      const next = sg.next_scheduled_task_date ? ` — next task ${formatDate(sg.next_scheduled_task_date)}` : '';
      lines.push(
        `  • ${sg.title} [${sg.status}] ${sg.completed_task_count}/${sg.task_count} tasks (${pct}%)${next} [subgoal_id ${sg._id}]`
      );
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

const scheduledTaskSchema = z.object({
  task_ref_id: z.string().describe('Reference id linking back to the underlying task.'),
  title: z.string(),
  pillar: z.string().describe('Pillar name for the task.'),
  xp: z.number(),
  is_featured: z.boolean().optional().describe('Highlight as the day\'s featured task.'),
});

const challengeSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  xp: z.number(),
  pillar: z.string().optional(),
  is_surprise: z.boolean().optional(),
});

const runningTargetSchema = z.object({
  target_distance_km: z.number(),
  target_pace_per_km: z.string().describe('Target pace as "m:ss".'),
  notes: z.string().optional(),
});

const daySchema = z.object({
  date: z.string().describe('ISO date for this day (YYYY-MM-DD).'),
  tasks: z.array(scheduledTaskSchema).default([]),
  challenge: challengeSchema.optional(),
  running_target: runningTargetSchema.optional(),
});

export function registerSchedulingTools(server: McpServer): void {
  server.registerTool(
    'get_progress_summary',
    {
      title: 'Get progress summary',
      description:
        'Full current stats: XP, ranks, streaks, debuffs and latest metric per pillar. ' +
        'The headline "how am I doing" snapshot.',
      inputSchema: {},
    },
    tool(getProgressSummary)
  );

  server.registerTool(
    'get_goal_deadlines',
    {
      title: 'Get goal deadlines',
      description: 'All active goals with their deadlines and current % complete.',
      inputSchema: {},
    },
    tool(getGoalDeadlines)
  );

  server.registerTool(
    'get_last_week_activity',
    {
      title: 'Get last week activity',
      description: 'Summary of XP earned and tasks completed vs scheduled over the past week.',
      inputSchema: {},
    },
    tool(getLastWeekActivity)
  );

  server.registerTool(
    'get_running_history',
    {
      title: 'Get running history',
      description: 'Last 4 weeks of run data with distance and pace progression.',
      inputSchema: {},
    },
    tool(getRunningHistory)
  );

  server.registerTool(
    'get_instagram_metrics',
    {
      title: 'Get Instagram metrics',
      description: 'Follower history and posting frequency from logged Instagram snapshots.',
      inputSchema: {},
    },
    tool(getInstagramMetrics)
  );

  server.registerTool(
    'create_weekly_schedule',
    {
      title: 'Create weekly schedule',
      description:
        'Write a full week of tasks, challenges and running targets to the database. This is ' +
        'the output of the weekly planning session — call after gathering context and deciding ' +
        'the plan. Upserts the week, replacing any existing schedule for that week_start.',
      inputSchema: {
        week_start: z.string().describe('ISO date for the start of the week (YYYY-MM-DD).'),
        days: z.array(daySchema).describe('One entry per scheduled day.'),
        context_at_generation: z
          .object({
            followers: z.number().optional(),
            weeks_to_deadline: z.number().optional(),
            last_week_posts: z.number().optional(),
            last_week_workouts: z.number().optional(),
            current_run_distance: z.number().optional(),
            current_run_pace: z.number().optional(),
          })
          .optional()
          .describe('Snapshot of the context this plan was built from.'),
      },
    },
    tool(
      async (schedule: {
        week_start: string;
        days: unknown[];
        context_at_generation?: unknown;
      }) => {
        const saved = await api.post<{ week_start: string; days: { date: string }[] }>(
          '/schedule/week',
          { ...schedule, generated_by: 'ai_session' }
        );
        const taskCount = (schedule.days as { tasks?: unknown[] }[]).reduce(
          (n, d) => n + (d.tasks?.length ?? 0),
          0
        );
        return `🗓️ Saved weekly schedule for week of ${formatDate(saved.week_start)} — ${saved.days.length} day(s), ${taskCount} task(s).`;
      }
    )
  );

  server.registerTool(
    'get_goals_summary',
    {
      title: 'Get goals summary',
      description:
        'All active goals with their subgoals and task progress. Use this before adding tasks ' +
        'so you know what subgoal_ids exist and what has already been scheduled.',
      inputSchema: {},
    },
    tool(getGoalsSummary)
  );

  server.registerTool(
    'add_tasks_batch',
    {
      title: 'Add tasks in batch',
      description:
        'Create multiple tasks across subgoals in one call. Use after get_goals_summary to ' +
        'plan a full week of tasks. Returns a summary of what was created.',
      inputSchema: {
        tasks: z
          .array(
            z.object({
              subgoal_id: z.string().describe('Id of the subgoal this task belongs to.'),
              title: z.string().describe('Task title.'),
              difficulty: z.enum(['easy', 'medium', 'hard', 'epic']).default('easy'),
              scheduled_date: z.string().optional().describe('ISO date (YYYY-MM-DD).'),
            })
          )
          .describe('List of tasks to create.'),
      },
    },
    tool(
      async ({ tasks }: { tasks: Array<{ subgoal_id: string; title: string; difficulty: string; scheduled_date?: string }> }) => {
        const subgoalSet = new Set<string>();
        let created = 0;
        for (const t of tasks) {
          await api.post('/tasks', {
            subgoal_id: t.subgoal_id,
            title: t.title,
            difficulty: t.difficulty,
            scheduled_date: t.scheduled_date,
          });
          subgoalSet.add(t.subgoal_id);
          created++;
        }
        return `✅ Created ${created} task(s) across ${subgoalSet.size} subgoal(s).`;
      }
    )
  );

  server.registerTool(
    'update_scheduled_task',
    {
      title: 'Update a scheduled task',
      description: 'Modify a specific scheduled task (title, pillar, xp or featured flag).',
      inputSchema: {
        date: z.string().describe('ISO date of the day the task is on (YYYY-MM-DD).'),
        task_ref_id: z.string().describe('The scheduled task\'s task_ref_id.'),
        changes: z
          .object({
            title: z.string().optional(),
            pillar: z.string().optional(),
            xp: z.number().optional(),
            is_featured: z.boolean().optional(),
          })
          .describe('Fields to change.'),
      },
    },
    tool(
      async ({
        date,
        task_ref_id,
        changes,
      }: {
        date: string;
        task_ref_id: string;
        changes: Record<string, unknown>;
      }) => {
        const task = await api.patch<{ title: string }>('/schedule/task', {
          date,
          task_ref_id,
          updates: changes,
        });
        return `✏️ Updated scheduled task on ${formatDate(date)} → "${task.title}".`;
      }
    )
  );
}
