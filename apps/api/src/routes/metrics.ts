import { Router } from 'express';
import { Types } from 'mongoose';
import { MetricsLog } from '../models';
import { getUser, getPillarByName, PILLAR_NAMES } from '../utils/context';
import { asyncHandler, ok, fail, HttpError } from '../utils/response';
import { getXpConfig } from '../utils/xp';
import { calculate } from '../services/xpEngine';
import { checkAchievements } from '../services/achievementChecker';
import { startOfToday, endOfToday, startOfDay, daysAgo } from '../utils/dates';

const router = Router();

// Daily nutrition targets for the single LevelUp user.
const PROTEIN_TARGET = 182;
const CALORIES_TARGET = 2400;
const MEAL_METRIC = 'meal_entry_protein';

/** Parse a "m:ss" pace string into seconds per km. Accepts a number too. */
function parsePaceToSeconds(pace: unknown): number | undefined {
  if (typeof pace === 'number') return pace;
  if (typeof pace === 'string' && pace.includes(':')) {
    const [min, sec] = pace.split(':').map((n) => parseInt(n, 10));
    if (!isNaN(min) && !isNaN(sec)) return min * 60 + sec;
  }
  return undefined;
}

// POST /metrics — log any metric
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const { metric_type, value, secondary_value, notes, pillar_id } = req.body ?? {};
    if (!metric_type) return fail(res, 'metric_type is required');
    if (typeof value !== 'number') return fail(res, 'value must be a number');

    const metric = await MetricsLog.create({
      user_id: user._id,
      pillar_id: pillar_id && Types.ObjectId.isValid(pillar_id) ? pillar_id : undefined,
      metric_type,
      value,
      secondary_value,
      notes,
      logged_at: new Date(),
    });

    // Logging a result metric may cross an achievement threshold.
    const achievements_unlocked = await checkAchievements(user._id as any);
    return ok(res, { metric, achievements_unlocked }, 201);
  })
);

// POST /metrics/sidequest — log a completed sidequest and award XP
router.post(
  '/sidequest',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const { title, description, link, date } = req.body ?? {};
    if (!title || typeof title !== 'string') return fail(res, 'title is required');

    const sidequest = await getPillarByName(user._id as any, PILLAR_NAMES.sideQuests);
    const notes = [title, description, link].filter(Boolean).join(' | ');

    await MetricsLog.create({
      user_id: user._id,
      pillar_id: sidequest._id,
      metric_type: 'sidequest',
      value: 1,
      notes,
      logged_at: date ? new Date(date) : new Date(),
    });

    const config = await getXpConfig(user._id as any);
    const xp_result = await calculate({
      userId: user._id as any,
      pillarId: sidequest._id as Types.ObjectId,
      eventType: 'task_complete',
      description: `Logged sidequest: ${title}`,
      baseXp: config.document_side_quest,
    });

    return ok(res, { xp_result }, 201);
  })
);

// POST /metrics/workout — log a full workout session
router.post(
  '/workout',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const { exercises, notes } = req.body ?? {};
    if (!Array.isArray(exercises) || exercises.length === 0) {
      return fail(res, 'exercises must be a non-empty array');
    }

    const fitness = await getPillarByName(user._id as any, PILLAR_NAMES.fitness);
    const metric = await MetricsLog.create({
      user_id: user._id,
      pillar_id: fitness._id,
      metric_type: 'workout',
      value: exercises.length,
      notes: notes ?? JSON.stringify(exercises),
      logged_at: new Date(),
    });

    const config = await getXpConfig(user._id as any);
    const xp_result = await calculate({
      userId: user._id as any,
      pillarId: fitness._id as Types.ObjectId,
      eventType: 'task_complete',
      description: 'Logged a workout',
      baseXp: config.log_workout,
    });

    return ok(res, { metric, xp_result }, 201);
  })
);

