import 'dotenv/config';
import mongoose from 'mongoose';
import { User, Pillar, Achievement } from './models';

async function seedSideQuestAchievements() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const user = await User.findOne({ username: 'peter' });
  if (!user) throw new Error('User not found — is the DB seeded?');

  const sideQuests = await Pillar.findOne({ user_id: user._id, name: 'Side Quests' });
  if (!sideQuests) throw new Error('Side Quests pillar not found');

  const achievements = [
    { title: 'First Step',           description: 'Log your first side quest',                              xp_reward: 50,  trigger_value: 1  },
    { title: 'Weekend Warrior',       description: 'Log 5 side quests',                                     xp_reward: 100, trigger_value: 5  },
    { title: 'Explorer',              description: 'Log 10 side quests',                                    xp_reward: 200, trigger_value: 10 },
    { title: 'City Native',           description: 'Complete a side quest in 5 different Toronto neighborhoods', xp_reward: 300, trigger_value: 5  },
    { title: 'Comfort Zone Breached', description: 'Complete a quest tagged as uncomfortable',              xp_reward: 150, trigger_value: 1  },
    { title: 'Documentarian',         description: 'Log a side quest with a photo or link attached',        xp_reward: 75,  trigger_value: 1  },
    { title: 'Monthly Adventurer',    description: 'Complete at least 4 quests in a single month',         xp_reward: 250, trigger_value: 4  },
    { title: 'Solo Mission',          description: 'Complete a solo side quest',                            xp_reward: 100, trigger_value: 1  },
    { title: 'Social Quest',          description: 'Complete a side quest with other people',               xp_reward: 100, trigger_value: 1  },
    { title: 'The Streak',            description: 'Log side quests in 3 consecutive weeks',               xp_reward: 200, trigger_value: 3  },
  ];

  let inserted = 0;
  for (const a of achievements) {
    const exists = await Achievement.findOne({ user_id: user._id, title: a.title });
    if (exists) {
      console.log(`  skip (already exists): ${a.title}`);
      continue;
    }
    await Achievement.create({
      user_id: user._id,
      pillar_id: sideQuests._id,
      title: a.title,
      description: a.description,
      xp_reward: a.xp_reward,
      trigger_type: 'custom',
      trigger_metric: 'side_quest_count',
      trigger_value: a.trigger_value,
      is_triggered: false,
      triggered_at: undefined,
    });
    console.log(`  inserted: ${a.title}`);
    inserted++;
  }

  console.log(`Done — inserted ${inserted} new achievement(s).`);
  await mongoose.disconnect();
}

seedSideQuestAchievements().catch(err => {
  console.error(err);
  process.exit(1);
});
