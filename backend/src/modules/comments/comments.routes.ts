import { RequestHandler, Router } from 'express';
import { DbPool } from '../../config/db';
import { TicketEventBus } from '../../events/ticketEvents';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ticketIdParamSchema } from '../tickets/tickets.schema';
import { createCommentSchema } from './comments.schema';
import { CommentsService } from './comments.service';

export function createCommentsRouter(
  pool: DbPool,
  eventBus: TicketEventBus,
  requireAuth: RequestHandler
): Router {
  const router = Router({ mergeParams: true });
  const service = new CommentsService(pool, eventBus);

  router.use(requireAuth);

  router.get(
    '/',
    validate({ params: ticketIdParamSchema }),
    asyncHandler(async (req, res) => {
      const comments = await service.listByTicket(Number(req.params.id), req.user!);
      res.json({ comments });
    })
  );

  router.post(
    '/',
    validate({ params: ticketIdParamSchema, body: createCommentSchema }),
    asyncHandler(async (req, res) => {
      const comment = await service.addComment(Number(req.params.id), req.body.body, req.user!);
      res.status(201).json({ comment });
    })
  );

  return router;
}
