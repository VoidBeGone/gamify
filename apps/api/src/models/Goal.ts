import { Schema, model, Document, Types } from 'mongoose';

export interface ITask {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  scheduled_date?: Date;
  difficulty: 'easy' | 'medium' | 'hard' | 'epic';
  base_xp: number;
  is_completed: boolean;
  completed_at?: Date;
  is_recurring: boolean;
  recurrence_pattern?: 'daily' | 'weekly' | null;
}

export interface ISubgoal {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'epic';
  base_xp: number;
  deadline?: Date;
  status: 'pending' | 'in_progress' | 'completed';
  completed_at?: Date;
  tasks: ITask[];
}

export interface IGoal extends Document {
  user_id: Types.ObjectId;
  pillar_id: Types.ObjectId;
  title: string;
  description?: string;
  deadline?: Date;
  status: 'active' | 'completed' | 'abandoned';
  subgoals: ISubgoal[];
  created_at: Date;
  updated_at: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true },
    description: { type: String },
    scheduled_date: { type: Date, index: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'epic'], required: true },
    base_xp: { type: Number, required: true },
    is_completed: { type: Boolean, default: false },
    completed_at: { type: Date },
    is_recurring: { type: Boolean, default: false },
    recurrence_pattern: { type: String, enum: ['daily', 'weekly', null] },
  },
  { _id: true }
);

const SubgoalSchema = new Schema<ISubgoal>(
  {
    title: { type: String, required: true },
    description: { type: String },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'epic'], required: true },
    base_xp: { type: Number, required: true },
    deadline: { type: Date },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending',
    },
    completed_at: { type: Date },
    tasks: [TaskSchema],
  },
  { _id: true }
);

const GoalSchema = new Schema<IGoal>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pillar_id: { type: Schema.Types.ObjectId, ref: 'Pillar', required: true, index: true },
    title: { type: String, required: true },
    description: { type: String },
    deadline: { type: Date },
    status: {
      type: String,
      enum: ['active', 'completed', 'abandoned'],
      default: 'active',
    },
    subgoals: [SubgoalSchema],
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const Goal = model<IGoal>('Goal', GoalSchema);
