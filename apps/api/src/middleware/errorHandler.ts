import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../utils/response';

/** Global error handler — must be mounted last, after all routes. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ success: false, data: null, error: err.message });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  // Mongoose validation / cast errors → 400, everything else → 500.
  const isClientError =
    err instanceof Error &&
    (err.name === 'ValidationError' || err.name === 'CastError');
  const status = isClientError ? 400 : 500;

  if (status === 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }
  res.status(status).json({ success: false, data: null, error: message });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ success: false, data: null, error: 'Route not found' });
}
