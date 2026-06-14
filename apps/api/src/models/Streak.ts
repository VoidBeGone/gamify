import { Schema, model, Document, Types } from 'mongoose';

export type StreakType =
  | 'global'
  | 'fitness'
  | 'content'
  | 'sidequests'
  | 'nutrition'
  | 'posting'
  | 'workout';

export interface IStreak extends Document {
  user_id: Types.ObjectId;
  pillar_id?: Types.ObjectId;
  streak_type: StreakType;
  current_streak: number;
  longest_streak: number;
  last_active_date?: Date;
  created_at: Date;
  updated_at: Date;
}

const StreakSchema = new Schema<IStreak>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pillar_id: { type: Schema.Types.ObjectId, ref: 'Pillar', index: true },
    streak_type: {
      type: String,
      enum: ['global', 'fitness', 'content', 'sidequests', 'nutrition', 'posting', 'workout'],
      required: true,
    },
    current_streak: { type: Number, default: 0 },
    longest_streak: { type: Number, default: 0 },
    last_active_date: { type: Date },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const Streak = model<IStreak>('Streak', StreakSchema);
