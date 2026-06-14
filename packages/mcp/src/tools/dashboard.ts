/** Reading-state tools — quick, human-readable views of current state. */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { api, resolvePillar, type Pillar, type Streak, type MetricLog } from '../api.js';
import { tool, formatDate } from '../format.js';

interface DashboardData {
  user: { username: string; global_xp: number; global_rank_name: string; global_rank_tier: number };
  streak: Streak | null;
  today_tasks: {
    title: string;
    difficulty: string;
    base_xp: number;
    is_completed: boolean;
    goal_title: string;
    _id: string;
  }[];
  schedule_tasks: { title: string; pillar: string; xp: number; is_featured: boolean }[];
  challenge: { title: string; xp: number } | null;
  running_target: { target_distance_km: number; target_pace_per_km: string } | null;
  workout: { day_name: string; is_rest_day: boolean; program_name: string } | null;
  pillars: Pillar[];
  debuffs: { pillar: string; status: string; explanation: string }[];
  nudge?: string | null;
}

async function fetchDashboard(): Promise<DashboardData> {
  return api.get<DashboardData>('/dashboard');
}

export function registerDashboardTools(server: McpServer): void {
  server.registerTool(
    'get_dashboard_summary',
    {
      title: 'Get dashboard summary',
      description: "Today's tasks, XP, streak and nudge — the at-a-glance home view.",
      inputSchema: {},
    },
    tool(async () => {
      const d = await fetchDashboard();
      const lines: string[] = [
        `👋 ${d.user.username} — ${d.user.global_xp} XP, ${d.user.global_rank_name} (tier ${d.user.global_rank_tier})`,
      ];
      if (d.streak) lines.push(`🔥 Global streak: ${d.streak.current_streak} day(s)`);

      lines.push('', "Today's tasks:");
      const tasks = [...d.today_tasks, ...d.schedule_tasks.map((t) => ({
        title: t.title,
        difficulty: t.is_featured ? 'featured' : '',
        base_xp: t.xp,
        is_completed: false,
        goal_title: t.pillar,
        _id: '',
      }))];
      if (!tasks.length) lines.push('  • nothing scheduled');
      for (const t of tasks) {
        const box = t.is_completed ? '✅' : '⬜';
        const id = t._id ? ` [id ${t._id}]` : '';
        lines.push(`  ${box} ${t.title} (${t.base_xp} XP, ${t.goal_title})${id}`);
      }

      if (d.challenge) lines.push('', `🏆 Challenge: ${d.challenge.title} (${d.challenge.xp} XP)`);
      if (d.running_target) {
        lines.push(
          `🏃 Run target: ${d.running_target.target_distance_km}km @ ${d.running_target.target_pace_per_km}`
        );
      }
      if (d.workout) {
        lines.push(
          d.workout.is_rest_day
            ? `🛌 ${d.workout.day_name}: rest day`
            : `🏋️ Workout day on ${d.workout.program_name}`
        );
      }
      if (d.debuffs.length) {
        lines.push('', '⚠️ Debuffs:');
        for (const db of d.debuffs) lines.push(`  • ${db.pillar}: ${db.explanation}`);
      }
      if (d.nudge) lines.push('', `💡 ${d.nudge}`);

      return lines.join('\n');
    })
  );

  server.registerTool(
    'get_pillar_status',
    {
      title: 'Get pillar status',
      description: 'Rank, XP, debuff status and recent metrics for a single pillar (by name).',
      inputSchema: {
        pillar_name: z.string().describe('Pillar name or alias (fitness / content / side quests).'),
      },
    },
    tool(async ({ pillar_name }: { pillar_name: string }) => {
      const pillar = await resolvePillar(pillar_name);
      const metrics = await api.get<MetricLog[]>(`/metrics/pillar/${pillar._id}`);

      const lines: string[] = [
        `🏛️ ${pillar.name}`,
        `XP: ${pillar.xp} — ${pillar.rank_name} (tier ${pillar.rank_tier})`,
        `Status: ${pillar.neglect_status}${
          pillar.neglect_status !== 'healthy' ? ` (XP ×${pillar.xp_multiplier})` : ''
        }`,
        `Last activity: ${formatDate(pillar.last_activity_date)}`,
      ];

      lines.push('', 'Recent metrics:');
      const recent = metrics.slice(0, 5);
      if (!recent.length) lines.push('  • none logged');
      for (const m of recent) {
        const sec = m.secondary_value != null ? ` / ${m.secondary_value}` : '';
        lines.push(`  • ${formatDate(m.logged_at)} ${m.metric_type}: ${m.value}${sec}`);
      }

      return lines.join('\n');
    })
  );

  server.registerTool(
    'get_streak_status',
    {
      title: 'Get streak status',
      description: 'All active streaks with their current and longest counts.',
      inputSchema: {},
    },
    tool(async () => {
      const streaks = await api.get<Streak[]>('/streaks');
      const active = streaks.filter((s) => s.current_streak > 0);
      if (!active.length) return '🔥 No active streaks. Log something today to start one!';
      const lines = ['🔥 Streaks:'];
      for (const s of active) {
        lines.push(
          `  • ${s.streak_type}: ${s.current_streak} day(s) — best ${s.longest_streak}, last ${formatDate(
            s.last_active_date
          )}`
        );
      }
      return lines.join('\n');
    })
  );

  server.registerTool(
    'get_todays_tasks',
    {
      title: "Get today's tasks",
      description: "Today's tasks formatted for reading, including ids for completing them.",
      inputSchema: {},
    },
    tool(async () => {
      const d = await fetchDashboard();
      if (!d.today_tasks.length && !d.schedule_tasks.length) {
        return 'No tasks scheduled for today.';
      }
      const lines = ["📋 Today's tasks:"];
      for (const t of d.today_tasks) {
        const box = t.is_completed ? '✅' : '⬜';
        lines.push(`  ${box} ${t.title} — ${t.base_xp} XP (${t.goal_title}) [id ${t._id}]`);
      }
      for (const t of d.schedule_tasks) {
        const star = t.is_featured ? '⭐ ' : '';
        lines.push(`  ⬜ ${star}${t.title} — ${t.xp} XP (${t.pillar})`);
      }
      return lines.join('\n');
    })
  );

  server.registerTool(
    'get_xp_summary',
    {
      title: 'Get XP summary',
      description: 'Current XP, rank and streak in one readable block.',
      inputSchema: {},
    },
    tool(async () => {
      const d = await fetchDashboard();
      const streak = d.streak ? `${d.streak.current_streak} day streak 🔥` : 'no active streak';
      const lines = [
        `⭐ ${d.user.global_xp} XP — ${d.user.global_rank_name} (tier ${d.user.global_rank_tier})`,
        `🔥 ${streak}`,
        '',
        'Per pillar:',
      ];
      for (const p of d.pillars) {
        lines.push(`  • ${p.name}: ${p.xp} XP, ${p.rank_name}`);
      }
      return lines.join('\n');
    })
  );
}
