import { Schema, model, Document, Types } from 'mongoose';

export interface IRankDefinition extends Document {
  pillar_id?: Types.ObjectId;
  rank_name: string;
  tier: 1 | 2 | 3;
  xp_required: number;
  display_order: number;
  created_at: Date;
  updated_at: Date;
}

const RankDefinitionSchema = new Schema<IRankDefinition>(
  {
    pillar_id: { type: Schema.Types.ObjectId, ref: 'Pillar', index: true },
    rank_name: { type: String, required: true },
    tier: { type: Number, enum: [1, 2, 3], required: true },
    xp_required: { type: Number, required: true },
    display_order: { type: Number, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const RankDefinition = model<IRankDefinition>('RankDefinition', RankDefinitionSchema);
