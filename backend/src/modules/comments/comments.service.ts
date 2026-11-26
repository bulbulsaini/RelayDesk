import { DbPool } from '../../config/db';
import { TicketEventBus } from '../../events/ticketEvents';
import { AuthUser } from '../../middleware/auth';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/errors';

export interface CommentRecord {
  id: number;
  ticket_id: number;
  user_id: number;
  body: string;
  created_at: Date;
  author_name: string;
  author_role: 'user' | 'admin';
}

export class CommentsService {
  constructor(
    private readonly pool: DbPool,
    private readonly eventBus: TicketEventBus
  ) {}

  private async ensureTicketAccess(ticketId: number, actor: AuthUser) {
    const ticketRes = await this.pool.query<{
      id: number;
      title: string;
      status: string;
      user_id: number;
    }>('SELECT id, title, status, user_id FROM tickets WHERE id = $1', [ticketId]);

    if (ticketRes.rows.length === 0) {
      throw new NotFoundError('Ticket not found');
    }

    const ticket = ticketRes.rows[0];
    if (actor.role !== 'admin' && ticket.user_id !== actor.id) {
      throw new ForbiddenError('You do not have permission to access this ticket');
    }
    return ticket;
  }

  async listByTicket(ticketId: number, actor: AuthUser): Promise<CommentRecord[]> {
    await this.ensureTicketAccess(ticketId, actor);

    const res = await this.pool.query<CommentRecord>(
      `SELECT
         c.id,
         c.ticket_id,
         c.user_id,
         c.body,
         c.created_at,
         u.name AS author_name,
         u.role AS author_role
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.ticket_id = $1
       ORDER BY c.created_at ASC, c.id ASC`,
      [ticketId]
    );
    return res.rows;
  }

  async addComment(ticketId: number, body: string, actor: AuthUser): Promise<CommentRecord> {
    const ticket = await this.ensureTicketAccess(ticketId, actor);

    if (ticket.status === 'closed') {
      throw new BadRequestError('Cannot add comments to a closed ticket');
    }

    const insertRes = await this.pool.query<{ id: number }>(
      `INSERT INTO comments (ticket_id, user_id, body)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [ticketId, actor.id, body]
    );

    await this.pool.query('UPDATE tickets SET updated_at = NOW() WHERE id = $1', [ticketId]);

    const commentRes = await this.pool.query<CommentRecord>(
      `SELECT
         c.id,
         c.ticket_id,
         c.user_id,
         c.body,
         c.created_at,
         u.name AS author_name,
         u.role AS author_role
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = $1`,
      [insertRes.rows[0].id]
    );

    const comment = commentRes.rows[0];
    const preview = body.length > 90 ? `${body.slice(0, 87)}...` : body;

    this.eventBus.emit('COMMENT_ADDED', {
      ticketId: ticket.id,
      ticketTitle: ticket.title,
      ticketOwnerId: ticket.user_id,
      commentId: comment.id,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      preview,
    });

    return comment;
  }
}
