import { Router } from 'express';
import { Achievement, Pillar, RankDefinition, Settings } from '../models';
import { getUser } from '../utils/context';
import { asyncHandler, ok, fail, HttpError } from '../utils/response';

const router = Router();

// GET /settings/ranks — all rank definitions (global + per pillar)
router.get(
  '/ranks',
  asyncHandler(async (_req, res) => {
    const [ranks, pillars] = await Promise.all([
      RankDefinition.find().sort({ pillar_id: 1, display_order: 1 }).lean(),
      Pillar.find().select('_id name color').lean(),
    ]);
    return ok(res, { ranks, pillars });
  })
);

// GET /settings — user settings
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    let settings = await Settings.findOne({ user_id: user._id });
    if (!settings) {
      settings = await Settings.create({ user_id: user._id });
    }
    return ok(res, settings);
  })
);

// PATCH /settings/xp — update xp_config
router.patch(
  '/xp',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const updates = req.body ?? {};
    const settings = await Settings.findOne({ user_id: user._id });
    if (!settings) throw new HttpError(404, 'Settings not found');

    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'number') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (settings.xp_config as any)[key] = value;
      }
    }
    settings.markModified('xp_config');
    await settings.save();
    return ok(res, settings);
  })
);

// PATCH /settings/ranks — add/update rank definitions
router.patch(
  '/ranks',
  asyncHandler(async (req, res) => {
    await getUser(req);
    const ranks = Array.isArray(req.body?.ranks) ? req.body.ranks : req.body;
    if (!Array.isArray(ranks)) {
      return fail(res, 'Provide an array of rank definitions (body or body.ranks)');
    }

    const results = [];
    for (const r of ranks) {
      if (!r.rank_name || r.tier == null) continue;
      const def = await RankDefinition.findOneAndUpdate(
        { pillar_id: r.pillar_id ?? null, rank_name: r.rank_name, tier: r.tier },
        {
          $set: {
            pillar_id: r.pillar_id ?? null,
            rank_name: r.rank_name,
            tier: r.tier,
            xp_required: r.xp_required ?? 0,
            display_order: r.display_order ?? 0,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      results.push(def);
    }
    return ok(res, results);
  })
);

// PATCH /settings/achievements — add/update achievement definitions
router.patch(
  '/achievements',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const items = Array.isArray(req.body?.achievements)
      ? req.body.achievements
      : req.body;
    if (!Array.isArray(items)) {
      return fail(res, 'Provide an array of achievements (body or body.achievements)');
    }

    const results = [];
    for (const a of items) {
      if (a._id) {
        const updated = await Achievement.findOneAndUpdate(
          { _id: a._id, user_id: user._id },
          { $set: a },
          { new: true }
        );
        if (updated) results.push(updated);
      } else {
        if (!a.title || !a.trigger_type || !a.trigger_metric) continue;
        const created = await Achievement.create({
          ...a,
          user_id: user._id,
          is_triggered: false,
        });
        results.push(created);
      }
    }
    return ok(res, results);
  })
);

export default router;
