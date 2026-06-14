import { Schema, model, Document, Types } from 'mongoose';

export interface IXpConfig {
  easy_task: number;
  medium_task: number;
  hard_task: number;
  epic_subgoal: number;
  log_nutrition: number;
  daily_challenge: number;
  surprise_challenge: number;
  post_reel: number;
  log_workout: number;
  log_run: number;
  document_side_quest: number;
}

export interface IBonusConfig {
  daily_sweep: number;
  all_pillar_day: number;
  weekly_consistency: number;
  comeback_bonus: number;
}

export interface ISettings extends Document {
  user_id: Types.ObjectId;
  xp_config: IXpConfig;
  bonus_config: IBonusConfig;
  created_at: Date;
  updated_at: Date;
}

const XpConfigSchema = new Schema<IXpConfig>(
  {
    easy_task: { type: Number, default: 10 },
    medium_task: { type: Number, default: 25 },
    hard_task: { type: Number, default: 50 },
    epic_subgoal: { type: Number, default: 100 },
    log_nutrition: { type: Number, default: 15 },
    daily_challenge: { type: Number, default: 30 },
    surprise_challenge: { type: Number, default: 50 },
    post_reel: { type: Number, default: 40 },
    log_workout: { type: Number, default: 30 },
    log_run: { type: Number, default: 25 },
    document_side_quest: { type: Number, default: 35 },
  },
  { _id: false }
);

const BonusConfigSchema = new Schema<IBonusConfig>(
  {
    daily_sweep: { type: Number, default: 50 },
    all_pillar_day: { type: Number, default: 75 },
    weekly_consistency: { type: Number, default: 100 },
    comeback_bonus: { type: Number, default: 50 },
  },
  { _id: false }
);

const SettingsSchema = new Schema<ISettings>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    xp_config: { type: XpConfigSchema, default: () => ({}) },
    bonus_config: { type: BonusConfigSchema, default: () => ({}) },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const Settings = model<ISettings>('Settings', SettingsSchema);
