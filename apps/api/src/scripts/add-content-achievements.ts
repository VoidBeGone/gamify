import 'dotenv/config';
import mongoose from 'mongoose';
import { User, Pillar, Achievement } from '../models';

const ACHIEVEMENTS = [
  {
    title: 'First Post',
    description: 'Post your first Reel',
    xp_reward: 75,
    trigger_type: 'metric_count_total' as const,
    trigger_metric: 'post_count',
    trigger_value: 1,
    is_triggered: false,
  },
  {
    title: 'Getting Started',
    description: 'Post 5 Reels',
    xp_reward: 150,
    trigger_type: 'metric_count_total' as const,
    trigger_metric: 'post_count',
    trigger_value: 5,
    is_triggered: false,
  },
  {
    title: '10 and Counting',
    description: 'Post 10 Reels',
    xp_reward: 250,
    trigger_type: 'metric_count_total' as const,
    trigger_metric: 'post_count',
    trigger_value: 10,
    is_triggered: false,
  },
  {
    title: '30 Reels',
    description: 'Post 30 Reels total',
    xp_reward: 500,
    trigger_type: 'metric_count_total' as const,
    trigger_metric: 'post_count',
    trigger_value: 30,
    is_triggered: false,
  },
  {
    title: '30 for 30',
    description: 'Post 30 Reels in 30 consecutive days',
    xp_reward: 1000,
    trigger_type: 'metric_count_window' as const,
    trigger_metric: 'post_count',
    trigger_value: 30,
    trigger_window_days: 30,
    is_triggered: false,
  },
  {
    title: 'Consistency King',
    description: 'Post at least 3 Reels in a single week',
    xp_reward: 200,
    trigger_type: 'metric_count_window' as const,
    trigger_metric: 'post_count',
    trigger_value: 3,
    trigger_window_days: 7,
    is_triggered: false,
  },
];

async function addContentAchievements() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in .env');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const user = await User.findOne({ username: 'peter' });
  if (!user) throw new Error('User not found — is the DB seeded?');

  const content = await Pillar.findOne({ user_id: user._id, name: 'Content Creation' });
  if (!content) throw new Error('Content Creation pillar not found');

  let inserted = 0;
  for (const a of ACHIEVEMENTS) {
    const exists = await Achievement.findOne({ user_id: user._id, title: a.title });
    if (exists) {
      console.log(`  skip (already exists): ${a.title}`);
      continue;
    }
    await Achievement.create({
      user_id: user._id,
      pillar_id: content._id,
      ...a,
    });
    console.log(`  inserted: ${a.title}`);
    inserted++;
  }

  console.log(`Done — inserted ${inserted} new achievement(s).`);
  await mongoose.disconnect();
}

addContentAchievements().catch(err => {
  console.error(err);
  process.exit(1);
});
