import { TicketEventBus } from '../../events/ticketEvents';
import { AuthUser } from '../../middleware/auth';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/errors';
import { TicketsRepository } from './tickets.repository';
import { CreateTicketInput, ListTicketsQuery, UpdateTicketInput } from './tickets.schema';

export class TicketsService {
  constructor(
    private readonly repo: TicketsRepository,
    private readonly eventBus: TicketEventBus
  ) {}

  async listTickets(query: ListTicketsQuery, actor: AuthUser) {
    const scopedUserId = actor.role === 'admin' ? undefined : actor.id;
    return this.repo.findMany(query, scopedUserId);
  }

  async getStats(actor: AuthUser) {
    const scopedUserId = actor.role === 'admin' ? undefined : actor.id;
    return this.repo.getStats(scopedUserId);
  }

  async getTicketById(id: number, actor: AuthUser) {
    const ticket = await this.repo.findById(id);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }
    if (actor.role !== 'admin' && ticket.user_id !== actor.id) {
      throw new ForbiddenError('You can only view your own tickets');
    }
    return ticket;
  }

  async createTicket(input: CreateTicketInput, actor: AuthUser) {
    const ticket = await this.repo.create({
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority,
      userId: actor.id,
    });

    this.eventBus.emit('TICKET_CREATED', {
      ticketId: ticket.id,
      ticketTitle: ticket.title,
      priority: ticket.priority,
      category: ticket.category,
      actorId: actor.id,
      actorName: actor.name,
    });

    return ticket;
  }

  async updateTicket(id: number, input: UpdateTicketInput, actor: AuthUser) {
    const existing = await this.getTicketById(id, actor);

    if (actor.role !== 'admin') {
      if (input.status !== undefined || input.assignedTo !== undefined) {
        throw new ForbiddenError('Only administrators can change ticket status or assignment');
      }
      if (existing.status === 'resolved' || existing.status === 'closed') {
        throw new BadRequestError('Resolved or closed tickets cannot be edited');
      }
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const updateFields: Record<string, unknown> = {};

    if (input.title !== undefined && input.title !== existing.title) {
      updateFields.title = input.title;
      changes.title = { from: existing.title, to: input.title };
    }
    if (input.description !== undefined && input.description !== existing.description) {
      updateFields.description = input.description;
      changes.description = { from: 'updated', to: 'updated' };
    }
    if (input.category !== undefined && input.category !== existing.category) {
      updateFields.category = input.category;
      changes.category = { from: existing.category, to: input.category };
    }
    if (input.priority !== undefined && input.priority !== existing.priority) {
      updateFields.priority = input.priority;
      changes.priority = { from: existing.priority, to: input.priority };
    }
    if (input.assignedTo !== undefined && input.assignedTo !== existing.assigned_to) {
      updateFields.assigned_to = input.assignedTo;
      changes.assignedTo = { from: existing.assigned_to, to: input.assignedTo };
    }

    const statusChanged = input.status !== undefined && input.status !== existing.status;
    if (statusChanged && input.status) {
      updateFields.status = input.status;
      if (input.status === 'resolved') {
        updateFields.resolved_at = new Date();
      } else if (existing.status === 'resolved' && input.status !== 'closed') {
        updateFields.resolved_at = null;
      }
    }

    const updated = await this.repo.update(id, updateFields);
    if (!updated) {
      throw new NotFoundError('Ticket not found');
    }

    if (Object.keys(changes).length > 0) {
      this.eventBus.emit('TICKET_UPDATED', {
        ticketId: updated.id,
        ticketTitle: updated.title,
        ticketOwnerId: updated.user_id,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        changes,
      });
    }

    if (statusChanged && input.status) {
      this.eventBus.emit('STATUS_CHANGED', {
        ticketId: updated.id,
        ticketTitle: updated.title,
        ticketOwnerId: updated.user_id,
        actorId: actor.id,
        actorName: actor.name,
        fromStatus: existing.status,
        toStatus: input.status,
      });

      if (input.status === 'resolved') {
        this.eventBus.emit('TICKET_RESOLVED', {
          ticketId: updated.id,
          ticketTitle: updated.title,
          ticketOwnerId: updated.user_id,
          actorId: actor.id,
          actorName: actor.name,
        });
      }
    }

    return updated;
  }

  async deleteTicket(id: number, actor: AuthUser) {
    const existing = await this.getTicketById(id, actor);

    if (actor.role !== 'admin' && existing.status !== 'open') {
      throw new BadRequestError('Only open tickets can be deleted by their submitter');
    }

    await this.repo.delete(id);
  }
}
