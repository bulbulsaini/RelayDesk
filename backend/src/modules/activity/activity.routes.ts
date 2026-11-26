import { RequestHandler, Router } from 'express';
import { z } from 'zod';
import { DbPool } from '../../config/db';
import { requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ForbiddenError, NotFoundError } from '../../utils/errors';
import { ticketIdParamSchema } from '../tickets/tickets.schema';

const activityListQuery = z.object({
  eventType: z.string().trim().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export function createActivityRouter(pool: DbPool, requireAuth: RequestHandler): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/',
    requireRole('admin'),
    validate({ query: activityListQuery }),
    asyncHandler(async (req, res) => {
      const { eventType, page, limit } = req.query as unknown as z.infer<typeof activityListQuery>;
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (eventType) {
        params.push(eventType);
        conditions.push(`a.event_type = $${params.length}`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const countRes = await pool.query<{ total: number }>(
        `SELECT CAST(COUNT(*) AS INTEGER) AS total FROM activity_logs a ${whereClause}`,
        params
      );
      const total = countRes.rows[0]?.total ?? 0;

      const offset = (page - 1) * limit;
      params.push(limit, offset);

      const rowsRes = await pool.query(
        `SELECT
           a.id,
           a.ticket_id,
           a.actor_id,
           a.event_type,
           a.summary,
           a.metadata,
           a.created_at,
           u.name AS actor_name,
           u.role AS actor_role,
           t.title AS ticket_title
         FROM activity_logs a
         LEFT JOIN users u ON u.id = a.actor_id
         LEFT JOIN tickets t ON t.id = a.ticket_id
         ${whereClause}
         ORDER BY a.created_at DESC, a.id DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      res.json({
        items: rowsRes.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    })
  );

  return router;
}

export function createTicketActivityRouter(pool: DbPool, requireAuth: RequestHandler): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);

  router.get(
    '/',
    validate({ params: ticketIdParamSchema }),
    asyncHandler(async (req, res) => {
      const ticketId = Number(req.params.id);
      const ticketRes = await pool.query<{ user_id: number }>(
        'SELECT user_id FROM tickets WHERE id = $1',
        [ticketId]
      );

      if (ticketRes.rows.length === 0) {
        throw new NotFoundError('Ticket not found');
      }
      if (req.user!.role !== 'admin' && ticketRes.rows[0].user_id !== req.user!.id) {
        throw new ForbiddenError('You do not have permission to view this ticket activity');
      }

      const logsRes = await pool.query(
        `SELECT
           a.id,
           a.ticket_id,
           a.actor_id,
           a.event_type,
           a.summary,
           a.metadata,
           a.created_at,
           u.name AS actor_name,
           u.role AS actor_role
         FROM activity_logs a
         LEFT JOIN users u ON u.id = a.actor_id
         WHERE a.ticket_id = $1
         ORDER BY a.created_at ASC, a.id ASC`,
        [ticketId]
      );

      res.json({ activity: logsRes.rows });
    })
  );

  return router;
}
