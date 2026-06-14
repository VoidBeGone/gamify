import { Router } from 'express';
import { Types } from 'mongoose';
import { DailySchedule, Goal, ISubgoal, ITask, MetricsLog, Pillar, User, XpEvent } from '../models';
import { getUser, PILLAR_NAMES } from '../utils/context';
import { asyncHandler, ok, fail, HttpError } from '../utils/response';
import { getXpConfig, xpForDifficulty } from '../utils/xp';
import { calculate } from '../services/xpEngine';
import { recalcPillarRank, recalcGlobalRank } from '../services/ranks';
import { toDateString } from '../utils/dateHelpers';

const router = Router();

type Difficulty = 'easy' | 'medium' | 'hard' | 'epic';

/** Locate the subgoal containing a task with the given id, within a goal. */
function findSubgoalWithTask(
  goal: { subgoals: ISubgoal[] },
  taskId: string
): { subgoal: ISubgoal; task: ITask } | null {
  for (const subgoal of goal.subgoals) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const task = (subgoal.tasks as any).id(taskId) as ITask | null;
    if (task) return { subgoal, task };
  }
  return null;
}

// POST /tasks — add a task to a subgoal
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const {
      subgoal_id,
      title,
      description,
      scheduled_date,
      difficulty,
      base_xp,
      is_recurring,
      recurrence_pattern,
    } = req.body ?? {};
    if (!subgoal_id) return fail(res, 'subgoal_id is required');
    if (!title) return fail(res, 'title is required');

    const goal = await Goal.findOne({
      user_id: user._id,
      'subgoals._id': subgoal_id,
    });
    if (!goal) throw new HttpError(404, 'Subgoal not found');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subgoal = (goal.subgoals as any).id(subgoal_id);

    const diff: Difficulty = difficulty ?? 'easy';
    const config = await getXpConfig(user._id as any);
    const xp = typeof base_xp === 'number' ? base_xp : xpForDifficulty(config, diff);

    subgoal.tasks.push({
      title,
      description,
      scheduled_date,
      difficulty: diff,
      base_xp: xp,
      is_completed: false,
      is_recurring: !!is_recurring,
      recurrence_pattern: recurrence_pattern ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    await goal.save();
    return ok(res, subgoal.tasks[subgoal.tasks.length - 1], 201);
  })
);

// PATCH /tasks/:id/complete — find task across all goals, complete, run XP engine
router.patch(
  '/:id/complete',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const goal = await Goal.findOne({
      user_id: user._id,
      'subgoals.tasks._id': req.params.id,
    });
    if (!goal) throw new HttpError(404, 'Task not found');

    const found = findSubgoalWithTask(goal, req.params.id as string);
    if (!found) throw new HttpError(404, 'Task not found');
    const { task } = found;

    if (task.is_completed) return fail(res, 'Task already completed', 409);

    task.is_completed = true;
    task.completed_at = new Date();
    await goal.save();

    const result = await calculate({
      userId: user._id as any,
      pillarId: goal.pillar_id,
      eventType: 'task_complete',
      description: `Completed task: ${task.title}`,
      baseXp: task.base_xp,
    });

    const pillar = await Pillar.findById(goal.pillar_id).lean();
    const isPostTask = task.title.includes('Post') && pillar?.name === PILLAR_NAMES.content;
    if (isPostTask) {
      await MetricsLog.create({
        user_id: user._id,
        pillar_id: goal.pillar_id,
        metric_type: 'post_count',
        value: 1,
        notes: task.title,
        logged_at: new Date(),
      });
    }

    return ok(res, { task, xp_result: result, pillar_name: pillar?.name });
  })
);

