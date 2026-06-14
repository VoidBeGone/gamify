import { Schema, Types, model, Document } from 'mongoose';

export interface IUser extends Document {
  username: string;
  global_xp: number;
  global_rank_name: string;
  global_rank_tier: number;
  nudge_message?: string;
  pending_celebrations: Types.ObjectId[];
  created_at: Date;
  updated_at: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true },
    global_xp: { type: Number, default: 0 },
    global_rank_name: { type: String, default: 'Civilian' },
    global_rank_tier: { type: Number, default: 1 },
    nudge_message: { type: String },
    pending_celebrations: [{ type: Schema.Types.ObjectId, ref: 'Achievement', default: [] }],
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const User = model<IUser>('User', UserSchema);
