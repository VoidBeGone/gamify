import { Router } from 'express';
import { Achievement } from '../models';
import { getUser } from '../utils/context';
import { asyncHandler, ok } from '../utils/response';
import { checkAchievements } from '../services/achievementChecker';

const router = Router();

// GET /achievements — all achievements for the user
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const achievements = await Achievement.find({ user_id: user._id })
      .sort({ pillar_id: 1, trigger_value: 1 })
      .lean();
    return ok(res, achievements);
  })
);

// POST /achievements/check — run achievement check against latest metrics
router.post(
  '/check',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const unlocked = await checkAchievements(user._id as any);
    return ok(res, { unlocked });
  })
);

export default router;
