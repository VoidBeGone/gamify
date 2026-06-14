/** Workout routine / template tools. */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { api } from '../api.js';
import { tool } from '../format.js';

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest_seconds?: number;
  notes?: string;
  progression_note?: string;
}

interface WorkoutDay {
  day_name: string;
  session_type: string;
  exercises: Exercise[];
}

interface WorkoutTemplate {
  program_name: string;
  split_type: string;
  days_per_week: number;
  equipment: string[];
  schedule: WorkoutDay[];
  notes?: string;
}

function renderExercise(e: Exercise): string {
  const bits = [`${e.sets}×${e.reps}`];
  if (e.rest_seconds) bits.push(`${e.rest_seconds}s rest`);
  if (e.progression_note) bits.push(e.progression_note);
  return `    • ${e.name} — ${bits.join(', ')}`;
}

function renderDay(d: WorkoutDay): string {
  const header = `  ${d.day_name} — ${d.session_type}`;
  if (!d.exercises.length) return `${header} (rest)`;
  return `${header}\n${d.exercises.map(renderExercise).join('\n')}`;
}

function renderTemplate(t: WorkoutTemplate): string {
  const lines = [
    `🏋️ ${t.program_name} — ${t.split_type}, ${t.days_per_week} days/week`,
    t.equipment.length ? `Equipment: ${t.equipment.join(', ')}` : '',
    t.notes ? `Notes: ${t.notes}` : '',
    '',
    ...t.schedule.map(renderDay),
  ];
  return lines.filter((l) => l !== '').join('\n');
}

const exerciseSchema = z.object({
  name: z.string().describe('Exercise name.'),
  sets: z.number().describe('Number of sets.'),
  reps: z.string().describe('Rep scheme as text, e.g. "8-12" or "10".'),
  rest_seconds: z.number().optional().describe('Rest between sets, in seconds.'),
  notes: z.string().optional().describe('Form cues or tempo notes.'),
  progression_note: z.string().optional().describe('How to progress week to week.'),
});

export function registerWorkoutTools(server: McpServer): void {
  server.registerTool(
    'get_workout_template',
    {
      title: 'Get active workout program',
      description: 'Return the current active workout program with its full weekly split.',
      inputSchema: {},
    },
    tool(async () => {
      const t = await api.get<WorkoutTemplate>('/workout/template');
      return renderTemplate(t);
    })
  );

  server.registerTool(
    'set_workout_template',
    {
      title: 'Save a new workout program',
      description:
        'Save a freshly generated workout program. Deactivates the previous program and ' +
        'makes this one active. Use after generating a routine from current stats.',
      inputSchema: {
        program_name: z.string().describe('Name of the program, e.g. "Hypertrophy Block A".'),
        split_type: z.string().describe('Split style, e.g. "Push/Pull/Legs", "Upper/Lower".'),
        days_per_week: z.number().describe('Training days per week.'),
        equipment: z.array(z.string()).optional().describe('Available equipment.'),
        user_stats_at_generation: z
          .object({
            bodyweight_kg: z.number().optional(),
            height_cm: z.number().optional(),
            age: z.number().optional(),
            body_fat_pct: z.number().optional(),
            goal: z.string().optional(),
          })
          .optional()
          .describe('Snapshot of the stats the program was built around.'),
        schedule: z
          .array(
            z.object({
              day_name: z.string().describe('Day of week, e.g. "Monday".'),
              session_type: z.string().describe('Session focus, e.g. "Push".'),
              exercises: z.array(exerciseSchema).describe('Exercises for the day.'),
            })
          )
          .describe('The weekly training schedule.'),
        notes: z.string().optional().describe('Overall program notes.'),
      },
    },
    tool(async (program: Record<string, unknown>) => {
      const t = await api.post<WorkoutTemplate>('/workout/template', program);
      return `✅ Saved and activated new program.\n\n${renderTemplate(t)}`;
    })
  );

  server.registerTool(
    'get_todays_workout',
    {
      title: "Get today's workout",
      description: "Return today's session from the active program (or a rest-day note).",
      inputSchema: {},
    },
    tool(async () => {
      const data = await api.get<{
        day_name: string;
        is_rest_day: boolean;
        program_name: string;
        session: WorkoutDay | null;
      }>('/workout/today');
      if (data.is_rest_day || !data.session) {
        return `😌 ${data.day_name} is a rest day on ${data.program_name}.`;
      }
      return `📅 ${data.day_name} — ${data.program_name}\n${renderDay(data.session)}`;
    })
  );
}
