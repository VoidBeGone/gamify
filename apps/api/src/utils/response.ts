import { Request, Response, NextFunction } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  error?: string;
}

export function ok<T>(res: Response, data: T, status = 200): Response {
  const body: ApiResponse<T> = { success: true, data };
  return res.status(status).json(body);
}

export function fail(res: Response, error: string, status = 400): Response {
  const body: ApiResponse<null> = { success: false, data: null, error };
  return res.status(status).json(body);
}

/**
 * Wraps an async route handler so any thrown error / rejected promise is
 * forwarded to the global error handler. Express 5 forwards rejections from
 * handlers automatically, but wrapping keeps the behaviour explicit and safe.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** Thrown by handlers/services to produce a clean HTTP error response. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}
