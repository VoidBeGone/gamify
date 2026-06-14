import { Router } from 'express';
import { Types } from 'mongoose';
import { MetricsLog } from '../models';
import { getUser } from '../utils/context';
import { asyncHandler, ok } from '../utils/response';
import { startOfDay } from '../utils/dates';

const router = Router();

const PROTEIN_TARGET = 182;

// GET /history/workouts — logged workout sessions grouped by date
router.get(
  '/workouts',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);

    const workouts = await MetricsLog.find({
      user_id: user._id,
      metric_type: 'workout',
    })
      .sort({ logged_at: -1 })
      .lean();

    // Group by calendar date
    const byDate = new Map<
      string,
      { date: string; session_type: string; exercises: unknown[]; notes: string | undefined; volume: number }
    >();

    for (const w of workouts) {
      const dateKey = startOfDay(new Date(w.logged_at)).toISOString().slice(0, 10);

      let exercises: Array<{ name: string; weight?: number; sets?: number; reps?: string }> = [];
      try {
        exercises = JSON.parse(w.notes ?? '[]');
      } catch {
        exercises = [];
      }

      // Derive session_type from exercise names (heuristic based on muscle groups)
      const names = exercises.map((e) => e.name?.toLowerCase() ?? '');
      let session_type = 'Training';
      if (names.some((n) => n.includes('bench') || n.includes('chest') || n.includes('push'))) {
        session_type = 'Push';
      } else if (names.some((n) => n.includes('row') || n.includes('pull') || n.includes('back') || n.includes('bicep'))) {
        session_type = 'Pull';
      } else if (names.some((n) => n.includes('squat') || n.includes('leg') || n.includes('lunge') || n.includes('deadlift'))) {
        session_type = 'Legs';
      } else if (names.some((n) => n.includes('shoulder') || n.includes('press') || n.includes('upper'))) {
        session_type = 'Upper';
      } else if (names.some((n) => n.includes('run') || n.includes('cardio') || n.includes('bike'))) {
        session_type = 'Conditioning';
      }

      // Volume = sum of weight × sets × reps (reps parsed as integer)
      let volume = 0;
      for (const ex of exercises) {
        if (ex.weight && ex.sets) {
          const repsNum = parseInt(String(ex.reps ?? '0'), 10) || 0;
          volume += ex.weight * ex.sets * repsNum;
        }
      }

      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, {
          date: dateKey,
          session_type,
          exercises,
          notes: undefined,
          volume,
        });
      }
    }

    const result = Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
    return ok(res, result);
  })
);

// GET /history/nutrition — daily nutrition entries grouped by date
router.get(
  '/nutrition',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);

    // Meal-level entries stored as meal_entry_protein
    const entries = await MetricsLog.find({
      user_id: user._id,
      metric_type: 'meal_entry_protein',
    })
      .sort({ logged_at: 1 })
      .lean();

    // Also get on_plan flags
    const onPlanEntries = await MetricsLog.find({
      user_id: user._id,
      metric_type: 'nutrition_on_plan',
    })
      .sort({ logged_at: -1 })
      .lean();

    const onPlanByDate = new Map<string, boolean>();
    for (const e of onPlanEntries) {
      const key = startOfDay(new Date(e.logged_at)).toISOString().slice(0, 10);
      if (!onPlanByDate.has(key)) {
        onPlanByDate.set(key, e.value === 1);
      }
    }

    const byDate = new Map<
      string,
      { date: string; meals: Array<{ name: string; protein_g: number; calories: number }>; protein_g: number; calories: number; on_plan: boolean }
    >();

    for (const e of entries) {
      const dateKey = startOfDay(new Date(e.logged_at)).toISOString().slice(0, 10);
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, {
          date: dateKey,
          meals: [],
          protein_g: 0,
          calories: 0,
          on_plan: onPlanByDate.get(dateKey) ?? false,
        });
      }
      const day = byDate.get(dateKey)!;
      const mealName = e.notes ? e.notes.split(' — ')[0] : 'Meal';
      day.meals.push({ name: mealName, protein_g: e.value, calories: e.secondary_value ?? 0 });
      day.protein_g += e.value;
      day.calories += e.secondary_value ?? 0;
    }

    const result = Array.from(byDate.values())
      .map((d) => ({
        ...d,
        on_plan: d.on_plan || d.protein_g >= PROTEIN_TARGET,
        protein_target_hit: d.protein_g >= PROTEIN_TARGET,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return ok(res, result);
  })
);

export default router;
