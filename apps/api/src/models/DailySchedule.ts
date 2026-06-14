import { Schema, model, Document, Types } from 'mongoose';

export interface IScheduledTask {
  task_ref_id: Types.ObjectId;
  title: string;
  pillar: string;
  xp: number;
  is_featured: boolean;
}

export interface IDayChallenge {
  title: string;
  description?: string;
  xp: number;
  pillar?: string;
  is_surprise: boolean;
}

export interface IRunningTarget {
  target_distance_km: number;
  target_pace_per_km: string;
  notes?: string;
}

export interface IScheduleDay {
  date: Date;
  tasks: IScheduledTask[];
  challenge?: IDayChallenge;
  running_target?: IRunningTarget;
}

export interface IContextAtGeneration {
  followers?: number;
  weeks_to_deadline?: number;
  last_week_posts?: number;
  last_week_workouts?: number;
  current_run_distance?: number;
  current_run_pace?: number;
}

export interface IDailySchedule extends Document {
  user_id: Types.ObjectId;
  week_start: Date;
  generated_at: Date;
  generated_by: 'ai_session' | 'manual';
  context_at_generation: IContextAtGeneration;
  days: IScheduleDay[];
  created_at: Date;
  updated_at: Date;
}

const ScheduledTaskSchema = new Schema<IScheduledTask>(
  {
    task_ref_id: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true },
    pillar: { type: String, required: true },
    xp: { type: Number, required: true },
    is_featured: { type: Boolean, default: false },
  },
  { _id: false }
);

const DayChallengeSchema = new Schema<IDayChallenge>(
  {
    title: { type: String, required: true },
    description: { type: String },
    xp: { type: Number, required: true },
    pillar: { type: String },
    is_surprise: { type: Boolean, default: false },
  },
  { _id: false }
);

const RunningTargetSchema = new Schema<IRunningTarget>(
  {
    target_distance_km: { type: Number, required: true },
    target_pace_per_km: { type: String, required: true },
    notes: { type: String },
  },
  { _id: false }
);

const ContextAtGenerationSchema = new Schema<IContextAtGeneration>(
  {
    followers: { type: Number },
    weeks_to_deadline: { type: Number },
    last_week_posts: { type: Number },
    last_week_workouts: { type: Number },
    current_run_distance: { type: Number },
    current_run_pace: { type: Number },
  },
  { _id: false }
);

const ScheduleDaySchema = new Schema<IScheduleDay>(
  {
    date: { type: Date, required: true },
    tasks: [ScheduledTaskSchema],
    challenge: { type: DayChallengeSchema },
    running_target: { type: RunningTargetSchema },
  },
  { _id: false }
);

const DailyScheduleSchema = new Schema<IDailySchedule>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    week_start: { type: Date, required: true },
    generated_at: { type: Date, default: Date.now },
    generated_by: { type: String, enum: ['ai_session', 'manual'], required: true },
    context_at_generation: { type: ContextAtGenerationSchema },
    days: [ScheduleDaySchema],
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const DailySchedule = model<IDailySchedule>('DailySchedule', DailyScheduleSchema);
