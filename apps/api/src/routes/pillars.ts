import { Router } from 'express';
import { Pillar } from '../models';
import { getUser } from '../utils/context';
import { asyncHandler, ok, HttpError } from '../utils/response';
import { runDebuffEngine } from '../services/debuffEngine';
import { recalcPillarRank } from '../services/ranks';

const router = Router();

// POST /pillars — create a new pillar
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const { name, color } = req.body ?? {};
    if (!name?.trim()) throw new HttpError(400, 'name is required');
    if (!color?.trim()) throw new HttpError(400, 'color is required');
    const pillar = new Pillar({
      user_id: user._id,
      name: name.trim(),
      color: color.trim(),
      xp: 0,
      rank_name: 'Civilian',
      rank_tier: 1,
      neglect_status: 'healthy',
      xp_multiplier: 1.0,
    });
    await recalcPillarRank(pillar);
    await pillar.save();
    return ok(res, pillar);
  })
);

// GET /pillars — all pillars with rank, XP, debuff status (refreshed)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    // refresh debuff state so the dashboard always sees current status
    const pillars = await runDebuffEngine(user._id as any);
    return ok(res, pillars);
  })
);

// GET /pillars/:id — single pillar
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const pillar = await Pillar.findOne({ _id: req.params.id, user_id: user._id });
    if (!pillar) throw new HttpError(404, 'Pillar not found');
    return ok(res, pillar);
  })
);

export default router;
