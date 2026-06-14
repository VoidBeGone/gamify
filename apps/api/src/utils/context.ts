import { Request } from 'express';
import { Types } from 'mongoose';
import { User, IUser, Pillar, IPillar } from '../models';
import { HttpError } from './response';

/**
 * LevelUp is a single-user app. We resolve "the current user" from the
 * `x-user-id` header when present, otherwise fall back to the only User
 * document in the database.
 */
export async function getUser(req: Request): Promise<IUser> {
  const headerId = req.header('x-user-id');
  if (headerId && Types.ObjectId.isValid(headerId)) {
    const user = await User.findById(headerId);
    if (!user) throw new HttpError(404, 'User not found');
    return user;
  }
  const user = await User.findOne().sort({ created_at: 1 });
  if (!user) throw new HttpError(404, 'No user exists — run the seed script first');
  return user;
}

/** Canonical pillar names as created by the seed. */
export const PILLAR_NAMES = {
  fitness: 'Fitness & Nutrition',
  content: 'Content Creation',
  sideQuests: 'Side Quests',
} as const;

export async function getPillarByName(
  userId: Types.ObjectId,
  name: string
): Promise<IPillar> {
  const pillar = await Pillar.findOne({ user_id: userId, name });
  if (!pillar) throw new HttpError(404, `Pillar "${name}" not found`);
  return pillar;
}
