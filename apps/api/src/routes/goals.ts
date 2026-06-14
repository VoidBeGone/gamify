import { Router } from 'express';
import { Types } from 'mongoose';
import { Goal, Pillar } from '../models';
import { getUser } from '../utils/context';
import { asyncHandler, ok, fail, HttpError } from '../utils/response';

const router = Router();

// GET /goals/summary — all active goals with subgoal progress (used by MCP)
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const [pillars, goals] = await Promise.all([
      Pillar.find({ user_id: user._id }).lean(),
      Goal.find({ user_id: user._id, status: 'active' }).lean(),
    ]);

    const pillarMap = new Map(pillars.map((p) => [p._id.toString(), p]));

    const summary = goals.map((g) => {
      const pillar = pillarMap.get(g.pillar_id.toString());
      const subgoals = (g.subgoals ?? []).map((sg) => {
        const tasks = sg.tasks ?? [];
        const completed = tasks.filter((t) => t.is_completed).length;
        const nextTask = tasks
          .filter((t) => !t.is_completed && t.scheduled_date)
          .sort((a, b) => new Date(a.scheduled_date!).getTime() - new Date(b.scheduled_date!).getTime())[0];
        return {
          _id: sg._id,
          title: sg.title,
          status: sg.status,
          task_count: tasks.length,
          completed_task_count: completed,
          next_scheduled_task_date: nextTask?.scheduled_date ?? null,
        };
      });
      return {
        _id: g._id,
        pillar_id: g.pillar_id,
        pillar_name: pillar?.name ?? 'Unknown',
        title: g.title,
        deadline: g.deadline,
        subgoals,
      };
    });

    return ok(res, summary);
  })
);

// POST /goals — create a goal with an empty subgoals array
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const { pillar_id, title, description, deadline } = req.body ?? {};
    if (!pillar_id || !Types.ObjectId.isValid(pillar_id)) {
      return fail(res, 'A valid pillar_id is required');
    }
    if (!title) return fail(res, 'title is required');

    const pillar = await Pillar.findOne({ _id: pillar_id, user_id: user._id });
    if (!pillar) throw new HttpError(404, 'Pillar not found');

    const goal = await Goal.create({
      user_id: user._id,
      pillar_id,
      title,
      description,
      deadline,
      status: 'active',
      subgoals: [],
    });
    return ok(res, goal, 201);
  })
);

// GET /goals — all goals grouped by pillar, with embedded subgoals + tasks
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const [pillars, goals] = await Promise.all([
      Pillar.find({ user_id: user._id }).lean(),
      Goal.find({ user_id: user._id }).lean(),
    ]);

    const grouped = pillars.map((pillar) => ({
      pillar: { _id: pillar._id, name: pillar.name, color: pillar.color },
      goals: goals.filter((g) => g.pillar_id.toString() === pillar._id.toString()),
    }));
    return ok(res, grouped);
  })
);

// GET /goals/:id — single goal with full subgoal tree
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const goal = await Goal.findOne({ _id: req.params.id, user_id: user._id });
    if (!goal) throw new HttpError(404, 'Goal not found');
    return ok(res, goal);
  })
);

// PATCH /goals/:id — update goal fields
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const goal = await Goal.findOne({ _id: req.params.id, user_id: user._id });
    if (!goal) throw new HttpError(404, 'Goal not found');

    const allowed = ['title', 'description', 'deadline', 'status', 'pillar_id'] as const;
    for (const key of allowed) {
      if (req.body?.[key] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (goal as any)[key] = req.body[key];
      }
    }
    await goal.save();
    return ok(res, goal);
  })
);

// DELETE /goals/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const result = await Goal.findOneAndDelete({ _id: req.params.id, user_id: user._id });
    if (!result) throw new HttpError(404, 'Goal not found');
    return ok(res, { deleted_goal_id: req.params.id });
  })
);

export default router;
