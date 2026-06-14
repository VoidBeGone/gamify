import 'dotenv/config';
import mongoose from 'mongoose';
import { User, Pillar, RankDefinition, Achievement, Settings, Streak } from './models';

// XP thresholds derived from Section 4 rank ranges, split evenly into 3 tiers per rank
const RANK_TIERS = [
  { xp_required: 0,     display_order: 1  },
  { xp_required: 150,   display_order: 2  },
  { xp_required: 350,   display_order: 3  },
  { xp_required: 500,   display_order: 4  },
  { xp_required: 850,   display_order: 5  },
  { xp_required: 1200,  display_order: 6  },
  { xp_required: 1500,  display_order: 7  },
  { xp_required: 2200,  display_order: 8  },
  { xp_required: 2900,  display_order: 9  },
  { xp_required: 3500,  display_order: 10 },
  { xp_required: 5000,  display_order: 11 },
  { xp_required: 6500,  display_order: 12 },
  { xp_required: 7000,  display_order: 13 },
  { xp_required: 9500,  display_order: 14 },
  { xp_required: 11500, display_order: 15 },
  { xp_required: 13000, display_order: 16 },
  { xp_required: 17000, display_order: 17 },
  { xp_required: 22000, display_order: 18 },
];

function buildRanks(names: string[], pillar_id: mongoose.Types.ObjectId | null) {
  return names.flatMap((rank_name, rankIdx) =>
    ([1, 2, 3] as const).map((tier, tierIdx) => ({
      pillar_id,
      rank_name,
      tier,
      xp_required: RANK_TIERS[rankIdx * 3 + tierIdx].xp_required,
      display_order: RANK_TIERS[rankIdx * 3 + tierIdx].display_order,
    }))
  );
}

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in .env');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // Wipe existing seed data
  await Promise.all([
    User.deleteMany({}),
    Pillar.deleteMany({}),
    RankDefinition.deleteMany({}),
    Achievement.deleteMany({}),
    Settings.deleteMany({}),
    Streak.deleteMany({}),
  ]);

  // --- User ---
  const user = await User.create({
    username: 'peter',
    global_xp: 0,
    global_rank_name: 'Civilian',
    global_rank_tier: 1,
  });

  // --- Pillars ---
  const [fitness, content, sideQuests] = await Promise.all([
    Pillar.create({
      user_id: user._id,
      name: 'Fitness & Nutrition',
      color: '#22C55E',
      xp: 0,
      rank_name: 'Sedentary',
      rank_tier: 1,
      neglect_status: 'healthy',
      xp_multiplier: 1.0,
    }),
    Pillar.create({
      user_id: user._id,
      name: 'Content Creation',
      color: '#A855F7',
      xp: 0,
      rank_name: 'Unknown',
      rank_tier: 1,
      neglect_status: 'healthy',
      xp_multiplier: 1.0,
    }),
    Pillar.create({
      user_id: user._id,
      name: 'Side Quests',
      color: '#F59E0B',
      xp: 0,
      rank_name: 'Homebody',
      rank_tier: 1,
      neglect_status: 'healthy',
      xp_multiplier: 1.0,
    }),
  ]);

  // --- Rank Definitions ---
  await RankDefinition.insertMany([
    // Global ranks
    ...buildRanks(['Civilian', 'Wanderer', 'Striver', 'Achiever', 'Visionary', 'Legend'], null),
    // Fitness & Nutrition ranks
    ...buildRanks(['Sedentary', 'Active', 'Athlete', 'Beast', 'Elite', 'Apex'], fitness._id as mongoose.Types.ObjectId),
    // Content Creation ranks
    ...buildRanks(['Unknown', 'Rising', 'Creator', 'Influencer', 'Authority', 'Icon'], content._id as mongoose.Types.ObjectId),
    // Side Quest ranks
    ...buildRanks(['Homebody', 'Explorer', 'Adventurer', 'Wanderer', 'Maverick', 'Legend'], sideQuests._id as mongoose.Types.ObjectId),
  ]);

  // --- Achievements ---
  const contentAchievements = [
    {
      title: '100 Followers',
      description: 'Reach 100 Instagram followers',
      xp_reward: 50,
      trigger_type: 'follower_milestone' as const,
      trigger_metric: 'followers',
      trigger_value: 100,
      pillar_id: content._id,
    },
    {
      title: '500 Followers',
      description: 'Reach 500 Instagram followers',
      xp_reward: 150,
      trigger_type: 'follower_milestone' as const,
      trigger_metric: 'followers',
      trigger_value: 500,
      pillar_id: content._id,
    },
    {
      title: '1,000 Followers',
      description: 'Reach 1,000 Instagram followers',
      xp_reward: 300,
      trigger_type: 'follower_milestone' as const,
      trigger_metric: 'followers',
      trigger_value: 1000,
      pillar_id: content._id,
    },
    {
      title: '5,000 Followers',
      description: 'Reach 5,000 Instagram followers',
      xp_reward: 750,
      trigger_type: 'follower_milestone' as const,
      trigger_metric: 'followers',
      trigger_value: 5000,
      pillar_id: content._id,
    },
    {
      title: '10,000 Followers',
      description: 'Reach 10,000 Instagram followers — the goal',
      xp_reward: 2000,
      trigger_type: 'follower_milestone' as const,
      trigger_metric: 'followers',
      trigger_value: 10000,
      pillar_id: content._id,
    },
    {
      title: 'First Reel Over 1K Views',
      description: 'Have a reel reach 1,000 views',
      xp_reward: 100,
      trigger_type: 'custom' as const,
      trigger_metric: 'video_views',
      trigger_value: 1000,
      pillar_id: content._id,
    },
    {
      title: 'First Reel Over 10K Views',
      description: 'Have a reel reach 10,000 views',
      xp_reward: 300,
      trigger_type: 'custom' as const,
      trigger_metric: 'video_views',
      trigger_value: 10000,
      pillar_id: content._id,
    },
    {
      title: 'First Reel Over 100K Views',
      description: 'Have a reel reach 100,000 views',
      xp_reward: 1000,
      trigger_type: 'custom' as const,
      trigger_metric: 'video_views',
      trigger_value: 100000,
      pillar_id: content._id,
    },
  ];

  const fitnessAchievements = [
    {
      title: 'First Workout',
      description: 'Log your first workout',
      xp_reward: 50,
      trigger_type: 'custom' as const,
      trigger_metric: 'workouts_logged',
      trigger_value: 1,
      pillar_id: fitness._id,
    },
    {
      title: '10 Workouts Logged',
      description: 'Log 10 workouts total',
      xp_reward: 100,
      trigger_type: 'custom' as const,
      trigger_metric: 'workouts_logged',
      trigger_value: 10,
      pillar_id: fitness._id,
    },
    {
      title: 'Lost 1% Body Fat',
      description: 'Reduce body fat percentage by 1%',
      xp_reward: 75,
      trigger_type: 'body_fat_milestone' as const,
      trigger_metric: 'body_fat_pct_delta',
      trigger_value: 1,
      pillar_id: fitness._id,
    },
    {
      title: 'Lost 5% Body Fat',
      description: 'Reduce body fat percentage by 5%',
      xp_reward: 300,
      trigger_type: 'body_fat_milestone' as const,
      trigger_metric: 'body_fat_pct_delta',
      trigger_value: 5,
      pillar_id: fitness._id,
    },
    {
      title: 'Gained 2lbs Muscle',
      description: 'Track 2lbs of lean mass gain',
      xp_reward: 100,
      trigger_type: 'custom' as const,
      trigger_metric: 'lean_mass_gained_lbs',
      trigger_value: 2,
      pillar_id: fitness._id,
    },
    {
      title: 'First 5km Run',
      description: 'Complete a continuous 5km run with no breaks',
      xp_reward: 150,
      trigger_type: 'run_milestone' as const,
      trigger_metric: 'run_distance_km',
      trigger_value: 5,
      pillar_id: fitness._id,
    },
    {
      title: 'First 10km Run',
      description: 'Complete a 10km run',
      xp_reward: 300,
      trigger_type: 'run_milestone' as const,
      trigger_metric: 'run_distance_km',
      trigger_value: 10,
      pillar_id: fitness._id,
    },
    {
      title: 'Sub 7:00/km Pace',
      description: 'Complete a run at sub 7:00/km pace',
      xp_reward: 100,
      trigger_type: 'run_milestone' as const,
      // stored as seconds per km so we can do numeric comparisons
      trigger_metric: 'run_pace_seconds_per_km',
      trigger_value: 420,
      pillar_id: fitness._id,
    },
    {
      title: 'Sub 6:00/km Pace',
      description: 'Complete a run at sub 6:00/km pace',
      xp_reward: 200,
      trigger_type: 'run_milestone' as const,
      trigger_metric: 'run_pace_seconds_per_km',
      trigger_value: 360,
      pillar_id: fitness._id,
    },
    {
      title: 'Lift PR',
      description: 'Set a personal record on any lift',
      xp_reward: 60,
      trigger_type: 'lift_pr' as const,
      trigger_metric: 'lift_weight_kg',
      trigger_value: 0,
      pillar_id: fitness._id,
    },
    {
      title: '7-Day Nutrition Streak',
      description: 'Log nutrition for 7 consecutive days',
      xp_reward: 100,
      trigger_type: 'streak_milestone' as const,
      trigger_metric: 'nutrition_streak',
      trigger_value: 7,
      pillar_id: fitness._id,
    },
    {
      title: '30-Day Nutrition Streak',
      description: 'Log nutrition for 30 consecutive days',
      xp_reward: 300,
      trigger_type: 'streak_milestone' as const,
      trigger_metric: 'nutrition_streak',
      trigger_value: 30,
      pillar_id: fitness._id,
    },
  ];

  const sideQuestAchievements = [
    {
      title: 'First Step',
      description: 'Log your first side quest',
      xp_reward: 50,
      trigger_type: 'custom' as const,
      trigger_metric: 'side_quest_count',
      trigger_value: 1,
      pillar_id: sideQuests._id,
    },
    {
      title: 'Weekend Warrior',
      description: 'Log 5 side quests',
      xp_reward: 100,
      trigger_type: 'custom' as const,
      trigger_metric: 'side_quest_count',
      trigger_value: 5,
      pillar_id: sideQuests._id,
    },
    {
      title: 'Explorer',
      description: 'Log 10 side quests',
      xp_reward: 200,
      trigger_type: 'custom' as const,
      trigger_metric: 'side_quest_count',
      trigger_value: 10,
      pillar_id: sideQuests._id,
    },
    {
      title: 'City Native',
      description: 'Complete a side quest in 5 different Toronto neighborhoods',
      xp_reward: 300,
      trigger_type: 'custom' as const,
      trigger_metric: 'side_quest_count',
      trigger_value: 5,
      pillar_id: sideQuests._id,
    },
    {
      title: 'Comfort Zone Breached',
      description: 'Complete a quest tagged as uncomfortable',
      xp_reward: 150,
      trigger_type: 'custom' as const,
      trigger_metric: 'side_quest_count',
      trigger_value: 1,
      pillar_id: sideQuests._id,
    },
    {
      title: 'Documentarian',
      description: 'Log a side quest with a photo or link attached',
      xp_reward: 75,
      trigger_type: 'custom' as const,
      trigger_metric: 'side_quest_count',
      trigger_value: 1,
      pillar_id: sideQuests._id,
    },
    {
      title: 'Monthly Adventurer',
      description: 'Complete at least 4 quests in a single month',
      xp_reward: 250,
      trigger_type: 'custom' as const,
      trigger_metric: 'side_quest_count',
      trigger_value: 4,
      pillar_id: sideQuests._id,
    },
    {
      title: 'Solo Mission',
      description: 'Complete a solo side quest',
      xp_reward: 100,
      trigger_type: 'custom' as const,
      trigger_metric: 'side_quest_count',
      trigger_value: 1,
      pillar_id: sideQuests._id,
    },
    {
      title: 'Social Quest',
      description: 'Complete a side quest with other people',
      xp_reward: 100,
      trigger_type: 'custom' as const,
      trigger_metric: 'side_quest_count',
      trigger_value: 1,
      pillar_id: sideQuests._id,
    },
    {
      title: 'The Streak',
      description: 'Log side quests in 3 consecutive weeks',
      xp_reward: 200,
      trigger_type: 'custom' as const,
      trigger_metric: 'side_quest_count',
      trigger_value: 3,
      pillar_id: sideQuests._id,
    },
  ];

  await Achievement.insertMany([
    ...contentAchievements.map(a => ({ ...a, user_id: user._id, is_triggered: false, triggered_at: null })),
    ...fitnessAchievements.map(a => ({ ...a, user_id: user._id, is_triggered: false, triggered_at: null })),
    ...sideQuestAchievements.map(a => ({ ...a, user_id: user._id, is_triggered: false, triggered_at: null })),
  ]);

  // --- Settings ---
  await Settings.create({
    user_id: user._id,
    xp_config: {
      easy_task: 10,
      medium_task: 25,
      hard_task: 50,
      epic_subgoal: 100,
      log_nutrition: 15,
      daily_challenge: 30,
      surprise_challenge: 50,
      post_reel: 40,
      log_workout: 30,
      log_run: 25,
      document_side_quest: 35,
    },
    bonus_config: {
      daily_sweep: 50,
      all_pillar_day: 75,
      weekly_consistency: 100,
      comeback_bonus: 50,
    },
  });

  // --- Streaks ---
  await Streak.insertMany([
    { user_id: user._id, pillar_id: null,            streak_type: 'global',     current_streak: 0, longest_streak: 0 },
    { user_id: user._id, pillar_id: fitness._id,     streak_type: 'fitness',    current_streak: 0, longest_streak: 0 },
    { user_id: user._id, pillar_id: fitness._id,     streak_type: 'workout',    current_streak: 0, longest_streak: 0 },
    { user_id: user._id, pillar_id: fitness._id,     streak_type: 'nutrition',  current_streak: 0, longest_streak: 0 },
    { user_id: user._id, pillar_id: content._id,     streak_type: 'content',    current_streak: 0, longest_streak: 0 },
    { user_id: user._id, pillar_id: content._id,     streak_type: 'posting',    current_streak: 0, longest_streak: 0 },
    { user_id: user._id, pillar_id: sideQuests._id,  streak_type: 'sidequests', current_streak: 0, longest_streak: 0 },
  ]);

  console.log('Seed complete');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
