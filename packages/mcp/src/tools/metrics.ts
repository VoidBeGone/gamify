/** Metric logging tools — workouts, runs, nutrition, Instagram and generic metrics. */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { api, resolvePillar, PILLAR } from '../api.js';
import { tool } from '../format.js';

interface XpResult {
  xp_awarded?: number;
  pillar_rank_name?: string;
  rank_up?: boolean;
  combo_bonus?: number;
}

function describeXp(xp?: XpResult): string {
  if (!xp) return '';
  const parts: string[] = [];
  if (xp.xp_awarded != null) parts.push(`+${xp.xp_awarded} XP`);
  if (xp.combo_bonus) parts.push(`combo +${xp.combo_bonus}`);
  if (xp.rank_up) parts.push('🎉 RANK UP!');
  return parts.length ? ` (${parts.join(', ')})` : '';
}

export function registerMetricTools(server: McpServer): void {
  server.registerTool(
    'log_metric',
    {
      title: 'Log a metric',
      description:
        'Universal metric logger for anything without a dedicated tool (bodyweight, sleep, ' +
        'reading minutes, etc.). Optionally attribute it to a pillar.',
      inputSchema: {
        metric_type: z.string().describe('e.g. "bodyweight_kg", "sleep_hours", "reading_minutes".'),
        value: z.number().describe('Numeric value of the metric.'),
        notes: z.string().optional().describe('Optional free-text note.'),
        pillar: z.string().optional().describe('Optional pillar name to attribute the metric to.'),
      },
    },
    tool(
      async ({
        metric_type,
        value,
        notes,
        pillar,
      }: {
        metric_type: string;
        value: number;
        notes?: string;
        pillar?: string;
      }) => {
        const pillar_id = pillar ? (await resolvePillar(pillar))._id : undefined;
        await api.post('/metrics', { metric_type, value, notes, pillar_id });
        return `📈 Logged ${metric_type} = ${value}${notes ? ` (${notes})` : ''}.`;
      }
    )
  );

  server.registerTool(
    'log_workout',
    {
      title: 'Log a workout',
      description:
        'Log a full gym session as a list of exercises. Awards workout XP and feeds the ' +
        'fitness pillar. Example: "cable rows 3x12 at 50kg, pull-ups 3x8".',
      inputSchema: {
        exercises: z
          .array(
            z.object({
              name: z.string().describe('Exercise name.'),
              weight_kg: z.number().optional().describe('Working weight in kg (omit for bodyweight).'),
              sets: z.number().describe('Number of sets.'),
              reps: z.number().describe('Reps per set.'),
            })
          )
          .min(1)
          .describe('The exercises performed.'),
        notes: z.string().optional().describe('Optional session note.'),
      },
    },
    tool(
      async ({
        exercises,
        notes,
      }: {
        exercises: { name: string; weight_kg?: number; sets: number; reps: number }[];
        notes?: string;
      }) => {
        const data = await api.post<{ xp_result: XpResult }>('/metrics/workout', {
          exercises,
          notes,
        });
        const lines = exercises
          .map((e) => `  • ${e.name}: ${e.sets}×${e.reps}${e.weight_kg ? ` @ ${e.weight_kg}kg` : ''}`)
          .join('\n');
        return `💪 Logged workout — ${exercises.length} exercise(s)${describeXp(data.xp_result)}:\n${lines}`;
      }
    )
  );

  server.registerTool(
    'log_run',
    {
      title: 'Log a run',
      description:
        'Log a run with distance, pace and duration. Pace accepts "m:ss" (e.g. "8:45") or ' +
        'seconds-per-km. Example: "ran 3km, no breaks, 8:45 per km".',
      inputSchema: {
        distance_km: z.number().describe('Distance in kilometres.'),
        pace_per_km: z
          .string()
          .describe('Pace per km as "m:ss" (e.g. "8:45") or a number of seconds.'),
        duration_minutes: z.number().optional().describe('Total run duration in minutes.'),
        notes: z.string().optional().describe('Optional note (e.g. "no breaks").'),
      },
    },
    tool(
      async ({
        distance_km,
        pace_per_km,
        duration_minutes,
        notes,
      }: {
        distance_km: number;
        pace_per_km: string;
        duration_minutes?: number;
        notes?: string;
      }) => {
        const data = await api.post<{ xp_result: XpResult }>('/metrics/run', {
          distance_km,
          pace_per_km,
          duration_minutes,
          notes,
        });
        const dur = duration_minutes != null ? `, ${duration_minutes} min` : '';
        return `🏃 Logged ${distance_km}km run at ${pace_per_km} /km${dur}${describeXp(data.xp_result)}.`;
      }
    )
  );

  server.registerTool(
    'log_nutrition',
    {
      title: 'Log nutrition',
      description:
        "Log a day's nutrition: protein, calories, water and whether you stayed on plan. " +
        'Attributed to the fitness pillar.',
      inputSchema: {
        protein_g: z.number().describe('Protein in grams.'),
        calories: z.number().describe('Total calories.'),
        water_ml: z.number().describe('Water intake in millilitres.'),
        on_plan: z.boolean().describe('Whether the day stayed on the nutrition plan.'),
      },
    },
    tool(
      async ({
        protein_g,
        calories,
        water_ml,
        on_plan,
      }: {
        protein_g: number;
        calories: number;
        water_ml: number;
        on_plan: boolean;
      }) => {
        const fitness = await resolvePillar(PILLAR.fitness);
        await api.post('/metrics', {
          metric_type: 'nutrition',
          value: protein_g,
          secondary_value: calories,
          notes: `water=${water_ml}ml; on_plan=${on_plan}`,
          pillar_id: fitness._id,
        });
        return `🥗 Logged nutrition — ${protein_g}g protein, ${calories} kcal, ${water_ml}ml water, ${
          on_plan ? 'on plan ✅' : 'off plan ⚠️'
        }.`;
      }
    )
  );

  server.registerTool(
    'log_instagram',
    {
      title: 'Log Instagram snapshot',
      description:
        'Record an Instagram snapshot: follower count and optional average views and ' +
        'engagement rate. Attributed to the content pillar. Example: "followers at 203 now".',
      inputSchema: {
        followers: z.number().describe('Current follower count.'),
        avg_views: z.number().optional().describe('Average views per recent post.'),
        engagement_rate: z.number().optional().describe('Engagement rate as a percentage.'),
      },
    },
    tool(
      async ({
        followers,
        avg_views,
        engagement_rate,
      }: {
        followers: number;
        avg_views?: number;
        engagement_rate?: number;
      }) => {
        const content = await resolvePillar(PILLAR.content);
        const noteParts: string[] = [];
        if (avg_views != null) noteParts.push(`avg_views=${avg_views}`);
        if (engagement_rate != null) noteParts.push(`engagement_rate=${engagement_rate}%`);
        await api.post('/metrics', {
          metric_type: 'instagram',
          value: followers,
          secondary_value: avg_views,
          notes: noteParts.join('; ') || undefined,
          pillar_id: content._id,
        });
        const extra = noteParts.length ? ` (${noteParts.join(', ')})` : '';
        return `📸 Logged Instagram snapshot — ${followers} followers${extra}.`;
      }
    )
  );

  server.registerTool(
    'log_meal',
    {
      title: 'Log a meal',
      description:
        'Log a single meal with its protein and calories. Returns updated daily totals and ' +
        'remaining protein against the 182g target. Example: "log lunch — 45g protein, 600 cal".',
      inputSchema: {
        meal_name: z.string().describe('Name of the meal, e.g. "Chicken & rice".'),
        protein_g: z.number().describe('Protein in grams for this meal.'),
        calories: z.number().describe('Calories for this meal.'),
        notes: z.string().optional().describe('Optional note about the meal.'),
      },
    },
    tool(
      async ({
        meal_name,
        protein_g,
        calories,
        notes,
      }: {
        meal_name: string;
        protein_g: number;
        calories: number;
        notes?: string;
      }) => {
        const data = await api.post<{
          daily_totals: { protein_g: number; calories: number };
          protein_remaining: number;
        }>('/nutrition/meal', { meal_name, protein_g, calories, notes });
        const { daily_totals, protein_remaining } = data;
        return (
          `🍽️ Logged ${meal_name} — ${protein_g}g protein, ${calories} cal.\n` +
          `Today so far: ${daily_totals.protein_g}g / 182g protein, ${daily_totals.calories} / 2400 cal.\n` +
          `${protein_remaining}g protein still needed today.`
        );
      }
    )
  );

  server.registerTool(
    'get_nutrition_today',
    {
      title: "Get today's nutrition",
      description:
        'Summarise all meals logged today with running totals and remaining protein/calorie ' +
        'targets. Use for "what have I eaten today?" / "how much protein do I have left?".',
      inputSchema: {},
    },
    tool(async () => {
      const data = await api.get<{
        meals: { meal_name: string; protein_g: number; calories: number; logged_at: string }[];
        daily_totals: { protein_g: number; calories: number };
        protein_target: number;
        protein_remaining: number;
        calories_target: number;
        calories_remaining: number;
      }>('/nutrition/today');

      if (!data.meals.length) {
        return '🍽️ No meals logged yet today. Target: 182g protein / 2400 cal.';
      }

      const lines = ["🍽️ Today's meals:"];
      for (const m of data.meals) {
        lines.push(`  • ${m.meal_name}: ${m.protein_g}g protein, ${m.calories} cal`);
      }
      lines.push(
        '',
        `Totals: ${data.daily_totals.protein_g}g / ${data.protein_target}g protein` +
          ` (${data.protein_remaining}g remaining), ` +
          `${data.daily_totals.calories} / ${data.calories_target} cal` +
          ` (${data.calories_remaining} remaining).`
      );
      return lines.join('\n');
    })
  );
}