// POST /metrics/run — log a run
router.post(
  '/run',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const { distance_km, pace_per_km, duration_minutes } = req.body ?? {};
    if (typeof distance_km !== 'number') {
      return fail(res, 'distance_km must be a number');
    }
    const paceSeconds = parsePaceToSeconds(pace_per_km);

    const fitness = await getPillarByName(user._id as any, PILLAR_NAMES.fitness);
    const metric = await MetricsLog.create({
      user_id: user._id,
      pillar_id: fitness._id,
      metric_type: 'run',
      value: distance_km,
      secondary_value: paceSeconds,
      notes: duration_minutes != null ? `${duration_minutes} min` : undefined,
      logged_at: new Date(),
    });

    const config = await getXpConfig(user._id as any);
    const xp_result = await calculate({
      userId: user._id as any,
      pillarId: fitness._id as Types.ObjectId,
      eventType: 'task_complete',
      description: `Logged a ${distance_km}km run`,
      baseXp: config.log_run,
    });

    return ok(res, { metric, xp_result }, 201);
  })
);

// GET /metrics/pillar/:pillarId — metric history for a pillar
router.get(
  '/pillar/:pillarId',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const pillarId = req.params.pillarId as string;
    if (!Types.ObjectId.isValid(pillarId)) {
      return fail(res, 'Invalid pillarId');
    }
    const history = await MetricsLog.find({
      user_id: user._id,
      pillar_id: pillarId,
    })
      .sort({ logged_at: -1 })
      .lean();
    return ok(res, history);
  })
);

// GET /metrics/history?metric_type=X&days=N — time-series data for charts
router.get(
  '/history',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const { metric_type, days } = req.query;
    if (!metric_type || typeof metric_type !== 'string') {
      return fail(res, 'metric_type query param is required');
    }
    const lookback = Math.max(1, Math.min(365, Number(days) || 90));
    const since = startOfDay(daysAgo(lookback - 1));

    const history = await MetricsLog.find({
      user_id: user._id,
      metric_type,
      logged_at: { $gte: since },
    })
      .sort({ logged_at: 1 })
      .lean();

    return ok(res, history.map((m) => ({
      value: m.value,
      secondary_value: m.secondary_value,
      notes: m.notes,
      logged_at: m.logged_at,
    })));
  })
);

// GET /metrics/exercise-prs — best weight logged per exercise across all workouts
router.get(
  '/exercise-prs',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);

    const workouts = await MetricsLog.find({
      user_id: user._id,
      metric_type: 'workout',
    })
      .sort({ logged_at: 1 })
      .lean();

    const prMap = new Map<string, { weight: number; date: Date }>();

    for (const w of workouts) {
      let exercises: Array<{ name: string; weight?: number }> = [];
      try {
        exercises = JSON.parse(w.notes ?? '[]');
      } catch {
        continue;
      }
      for (const ex of exercises) {
        if (!ex.name || typeof ex.weight !== 'number') continue;
        const existing = prMap.get(ex.name);
        if (!existing || ex.weight > existing.weight) {
          prMap.set(ex.name, { weight: ex.weight, date: w.logged_at });
        }
      }
    }

    const prs = Array.from(prMap.entries()).map(([name, { weight, date }]) => ({
      exercise: name,
      weight_kg: weight,
      date,
    }));

    return ok(res, prs);
  })
);

// GET /metrics/latest — latest value per metric_type
router.get(
  '/latest',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const latest = await MetricsLog.aggregate([
      { $match: { user_id: user._id } },
      { $sort: { logged_at: -1 } },
      {
        $group: {
          _id: '$metric_type',
          value: { $first: '$value' },
          secondary_value: { $first: '$secondary_value' },
          logged_at: { $first: '$logged_at' },
          notes: { $first: '$notes' },
        },
      },
      { $project: { _id: 0, metric_type: '$_id', value: 1, secondary_value: 1, logged_at: 1, notes: 1 } },
    ]);
    return ok(res, latest);
  })
);

// ---------------------------------------------------------------------------
// Meal-level nutrition tracking.
//
// Mounted separately at /nutrition (see routes/index.ts) so the public paths
// are /api/v1/nutrition/*. Stored in metrics_log as MEAL_METRIC entries where
// value = protein (g) and secondary_value = calories.
// ---------------------------------------------------------------------------
const nutritionRouter = Router();

