import 'dotenv/config';
import mongoose from 'mongoose';
import { WorkoutTemplate } from '../models';
import type { ExerciseType } from '../models';

const BODYWEIGHT_KEYWORDS = [
  'pull-up', 'pull up', 'pullup',
  'chin-up', 'chin up', 'chinup',
  'push-up', 'push up', 'pushup',
  'dip',
  'plank',
  'hanging knee raise', 'knee raise',
  'crunch', 'sit-up', 'sit up', 'situp',
  'mountain climber',
  'burpee',
  'jumping jack',
  'bodyweight',
  'ab ', 'abs',
];

const CARDIO_KEYWORDS = [
  'treadmill',
  'interval',
  'running',
  'cardio',
  'conditioning',
  'sprint',
  'jog',
];

function classifyExercise(name: string): ExerciseType {
  const lower = name.toLowerCase();
  if (BODYWEIGHT_KEYWORDS.some(k => lower.includes(k))) return 'bodyweight';
  if (CARDIO_KEYWORDS.some(k => lower.includes(k))) return 'cardio';
  return 'weighted';
}

async function addExerciseTypes() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set in .env');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const templates = await WorkoutTemplate.find({ is_active: true });

  if (!templates.length) {
    console.log('No active workout templates found — nothing to do.');
    await mongoose.disconnect();
    return;
  }

  for (const template of templates) {
    let changed = 0;
    for (const day of template.schedule) {
      for (const ex of day.exercises) {
        const type = classifyExercise(ex.name);
        if (ex.exercise_type !== type) {
          const prev = ex.exercise_type ?? '(unset)';
          ex.exercise_type = type;
          console.log(`  [${day.day_name}] ${ex.name}: ${prev} → ${type}`);
          changed++;
        }
      }
    }
    if (changed > 0) {
      await template.save();
      console.log(`Saved "${template.program_name}": ${changed} exercise(s) updated`);
    } else {
      console.log(`"${template.program_name}": already up to date`);
    }
  }

  console.log('Done.');
  await mongoose.disconnect();
}

addExerciseTypes().catch(err => {
  console.error(err);
  process.exit(1);
});
