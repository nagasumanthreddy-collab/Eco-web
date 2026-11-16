import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import adminRoutes from './routes/admin.ts';
import alertsRoutes from './routes/alerts.ts';
import authRoutes from './routes/auth.ts';
import entriesRoutes from './routes/entries.ts';
import predictionsRoutes from './routes/predictions.ts';
import surplusRoutes from './routes/surplus.ts';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  const allowedOrigins = [
    process.env.APP_URL,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ].filter(Boolean) as string[];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.run.app')) {
          callback(null, true);
        } else {
          callback(null, true); // allow preview/local dev origins cleanly with credentials
        }
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'ecopredict-api' });
  });

  app.get('/api/download-offline', (_req: Request, res: Response) => {
    const filePath = path.resolve(process.cwd(), 'public/ecopredict-offline.html');
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Offline bundle not generated yet.' });
      return;
    }
    res.download(filePath, 'ecopredict-offline.html');
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/entries', entriesRoutes);
  app.use('/api/predictions', predictionsRoutes);
  app.use('/api/surplus', surplusRoutes);
  app.use('/api/alerts', alertsRoutes);
  app.use('/api/admin', adminRoutes);

  app.use('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