// PATCH /tasks/:id/uncomplete — revert a completed task and deduct its XP
router.patch(
  '/:id/uncomplete',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const goal = await Goal.findOne({
      user_id: user._id,
      'subgoals.tasks._id': req.params.id,
    });
    if (!goal) throw new HttpError(404, 'Task not found');

    const found = findSubgoalWithTask(goal, req.params.id as string);
    if (!found) throw new HttpError(404, 'Task not found');
    const { task } = found;

    if (!task.is_completed) return fail(res, 'Task is not completed', 409);

    // Find the most recent XP event created when this task was completed
    const xpEvent = await XpEvent.findOne({
      user_id: user._id,
      event_type: 'task_complete',
      description: `Completed task: ${task.title}`,
      pillar_id: goal.pillar_id,
    }).sort({ created_at: -1 });

    const xpReverted = xpEvent?.xp_awarded ?? 0;

    // Revert the task
    task.is_completed = false;
    task.completed_at = undefined;
    await goal.save();

    if (xpReverted > 0 && xpEvent) {
      const [pillar, userDoc] = await Promise.all([
        Pillar.findById(goal.pillar_id),
        User.findById(user._id),
      ]);

      if (pillar) {
        pillar.xp = Math.max(0, pillar.xp - xpReverted);
        await recalcPillarRank(pillar);

        const isPostTask = task.title.includes('Post') && pillar.name === PILLAR_NAMES.content;
        if (isPostTask) {
          await MetricsLog.findOneAndDelete({
            user_id: user._id,
            metric_type: 'post_count',
            notes: task.title,
          }).sort({ logged_at: -1 });
        }

        await pillar.save();
      }

      if (userDoc) {
        userDoc.global_xp = Math.max(0, userDoc.global_xp - xpReverted);
        await recalcGlobalRank(userDoc);
        await userDoc.save();
      }

      await xpEvent.deleteOne();
    }

    return ok(res, { task, xp_reverted: xpReverted });
  })
);

// PATCH /tasks/:id/reschedule — change a task's scheduled_date
router.patch(
  '/:id/reschedule',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const { new_date } = req.body ?? {};
    if (!new_date) return fail(res, 'new_date is required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(new_date)) return fail(res, 'new_date must be YYYY-MM-DD');

    const goal = await Goal.findOne({
      user_id: user._id,
      'subgoals.tasks._id': req.params.id,
    });
    if (!goal) throw new HttpError(404, 'Task not found');

    const found = findSubgoalWithTask(goal, req.params.id as string);
    if (!found) throw new HttpError(404, 'Task not found');
    const { task } = found;

    const old_date = task.scheduled_date ? toDateString(task.scheduled_date) : null;
    task.scheduled_date = new Date(new_date);
    await goal.save();

    // Mirror the change in daily_schedule: move the task entry to the correct day
    const taskId = task._id as Types.ObjectId;
    const oldSchedule = await DailySchedule.findOne({
      user_id: user._id,
      'days.tasks.task_ref_id': taskId,
    });

    if (oldSchedule) {
      let movedTaskData: { task_ref_id: Types.ObjectId; title: string; pillar: string; xp: number; is_featured: boolean } | undefined;
      for (const day of oldSchedule.days) {
        const idx = day.tasks.findIndex((t) => t.task_ref_id.toString() === taskId.toString());
        if (idx !== -1) {
          const t = day.tasks[idx];
          movedTaskData = {
            task_ref_id: t.task_ref_id,
            title: t.title,
            pillar: t.pillar,
            xp: t.xp,
            is_featured: t.is_featured,
          };
          day.tasks.splice(idx, 1);
          break;
        }
      }

      if (movedTaskData) {
        // Find the day matching new_date across all user schedules
        const allSchedules = await DailySchedule.find({ user_id: user._id });
        let targetSchedule: typeof oldSchedule | undefined;
        let targetDayIdx = -1;

        for (const sched of allSchedules) {
          const idx = sched.days.findIndex((d) => toDateString(d.date) === new_date);
          if (idx !== -1) {
            targetSchedule = sched;
            targetDayIdx = idx;
            break;
          }
        }

        if (targetSchedule && targetDayIdx !== -1) {
          targetSchedule.days[targetDayIdx].tasks.push(movedTaskData as any);
          if (targetSchedule.id === oldSchedule.id) {
            await oldSchedule.save();
          } else {
            await Promise.all([oldSchedule.save(), targetSchedule.save()]);
          }
        } else {
          await oldSchedule.save();
        }
      }
    }

    return ok(res, { task_id: req.params.id, old_date, new_date });
  })
);

// DELETE /tasks/:id — remove a task
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const goal = await Goal.findOne({
      user_id: user._id,
      'subgoals.tasks._id': req.params.id,
    });
    if (!goal) throw new HttpError(404, 'Task not found');

    const found = findSubgoalWithTask(goal, req.params.id as string);
    if (!found) throw new HttpError(404, 'Task not found');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (found.subgoal.tasks as any).pull({ _id: req.params.id });
    await goal.save();
    return ok(res, { deleted_task_id: req.params.id });
  })
);

export default router;