/** Recover the meal name from a stored "<name> — <notes>" note string. */
function mealNameFromNotes(notes?: string): string {
  if (!notes) return 'Meal';
  return notes.split(' — ')[0] as string;
}

/** Fetch today's meal entries for a user, sorted oldest-first. */
async function todaysMeals(userId: Types.ObjectId) {
  return MetricsLog.find({
    user_id: userId,
    metric_type: MEAL_METRIC,
    logged_at: { $gte: startOfToday(), $lte: endOfToday() },
  })
    .sort({ logged_at: 1 })
    .lean();
}

// POST /nutrition/meal — log a meal, return updated daily totals
nutritionRouter.post(
  '/meal',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const { meal_name, protein_g, calories, notes } = req.body ?? {};
    if (!meal_name) return fail(res, 'meal_name is required');
    if (typeof protein_g !== 'number') return fail(res, 'protein_g must be a number');
    if (typeof calories !== 'number') return fail(res, 'calories must be a number');

    await MetricsLog.create({
      user_id: user._id,
      metric_type: MEAL_METRIC,
      value: protein_g,
      secondary_value: calories,
      notes: notes ? `${meal_name} — ${notes}` : meal_name,
      logged_at: new Date(),
    });

    const meals = await todaysMeals(user._id as Types.ObjectId);
    const daily_protein_total = meals.reduce((sum, m) => sum + (m.value ?? 0), 0);
    const daily_calories_total = meals.reduce((sum, m) => sum + (m.secondary_value ?? 0), 0);
    const current_hour = new Date().getHours();

    return ok(
      res,
      {
        meal_logged: { meal_name, protein_g, calories },
        daily_totals: { protein_g: daily_protein_total, calories: daily_calories_total },
        protein_target: PROTEIN_TARGET,
        protein_remaining: PROTEIN_TARGET - daily_protein_total,
        on_track: daily_protein_total >= PROTEIN_TARGET * (current_hour / 24) * 0.8,
      },
      201
    );
  })
);

// GET /nutrition/today — all meals logged today + remaining targets
nutritionRouter.get(
  '/today',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const meals = await todaysMeals(user._id as Types.ObjectId);

    const total_protein = meals.reduce((sum, m) => sum + (m.value ?? 0), 0);
    const total_calories = meals.reduce((sum, m) => sum + (m.secondary_value ?? 0), 0);

    return ok(res, {
      meals: meals.map((m) => ({
        meal_name: mealNameFromNotes(m.notes),
        protein_g: m.value,
        calories: m.secondary_value ?? 0,
        logged_at: m.logged_at,
      })),
      daily_totals: { protein_g: total_protein, calories: total_calories },
      protein_target: PROTEIN_TARGET,
      protein_remaining: PROTEIN_TARGET - total_protein,
      calories_target: CALORIES_TARGET,
      calories_remaining: CALORIES_TARGET - total_calories,
    });
  })
);

// GET /nutrition/history?days=14 — daily nutrition summaries for the chart
nutritionRouter.get(
  '/history',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const days = Math.max(1, Math.min(365, Number(req.query.days) || 14));
    const since = startOfDay(daysAgo(days - 1));

    const entries = await MetricsLog.find({
      user_id: user._id,
      metric_type: MEAL_METRIC,
      logged_at: { $gte: since },
    })
      .sort({ logged_at: 1 })
      .lean();

    // Group by calendar date (server local time).
    const byDate = new Map<string, { total_protein: number; total_calories: number; meal_count: number }>();
    for (const m of entries) {
      const key = startOfDay(new Date(m.logged_at)).toISOString().slice(0, 10);
      const day = byDate.get(key) ?? { total_protein: 0, total_calories: 0, meal_count: 0 };
      day.total_protein += m.value ?? 0;
      day.total_calories += m.secondary_value ?? 0;
      day.meal_count += 1;
      byDate.set(key, day);
    }

    const history = Array.from(byDate.entries())
      .map(([date, totals]) => ({ date, ...totals }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return ok(res, history);
  })
);

export { nutritionRouter };

export default router;
