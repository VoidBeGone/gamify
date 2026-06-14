import 'dotenv/config';
import mongoose from 'mongoose';
import {
  User,
  Achievement,
  Streak,
  Goal,
  MetricsLog,
  XpEvent,
  DailySchedule,
  WorkoutTemplate,
} from '../models';

async function cleanDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set in .env');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // --- Drop collections entirely ---
  const toDrop = [Goal, MetricsLog, XpEvent, DailySchedule, WorkoutTemplate] as const;
  for (const Model of toDrop) {
    try {
      await Model.collection.drop();
      console.log(`Dropped: ${Model.collection.name}`);
    } catch (err: unknown) {
      const e = err as { codeName?: string; code?: number };
      if (e.codeName === 'NamespaceNotFound' || e.code === 26) {
        console.log(`Skipped (empty): ${Model.collection.name}`);
      } else {
        throw err;
      }
    }
  }

  // --- Reset achievements: all untriggered ---
  const { modifiedCount: achCount } = await Achievement.updateMany(
    {},
    { $set: { is_triggered: false }, $unset: { triggered_at: '' } },
  );
  console.log(`Reset ${achCount} achievements → is_triggered: false`);

  // --- Reset streaks: all zeroed ---
  const { modifiedCount: streakCount } = await Streak.updateMany(
    {},
    { $set: { current_streak: 0, longest_streak: 0 }, $unset: { last_active_date: '' } },
  );
  console.log(`Reset ${streakCount} streaks → 0`);

  // --- Reset user: XP zeroed, rank back to Civilian I ---
  const { modifiedCount: userCount } = await User.updateMany(
    {},
    {
      $set: {
        global_xp: 0,
        global_rank_name: 'Civilian',
        global_rank_tier: 1,
        pending_celebrations: [],
      },
      $unset: { nudge_message: '' },
    },
  );
  console.log(`Reset ${userCount} users → Civilian I, 0 XP`);

  console.log('Clean complete.');
  await mongoose.disconnect();
}

cleanDb().catch(err => {
  console.error(err);
  process.exit(1);
});
