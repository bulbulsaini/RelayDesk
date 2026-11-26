import { RequestHandler, Router } from 'express';
import { DbPool } from '../../config/db';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { AuthController } from './auth.controller';
import { loginSchema, registerSchema } from './auth.schema';
import { AuthService } from './auth.service';

export function createAuthRouter(pool: DbPool, requireAuth: RequestHandler, authLimiter: RequestHandler): Router {
  const router = Router();
  const controller = new AuthController(new AuthService(pool));

  router.post('/register', authLimiter, validate({ body: registerSchema }), asyncHandler(controller.register));
  router.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(controller.login));
  router.get('/me', requireAuth, asyncHandler(controller.me));

  return router;
}
