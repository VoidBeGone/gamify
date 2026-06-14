import { Router } from 'express';
import tasks from './tasks';
import goals from './goals';
import subgoals from './subgoals';
import metrics, { nutritionRouter } from './metrics';
import pillars from './pillars';
import workout from './workout';
import schedule from './schedule';
import dashboard from './dashboard';
import challenges from './challenges';
import achievements from './achievements';
import streaks from './streaks';
import review from './review';
import settings from './settings';
import admin from './admin';
import progress from './progress';
import history from './history';
import xp from './xp';

/** The /api/v1 router — mounts every resource router. */
const apiRouter = Router();

apiRouter.use('/tasks', tasks);
apiRouter.use('/goals', goals);
apiRouter.use('/subgoals', subgoals);
apiRouter.use('/metrics', metrics);
apiRouter.use('/nutrition', nutritionRouter);
apiRouter.use('/pillars', pillars);
apiRouter.use('/workout', workout);
apiRouter.use('/schedule', schedule);
apiRouter.use('/dashboard', dashboard);
apiRouter.use('/challenges', challenges);
apiRouter.use('/achievements', achievements);
apiRouter.use('/streaks', streaks);
apiRouter.use('/review', review);
apiRouter.use('/settings', settings);
apiRouter.use('/admin', admin);
apiRouter.use('/progress', progress);
apiRouter.use('/history', history);
apiRouter.use('/xp', xp);

export default apiRouter;
