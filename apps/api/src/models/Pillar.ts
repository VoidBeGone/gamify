import { Schema, model, Document, Types } from 'mongoose';

export interface IPillar extends Document {
  user_id: Types.ObjectId;
  name: string;
  color: string;
  xp: number;
  rank_name: string;
  rank_tier: number;
  last_activity_date?: Date;
  neglect_status: 'healthy' | 'warning' | 'neglected' | 'critical';
  xp_multiplier: number;
  created_at: Date;
  updated_at: Date;
}

const PillarSchema = new Schema<IPillar>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    color: { type: String, required: true },
    xp: { type: Number, default: 0 },
    rank_name: { type: String, required: true },
    rank_tier: { type: Number, default: 1 },
    last_activity_date: { type: Date },
    neglect_status: {
      type: String,
      enum: ['healthy', 'warning', 'neglected', 'critical'],
      default: 'healthy',
    },
    xp_multiplier: { type: Number, default: 1.0 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const Pillar = model<IPillar>('Pillar', PillarSchema);
