import { RequestHandler, Router } from 'express';
import { z } from 'zod';
import { DbPool } from '../../config/db';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { NotFoundError } from '../../utils/errors';

const notificationIdParam = z.object({
  id: z.coerce.number().int().positive(),
});

export function createNotificationsRouter(pool: DbPool, requireAuth: RequestHandler): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const itemsRes = await pool.query(
        `SELECT id, ticket_id, event_type, title, message, is_read, created_at
         FROM notifications
         WHERE user_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT 30`,
        [req.user!.id]
      );

      const unreadRes = await pool.query<{ count: number }>(
        `SELECT CAST(COUNT(*) AS INTEGER) AS count
         FROM notifications
         WHERE user_id = $1 AND is_read = FALSE`,
        [req.user!.id]
      );

      res.json({
        notifications: itemsRes.rows,
        unreadCount: unreadRes.rows[0]?.count ?? 0,
      });
    })
  );

  router.patch(
    '/read-all',
    asyncHandler(async (req, res) => {
      await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE', [
        req.user!.id,
      ]);
      res.json({ ok: true });
    })
  );

  router.patch(
    '/:id/read',
    validate({ params: notificationIdParam }),
    asyncHandler(async (req, res) => {
      const result = await pool.query(
        `UPDATE notifications SET is_read = TRUE
         WHERE id = $1 AND user_id = $2
         RETURNING id, is_read`,
        [Number(req.params.id), req.user!.id]
      );
      if (result.rows.length === 0) {
        throw new NotFoundError('Notification not found');
      }
      res.json({ notification: result.rows[0] });
    })
  );

  return router;
}
