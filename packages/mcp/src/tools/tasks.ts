/** Task & goal management tools. */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { api, resolvePillar } from '../api.js';
import { tool, formatDate } from '../format.js';

const difficulty = z.enum(['easy', 'medium', 'hard', 'epic']);

interface XpResult {
  xp_awarded?: number;
  new_pillar_xp?: number;
  pillar_rank_name?: string;
  rank_up?: boolean;
  combo_bonus?: number;
  new_global_xp?: number;
}

/** Render the XP engine result into a short readable line. */
function describeXp(xp?: XpResult): string {
  if (!xp) return '';
  const parts: string[] = [];
  if (xp.xp_awarded != null) parts.push(`+${xp.xp_awarded} XP`);
  if (xp.pillar_rank_name) parts.push(`rank: ${xp.pillar_rank_name}`);
  if (xp.combo_bonus) parts.push(`combo bonus +${xp.combo_bonus}`);
  if (xp.rank_up) parts.push('🎉 RANK UP!');
  return parts.length ? ` (${parts.join(', ')})` : '';
}

export function registerTaskTools(server: McpServer): void {
  server.registerTool(
    'complete_task',
    {
      title: 'Complete a task',
      description:
        'Mark a task as done by its id. Triggers the XP engine, streaks and any rank-ups. ' +
        'Use this for "mark my content task done", "I finished my workout task", etc.',
      inputSchema: {
        task_id: z.string().describe('The MongoDB id of the task to complete.'),
      },
    },
    tool(async ({ task_id }: { task_id: string }) => {
      const data = await api.patch<{ task: { title: string }; xp_result: XpResult; pillar_name?: string }>(
        `/tasks/${task_id}/complete`
      );
      if (data.task.title.includes('Post') && data.pillar_name === 'Content Creation') {
        await api.post('/metrics', {
          metric_type: 'post_count',
          value: 1,
          notes: data.task.title,
        });
      }
      return `✅ Completed "${data.task.title}"${describeXp(data.xp_result)}.`;
    })
  );

  server.registerTool(
    'add_task',
    {
      title: 'Add a task',
      description:
        'Create a task under a subgoal. The backend attaches tasks to subgoals, so subgoal_id ' +
        'is required — use add_goal/add_subgoal or get_goal_deadlines to find the right id.',
      inputSchema: {
        subgoal_id: z.string().describe('Id of the subgoal this task belongs to.'),
        title: z.string().describe('Short task title.'),
        difficulty: difficulty.default('easy').describe('Drives the base XP award.'),
        scheduled_date: z
          .string()
          .optional()
          .describe('ISO date (YYYY-MM-DD) the task is scheduled for.'),
        pillar: z
          .string()
          .optional()
          .describe('Optional pillar name for context; the pillar is inherited from the goal.'),
      },
    },
    tool(
      async ({
        subgoal_id,
        title,
        difficulty,
        scheduled_date,
      }: {
        subgoal_id: string;
        title: string;
        difficulty: string;
        scheduled_date?: string;
      }) => {
        const task = await api.post<{ _id: string; title: string; base_xp: number }>('/tasks', {
          subgoal_id,
          title,
          difficulty,
          scheduled_date,
        });
        const when = scheduled_date ? ` scheduled for ${formatDate(scheduled_date)}` : '';
        return `➕ Added task "${task.title}" (${difficulty}, ${task.base_xp} XP)${when}. Id: ${task._id}`;
      }
    )
  );

  server.registerTool(
    'complete_challenge',
    {
      title: 'Complete a daily challenge',
      description:
        "Mark a day's challenge as done. Challenges live inside the weekly schedule and are " +
        'identified by their date, so pass the date of the challenge (defaults to today).',
      inputSchema: {
        date: z
          .string()
          .optional()
          .describe("ISO date of the challenge's day (YYYY-MM-DD). Defaults to today."),
      },
    },
    tool(async ({ date }: { date?: string }) => {
      const day = date ?? new Date().toISOString().slice(0, 10);
      const data = await api.post<{ challenge: { title: string }; xp_result: XpResult }>(
        `/challenges/complete/${day}`
      );
      return `🏆 Completed challenge "${data.challenge.title}"${describeXp(data.xp_result)}.`;
    })
  );

  server.registerTool(
    'add_goal',
    {
      title: 'Add a goal',
      description:
        'Create a top-level goal under a pillar. Accepts a pillar name (e.g. "fitness", ' +
        '"content", "side quests") and resolves it to the right pillar automatically.',
      inputSchema: {
        pillar: z.string().describe('Pillar name or alias (fitness / content / side quests).'),
        title: z.string().describe('Goal title.'),
        description: z.string().optional().describe('Optional longer description.'),
        deadline: z.string().optional().describe('ISO deadline date (YYYY-MM-DD).'),
      },
    },
    tool(
      async ({
        pillar,
        title,
        description,
        deadline,
      }: {
        pillar: string;
        title: string;
        description?: string;
        deadline?: string;
      }) => {
        const resolved = await resolvePillar(pillar);
        const goal = await api.post<{ _id: string; title: string }>('/goals', {
          pillar_id: resolved._id,
          title,
          description,
          deadline,
        });
        const when = deadline ? ` (deadline ${formatDate(deadline)})` : '';
        return `🎯 Created goal "${goal.title}" under ${resolved.name}${when}. Id: ${goal._id}`;
      }
    )
  );

  server.registerTool(
    'add_subgoal',
    {
      title: 'Add a subgoal',
      description: 'Add a subgoal (milestone) to an existing goal. Tasks then hang off subgoals.',
      inputSchema: {
        goal_id: z.string().describe('Id of the parent goal.'),
        title: z.string().describe('Subgoal title.'),
        difficulty: difficulty.default('medium').describe('Drives the base XP award.'),
        deadline: z.string().optional().describe('ISO deadline date (YYYY-MM-DD).'),
      },
    },
    tool(
      async ({
        goal_id,
        title,
        difficulty,
        deadline,
      }: {
        goal_id: string;
        title: string;
        difficulty: string;
        deadline?: string;
      }) => {
        const subgoal = await api.post<{ _id: string; title: string; base_xp: number }>(
          '/subgoals',
          { goal_id, title, difficulty, deadline }
        );
        const when = deadline ? ` (deadline ${formatDate(deadline)})` : '';
        return `📌 Added subgoal "${subgoal.title}" (${difficulty}, ${subgoal.base_xp} XP)${when}. Id: ${subgoal._id}`;
      }
    )
  );

  server.registerTool(
    'delete_task',
    {
      title: 'Delete a task',
      description:
        'Permanently delete a task by its id. Does not award or remove XP — just removes the task document.',
      inputSchema: {
        task_id: z.string().describe('MongoDB id of the task to delete.'),
      },
    },
    tool(async ({ task_id }: { task_id: string }) => {
      await api.delete(`/tasks/${task_id}`);
      return 'Task deleted successfully.';
    })
  );

  server.registerTool(
    'delete_subgoal',
    {
      title: 'Delete a subgoal',
      description: 'Permanently delete a subgoal and all its embedded tasks.',
      inputSchema: {
        subgoal_id: z.string().describe('MongoDB id of the subgoal to delete.'),
      },
    },
    tool(async ({ subgoal_id }: { subgoal_id: string }) => {
      const data = await api.delete<{ deleted_subgoal_id: string; tasks_removed: number }>(
        `/subgoals/${subgoal_id}`
      );
      const n = data.tasks_removed;
      return `Subgoal and ${n} task${n !== 1 ? 's' : ''} deleted.`;
    })
  );

  server.registerTool(
    'delete_goal',
    {
      title: 'Delete a goal',
      description:
        'Permanently delete an entire goal including all its subgoals and tasks.',
      inputSchema: {
        goal_id: z.string().describe('MongoDB id of the goal to delete.'),
      },
    },
    tool(async ({ goal_id }: { goal_id: string }) => {
      await api.delete(`/goals/${goal_id}`);
      return 'Goal deleted successfully.';
    })
  );

  server.registerTool(
    'reschedule_task',
    {
      title: 'Reschedule a task',
      description:
        'Move a task to a different date by updating its scheduled_date. ' +
        'Also updates the daily_schedule entry so the dashboard reflects the new date.',
      inputSchema: {
        task_id: z.string().describe('MongoDB id of the task to reschedule.'),
        new_date: z.string().describe('New scheduled date in YYYY-MM-DD format.'),
      },
    },
    tool(async ({ task_id, new_date }: { task_id: string; new_date: string }) => {
      await api.patch(`/tasks/${task_id}/reschedule`, { new_date });
      return `📅 Task rescheduled to ${new_date}.`;
    })
  );

  server.registerTool(
    'reschedule_tasks_batch',
    {
      title: 'Reschedule tasks in batch',
      description:
        'Move multiple tasks to new dates in one call. Useful for pushing several tasks ' +
        'forward when plans change.',
      inputSchema: {
        tasks: z
          .array(
            z.object({
              task_id: z.string().describe('MongoDB id of the task.'),
              new_date: z.string().describe('New scheduled date in YYYY-MM-DD format.'),
            })
          )
          .describe('List of tasks to reschedule.'),
      },
    },
    tool(async ({ tasks }: { tasks: Array<{ task_id: string; new_date: string }> }) => {
      for (const t of tasks) {
        await api.patch(`/tasks/${t.task_id}/reschedule`, { new_date: t.new_date });
      }
      return `📅 Rescheduled ${tasks.length} task${tasks.length !== 1 ? 's' : ''} successfully.`;
    })
  );

  server.registerTool(
    'remove_from_schedule',
    {
      title: 'Remove task from schedule',
      description:
        'Remove a task from the daily schedule for a given date without permanently deleting ' +
        'the underlying goal task. Use this to clear something from today\'s view.',
      inputSchema: {
        date: z.string().describe('ISO date (YYYY-MM-DD) to remove the task from.'),
        task_ref_id: z.string().describe('The task id to remove from that day\'s schedule.'),
      },
    },
    tool(async ({ date, task_ref_id }: { date: string; task_ref_id: string }) => {
      await api.delete('/schedule/task', { date, task_ref_id });
      return `Removed from schedule for ${date}.`;
    })
  );
}
