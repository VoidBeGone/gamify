import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db';
import { apiKeyAuth } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import apiRouter from './routes';
import { initScheduler } from './services/scheduler';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// --- CORS: localhost dev + production domain ---
const allowedOrigins = [
  'http://localhost:3000',
  'https://petersyoo.com',
  'https://www.petersyoo.com',
  'http://10.0.0.243:3000',
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()) : []),
];
app.use(
  cors({
    origin(origin, callback) {
      // allow non-browser clients (curl, server-to-server) with no Origin header
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    allowedHeaders: ['Content-Type', 'x-api-key', 'x-user-id'],
  })
);

// --- Body parsing ---
app.use(express.json());

// --- Health check (no auth) ---
app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

// --- API key auth on everything under /api ---
app.use('/api', apiKeyAuth);

// --- Mount versioned API ---
app.use('/api/v1', apiRouter);

// --- 404 + global error handler (must be last) ---
app.use(notFoundHandler);
app.use(errorHandler);

async function start(): Promise<void> {
  try {
    await connectDB();
    initScheduler();
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`[api] LevelUp API listening on port ${PORT}`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api] Failed to start:', err);
    process.exit(1);
  }
}

start();

export { app };
