import { RequestHandler, Router } from 'express';
import { DbPool } from '../../config/db';
import { TicketEventBus } from '../../events/ticketEvents';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { TicketsController } from './tickets.controller';
import { TicketsRepository } from './tickets.repository';
import {
  createTicketSchema,
  listTicketsQuerySchema,
  ticketIdParamSchema,
  updateTicketSchema,
} from './tickets.schema';
import { TicketsService } from './tickets.service';

export function createTicketsRouter(
  pool: DbPool,
  eventBus: TicketEventBus,
  requireAuth: RequestHandler
): Router {
  const router = Router();
  const service = new TicketsService(new TicketsRepository(pool), eventBus);
  const controller = new TicketsController(service);

  router.use(requireAuth);

  router.get('/stats', asyncHandler(controller.stats));
  router.get('/', validate({ query: listTicketsQuerySchema }), asyncHandler(controller.list));
  router.post('/', validate({ body: createTicketSchema }), asyncHandler(controller.create));
  router.get('/:id', validate({ params: ticketIdParamSchema }), asyncHandler(controller.getOne));
  router.patch(
    '/:id',
    validate({ params: ticketIdParamSchema, body: updateTicketSchema }),
    asyncHandler(controller.update)
  );
  router.delete('/:id', validate({ params: ticketIdParamSchema }), asyncHandler(controller.remove));

  return router;
}
