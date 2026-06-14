import { Types } from 'mongoose';
import { Settings, IXpConfig } from '../models';

const DEFAULTS: IXpConfig = {
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
};

export async function getXpConfig(userId: Types.ObjectId): Promise<IXpConfig> {
  const settings = await Settings.findOne({ user_id: userId }).lean();
  return { ...DEFAULTS, ...(settings?.xp_config ?? {}) };
}

export function xpForDifficulty(
  config: IXpConfig,
  difficulty: 'easy' | 'medium' | 'hard' | 'epic'
): number {
  switch (difficulty) {
    case 'easy':
      return config.easy_task;
    case 'medium':
      return config.medium_task;
    case 'hard':
      return config.hard_task;
    case 'epic':
      return config.epic_subgoal;
  }
}
