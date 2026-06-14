import { Router } from 'express';
import { Streak } from '../models';
import { getUser } from '../utils/context';
import { asyncHandler, ok } from '../utils/response';

const router = Router();

// GET /streaks — all streaks for the user
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const streaks = await Streak.find({ user_id: user._id }).lean();
    return ok(res, streaks);
  })
);

export default router;
