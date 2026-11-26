import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { DbPool } from './config/db';
import { env } from './config/env';
import { registerTicketEventListeners } from './events/listeners';
import { TicketEventBus } from './events/ticketEvents';
import { createAuthMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { createActivityRouter, createTicketActivityRouter } from './modules/activity/activity.routes';
import { createAuthRouter } from './modules/auth/auth.routes';
import { createCommentsRouter } from './modules/comments/comments.routes';
import { createNotificationsRouter } from './modules/notifications/notifications.routes';
import { createTicketsRouter } from './modules/tickets/tickets.routes';
import { createUsersRouter } from './modules/users/users.routes';
import { NotFoundError } from './utils/errors';

export function createApp(pool: DbPool) {
  const app = express();

  app.get('/', (_req, res) => {
  res.json({
    message: 'RelayDesk API is running!',
    status: 'success',
  });
});
  const eventBus = new TicketEventBus();
  registerTicketEventListeners(eventBus, pool);

  const requireAuth = createAuthMiddleware(pool);
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.nodeEnv === 'test' ? 1000 : 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many authentication attempts. Please try again shortly.',
      },
    },
  });

  app.use(helmet());
  app.use(
    cors({
      origin: env.clientOrigin.split(',').map((item) => item.trim()),
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));

  if (env.nodeEnv !== 'test') {
    app.use(morgan('dev'));
  }

  app.get('/api/health', async (_req, res, next) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', service: 'relaydesk-api' });
    } catch (err) {
      next(err);
    }
  });

  app.use('/api/auth', createAuthRouter(pool, requireAuth, authLimiter));
  app.use('/api/users', createUsersRouter(pool, requireAuth));
  app.use('/api/tickets', createTicketsRouter(pool, eventBus, requireAuth));
  app.use('/api/tickets/:id/comments', createCommentsRouter(pool, eventBus, requireAuth));
  app.use('/api/tickets/:id/activity', createTicketActivityRouter(pool, requireAuth));
  app.use('/api/notifications', createNotificationsRouter(pool, requireAuth));
  app.use('/api/activity', createActivityRouter(pool, requireAuth));

  app.use((_req, _res, next) => {
    next(new NotFoundError('API endpoint not found'));
  });

  app.use(errorHandler);

  return { app, eventBus };
}
