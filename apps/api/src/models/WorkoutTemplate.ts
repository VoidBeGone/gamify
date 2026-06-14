import { Schema, model, Document, Types } from 'mongoose';

export type ExerciseType = 'weighted' | 'bodyweight' | 'cardio';

export interface IExercise {
  name: string;
  sets: number;
  reps: string;
  rest_seconds?: number;
  notes?: string;
  progression_note?: string;
  exercise_type?: ExerciseType;
}

export interface IWorkoutDay {
  day_name: string;
  session_type: string;
  exercises: IExercise[];
}

export interface IUserStatsAtGeneration {
  bodyweight_kg?: number;
  height_cm?: number;
  age?: number;
  body_fat_pct?: number;
  goal?: string;
}

export interface IWorkoutTemplate extends Document {
  user_id: Types.ObjectId;
  generated_at: Date;
  program_name: string;
  split_type: string;
  days_per_week: number;
  user_stats_at_generation: IUserStatsAtGeneration;
  equipment: string[];
  schedule: IWorkoutDay[];
  is_active: boolean;
  archived_at?: Date;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

const ExerciseSchema = new Schema<IExercise>(
  {
    name: { type: String, required: true },
    sets: { type: Number, required: true },
    reps: { type: String, required: true },
    rest_seconds: { type: Number },
    notes: { type: String },
    progression_note: { type: String },
    exercise_type: { type: String, enum: ['weighted', 'bodyweight', 'cardio'] },
  },
  { _id: false }
);

const WorkoutDaySchema = new Schema<IWorkoutDay>(
  {
    day_name: { type: String, required: true },
    session_type: { type: String, required: true },
    exercises: [ExerciseSchema],
  },
  { _id: false }
);

const UserStatsSchema = new Schema<IUserStatsAtGeneration>(
  {
    bodyweight_kg: { type: Number },
    height_cm: { type: Number },
    age: { type: Number },
    body_fat_pct: { type: Number },
    goal: { type: String },
  },
  { _id: false }
);

const WorkoutTemplateSchema = new Schema<IWorkoutTemplate>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    generated_at: { type: Date, default: Date.now },
    program_name: { type: String, required: true },
    split_type: { type: String, required: true },
    days_per_week: { type: Number, required: true },
    user_stats_at_generation: { type: UserStatsSchema },
    equipment: [{ type: String }],
    schedule: [WorkoutDaySchema],
    is_active: { type: Boolean, default: true },
    archived_at: { type: Date },
    notes: { type: String },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const WorkoutTemplate = model<IWorkoutTemplate>('WorkoutTemplate', WorkoutTemplateSchema);
