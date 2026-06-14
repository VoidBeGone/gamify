/**
 * The `weekly_schedule` prompt.
 *
 * Unlike a tool, a prompt runs server-side when invoked and returns a ready-to-go
 * message. Here we gather all of Peter's current context up front (six context
 * calls, in sequence) and fold it into a single briefing, ending with the
 * instruction to generate a concrete week. Claude can then call
 * `create_weekly_schedule` to persist the result.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getProgressSummary,
  getGoalDeadlines,
  getLastWeekActivity,
  getRunningHistory,
  getInstagramMetrics,
} from '../tools/scheduling.js';
import { api } from '../api.js';

/** The active workout program, rendered compactly for the briefing. */
async function getWorkoutContext(): Promise<string> {
  try {
    const t = await api.get<{
      program_name: string;
      split_type: string;
      days_per_week: number;
      schedule: { day_name: string; session_type: string }[];
    }>('/workout/template');
    const days = t.schedule.map((d) => `${d.day_name}=${d.session_type}`).join(', ');
    return `🏋️ ACTIVE PROGRAM\n${t.program_name} (${t.split_type}, ${t.days_per_week} days/week)\n${days}`;
  } catch {
    return '🏋️ ACTIVE PROGRAM\n  • no active workout program';
  }
}

const CLOSING_INSTRUCTION =
  'Based on this data, generate a specific weekly schedule that maximizes progress toward ' +
  "Peter's goals. Be concrete — name specific distances and side quest suggestions for Toronto.\n\n" +
  'CONTENT CREATION — before scheduling anything content-related, ask Peter this one question:\n' +
  '"Do you have reel ideas for this week? Share them now and I will build the production ' +
  'calendar around them. If you have none yet, just say no and I will use TBD placeholders."\n' +
  'Wait for his response before generating any content tasks.\n\n' +
  'CONTENT CREATION SCHEDULING RULES — follow these exactly:\n' +
  'NEVER specify topics, hooks, talking points, scripts, or reel concepts unless Peter ' +
  'provided them himself in his response above.\n' +
  'NEVER generate more than one optional creative spark per week.\n' +
  'CONTENT FORMAT MIX — Peter\'s weekly target is:\n' +
  '  • 2 talking head / yap videos (straight to camera, conversational)\n' +
  '  • 1–2 vlog style videos (day-in-the-life, follow-along)\n' +
  '  • 1 cinematic video (high production, planned shots)\n' +
  'Label each piece by its format when scheduling (e.g. "Film: [TBD — talking head]") so ' +
  'the week\'s production balance is visible at a glance. Never invent the actual concept.\n' +
  'Schedule content ONLY as a production calendar in this exact structure:\n' +
  '  • One "Content Planning Session" — Peter decides his own ideas, do not suggest them\n' +
  '  • For each piece that week (4–5 total: 2 talking head + 1–2 vlog + 1 cinematic), ' +
  'using Peter\'s idea or "TBD — [format]" as the label:\n' +
  '      – "Plan: [Peter\'s idea OR TBD — fill in before filming]"\n' +
  '      – "Film: [Peter\'s idea OR TBD]"\n' +
  '      – "Edit: Cut in DaVinci Resolve, export via native Edit app for IG quality"\n' +
  '      – "Post: 6–8pm — write caption in your voice, 15 min engagement after"\n' +
  '  • One "Weekly Review" — check metrics, note what performed, no action items generated\n' +
  '  • Optional: ONE creative spark maximum, one sentence, clearly marked optional, ' +
  'only if Peter said he had no ideas — never if he already provided them\n\n' +
  'The content schedule is a production calendar. Peter owns the creative decisions entirely.\n\n' +
  'When the full plan is ready, call the create_weekly_schedule tool to save it.';

export function registerWeeklySchedulePrompt(server: McpServer): void {
  server.registerPrompt(
    'weekly_schedule',
    {
      title: 'Plan my week',
      description:
        "Gathers Peter's full current context (progress, goals, last week, running, Instagram " +
        'and active workout program) and asks Claude to generate a concrete weekly schedule.',
    },
    async () => {
      // Gather every context source in sequence so a failure is easy to locate.
      const sections: string[] = [];
      const gatherers: [string, () => Promise<string>][] = [
        ['progress', getProgressSummary],
        ['goals', getGoalDeadlines],
        ['last week', getLastWeekActivity],
        ['running', getRunningHistory],
        ['instagram', getInstagramMetrics],
        ['workout', getWorkoutContext],
      ];

      for (const [label, fn] of gatherers) {
        try {
          sections.push(await fn());
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          sections.push(`⚠️ Could not load ${label} context: ${msg}`);
        }
      }

      const briefing = [
        "Here is Peter's current LevelUp state for weekly planning.",
        '',
        sections.join('\n\n────────────────────\n\n'),
        '',
        '════════════════════',
        '',
        CLOSING_INSTRUCTION,
      ].join('\n');

      return {
        messages: [
          {
            role: 'user',
            content: { type: 'text', text: briefing },
          },
        ],
      };
    }
  );
}
