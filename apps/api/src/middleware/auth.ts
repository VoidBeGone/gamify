import { Request, Response, NextFunction } from 'express';
import { fail } from '../utils/response';

/**
 * Simple API key auth: compares the `x-api-key` header to process.env.API_KEY.
 * Single shared secret — sufficient for a personal single-user app.
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.API_KEY;
  if (!expected) {
    fail(res, 'Server misconfigured: API_KEY not set', 500);
    return;
  }
  const provided = req.header('x-api-key');
  if (!provided || provided !== expected) {
    fail(res, 'Unauthorized', 401);
    return;
  }
  next();
}
