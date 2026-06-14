import { Schema, model, Document, Types } from 'mongoose';

export type XpEventType =
  | 'task_complete'
  | 'subgoal_complete'
  | 'goal_complete'
  | 'achievement'
  | 'streak_bonus'
  | 'combo_bonus'
  | 'challenge_complete'
  | 'surprise';

export interface IXpEvent extends Document {
  user_id: Types.ObjectId;
  pillar_id?: Types.ObjectId;
  event_type: XpEventType;
  description: string;
  xp_awarded: number;
  multiplier_applied: number;
  created_at: Date;
  updated_at: Date;
}

const XpEventSchema = new Schema<IXpEvent>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pillar_id: { type: Schema.Types.ObjectId, ref: 'Pillar', index: true },
    event_type: {
      type: String,
      enum: [
        'task_complete',
        'subgoal_complete',
        'goal_complete',
        'achievement',
        'streak_bonus',
        'combo_bonus',
        'challenge_complete',
        'surprise',
      ],
      required: true,
    },
    description: { type: String, required: true },
    xp_awarded: { type: Number, required: true },
    multiplier_applied: { type: Number, default: 1.0 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const XpEvent = model<IXpEvent>('XpEvent', XpEventSchema);
