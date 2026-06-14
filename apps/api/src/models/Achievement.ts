import { Schema, model, Document, Types } from 'mongoose';

export type TriggerType =
  | 'follower_milestone'
  | 'body_fat_milestone'
  | 'lift_pr'
  | 'run_milestone'
  | 'streak_milestone'
  | 'custom'
  | 'metric_count_total'
  | 'metric_count_window';

export interface IAchievement extends Document {
  user_id: Types.ObjectId;
  pillar_id?: Types.ObjectId;
  title: string;
  description?: string;
  xp_reward: number;
  trigger_type: TriggerType;
  trigger_metric: string;
  trigger_value: number;
  trigger_window_days?: number;
  is_triggered: boolean;
  triggered_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const AchievementSchema = new Schema<IAchievement>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pillar_id: { type: Schema.Types.ObjectId, ref: 'Pillar', index: true },
    title: { type: String, required: true },
    description: { type: String },
    xp_reward: { type: Number, required: true },
    trigger_type: {
      type: String,
      enum: ['follower_milestone', 'body_fat_milestone', 'lift_pr', 'run_milestone', 'streak_milestone', 'custom', 'metric_count_total', 'metric_count_window'],
      required: true,
    },
    trigger_metric: { type: String, required: true },
    trigger_value: { type: Number, required: true },
    trigger_window_days: { type: Number, default: null },
    is_triggered: { type: Boolean, default: false },
    triggered_at: { type: Date },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const Achievement = model<IAchievement>('Achievement', AchievementSchema);
