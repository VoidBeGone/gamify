import { Router } from 'express';
import { WorkoutTemplate } from '../models';
import { getUser } from '../utils/context';
import { asyncHandler, ok, fail, HttpError } from '../utils/response';
import { getNow } from '../utils/dates';

const router = Router();

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

// GET /workout/template — active workout template
router.get(
  '/template',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const template = await WorkoutTemplate.findOne({
      user_id: user._id,
      is_active: true,
    }).sort({ generated_at: -1 });
    if (!template) throw new HttpError(404, 'No active workout template');
    return ok(res, template);
  })
);

// POST /workout/template — save new template, deactivate the old one
router.post(
  '/template',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const body = req.body ?? {};
    if (!body.program_name || !body.split_type || body.days_per_week == null) {
      return fail(res, 'program_name, split_type and days_per_week are required');
    }

    await WorkoutTemplate.updateMany(
      { user_id: user._id, is_active: true },
      { $set: { is_active: false } }
    );

    const template = await WorkoutTemplate.create({
      user_id: user._id,
      generated_at: new Date(),
      program_name: body.program_name,
      split_type: body.split_type,
      days_per_week: body.days_per_week,
      user_stats_at_generation: body.user_stats_at_generation ?? {},
      equipment: body.equipment ?? [],
      schedule: body.schedule ?? [],
      is_active: true,
      notes: body.notes,
    });
    return ok(res, template, 201);
  })
);

// POST /workout/archive — archive the current active template
router.post(
  '/archive',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const template = await WorkoutTemplate.findOne({
      user_id: user._id,
      is_active: true,
    }).sort({ generated_at: -1 });
    if (!template) throw new HttpError(404, 'No active workout template to archive');

    template.is_active = false;
    template.archived_at = new Date();
    await template.save();
    return ok(res, template);
  })
);

// GET /workout/history — all workout templates sorted by created_at desc
router.get(
  '/history',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const templates = await WorkoutTemplate.find({ user_id: user._id })
      .sort({ created_at: -1 })
      .lean();
    return ok(res, templates);
  })
);

// GET /workout/today — today's session from the active template
router.get(
  '/today',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const template = await WorkoutTemplate.findOne({
      user_id: user._id,
      is_active: true,
    }).sort({ generated_at: -1 });
    if (!template) throw new HttpError(404, 'No active workout template');

    const todayName = DAY_NAMES[getNow().getDay()];
    const session =
      template.schedule.find(
        (d) => d.day_name.toLowerCase() === todayName.toLowerCase()
      ) ?? null;

    return ok(res, {
      day_name: todayName,
      session,
      is_rest_day: session == null,
      program_name: template.program_name,
    });
  })
);

export default router;
