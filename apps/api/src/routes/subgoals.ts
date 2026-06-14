import { Router } from 'express';
import { Goal } from '../models';
import { getUser } from '../utils/context';
import { asyncHandler, ok, fail, HttpError } from '../utils/response';
import { getXpConfig, xpForDifficulty } from '../utils/xp';
import { calculate } from '../services/xpEngine';

const router = Router();

type Difficulty = 'easy' | 'medium' | 'hard' | 'epic';

// POST /subgoals — add a subgoal to a goal
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const { goal_id, title, description, difficulty, base_xp, deadline } = req.body ?? {};
    if (!goal_id) return fail(res, 'goal_id is required');
    if (!title) return fail(res, 'title is required');

    const goal = await Goal.findOne({ _id: goal_id, user_id: user._id });
    if (!goal) throw new HttpError(404, 'Goal not found');

    const diff: Difficulty = difficulty ?? 'medium';
    const config = await getXpConfig(user._id as any);
    const xp = typeof base_xp === 'number' ? base_xp : xpForDifficulty(config, diff);

    goal.subgoals.push({
      title,
      description,
      difficulty: diff,
      base_xp: xp,
      deadline,
      status: 'pending',
      tasks: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    await goal.save();
    return ok(res, goal.subgoals[goal.subgoals.length - 1], 201);
  })
);

// PATCH /subgoals/:id/complete — complete a subgoal, run the XP engine
router.patch(
  '/:id/complete',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const goal = await Goal.findOne({
      user_id: user._id,
      'subgoals._id': req.params.id,
    });
    if (!goal) throw new HttpError(404, 'Subgoal not found');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subgoal = (goal.subgoals as any).id(req.params.id);
    if (!subgoal) throw new HttpError(404, 'Subgoal not found');
    if (subgoal.status === 'completed') {
      return fail(res, 'Subgoal already completed', 409);
    }

    subgoal.status = 'completed';
    subgoal.completed_at = new Date();
    await goal.save();

    const result = await calculate({
      userId: user._id as any,
      pillarId: goal.pillar_id,
      eventType: 'subgoal_complete',
      description: `Completed subgoal: ${subgoal.title}`,
      baseXp: subgoal.base_xp,
    });

    return ok(res, { subgoal, xp_result: result });
  })
);

// DELETE /subgoals/:id — remove a subgoal and all its tasks
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const goal = await Goal.findOne({
      user_id: user._id,
      'subgoals._id': req.params.id,
    });
    if (!goal) throw new HttpError(404, 'Subgoal not found');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subgoal = (goal.subgoals as any).id(req.params.id);
    if (!subgoal) throw new HttpError(404, 'Subgoal not found');
    const tasks_removed: number = subgoal.tasks.length;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (goal.subgoals as any).pull({ _id: req.params.id });
    await goal.save();
    return ok(res, { deleted_subgoal_id: req.params.id, tasks_removed });
  })
);

export default router;
