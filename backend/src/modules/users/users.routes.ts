import { RequestHandler, Router } from 'express';
import { DbPool } from '../../config/db';
import { requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';

export function createUsersRouter(pool: DbPool, requireAuth: RequestHandler): Router {
  const router = Router();

  router.get(
    '/',
    requireAuth,
    requireRole('admin'),
    asyncHandler(async (_req, res) => {
      const result = await pool.query(
        'SELECT id, name, email, role, created_at FROM users ORDER BY role ASC, name ASC'
      );
      res.json({ users: result.rows });
    })
  );

  return router;
}
