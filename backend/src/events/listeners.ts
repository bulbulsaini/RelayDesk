import { DbPool } from '../config/db';
import { sendNotificationEmail } from './emailService';
import { TicketEventBus } from './ticketEvents';

async function getAdminRecipients(pool: DbPool, excludeUserId?: number) {
  const res = await pool.query<{ id: number; email: string }>(
    `SELECT id, email FROM users WHERE role = 'admin' AND ($1::int IS NULL OR id <> $1)`,
    [excludeUserId ?? null]
  );
  return res.rows;
}

async function getUserEmail(pool: DbPool, userId: number): Promise<string | null> {
  const res = await pool.query<{ email: string }>('SELECT email FROM users WHERE id = $1', [userId]);
  return res.rows[0]?.email ?? null;
}

async function insertActivityLog(
  pool: DbPool,
  params: {
    ticketId: number;
    actorId: number;
    eventType: string;
    summary: string;
    metadata: Record<string, unknown>;
  }
) {
  await pool.query(
    `INSERT INTO activity_logs (ticket_id, actor_id, event_type, summary, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [params.ticketId, params.actorId, params.eventType, params.summary, JSON.stringify(params.metadata)]
  );
}

async function createNotification(
  pool: DbPool,
  params: {
    userId: number;
    ticketId: number;
    eventType: string;
    title: string;
    message: string;
  }
) {
  await pool.query(
    `INSERT INTO notifications (user_id, ticket_id, event_type, title, message)
     VALUES ($1, $2, $3, $4, $5)`,
    [params.userId, params.ticketId, params.eventType, params.title, params.message]
  );
}

export function registerTicketEventListeners(bus: TicketEventBus, pool: DbPool): void {
  bus.on('TICKET_CREATED', async (payload) => {
    await insertActivityLog(pool, {
      ticketId: payload.ticketId,
      actorId: payload.actorId,
      eventType: 'TICKET_CREATED',
      summary: `${payload.actorName} created ticket #${payload.ticketId} (${payload.priority} priority)`,
      metadata: { priority: payload.priority, category: payload.category },
    });

    const admins = await getAdminRecipients(pool, payload.actorId);
    for (const admin of admins) {
      await createNotification(pool, {
        userId: admin.id,
        ticketId: payload.ticketId,
        eventType: 'TICKET_CREATED',
        title: `New ${payload.priority} ticket #${payload.ticketId}`,
        message: `${payload.actorName} submitted: ${payload.ticketTitle}`,
      });
      await sendNotificationEmail({
        to: admin.email,
        subject: `[RelayDesk] New Ticket #${payload.ticketId}: ${payload.ticketTitle}`,
        text: `${payload.actorName} opened a ${payload.priority} priority ticket in ${payload.category}.`,
      });
    }
  });

  bus.on('TICKET_UPDATED', async (payload) => {
    const changedKeys = Object.keys(payload.changes);
    await insertActivityLog(pool, {
      ticketId: payload.ticketId,
      actorId: payload.actorId,
      eventType: 'TICKET_UPDATED',
      summary: `${payload.actorName} updated ${changedKeys.join(', ')}`,
      metadata: payload.changes,
    });

    if (payload.actorRole === 'admin' && payload.ticketOwnerId !== payload.actorId) {
      await createNotification(pool, {
        userId: payload.ticketOwnerId,
        ticketId: payload.ticketId,
        eventType: 'TICKET_UPDATED',
        title: `Ticket #${payload.ticketId} updated`,
        message: `${payload.actorName} updated ${changedKeys.join(', ')} on "${payload.ticketTitle}".`,
      });
    }
  });

  bus.on('STATUS_CHANGED', async (payload) => {
    await insertActivityLog(pool, {
      ticketId: payload.ticketId,
      actorId: payload.actorId,
      eventType: 'STATUS_CHANGED',
      summary: `Status changed from ${payload.fromStatus} to ${payload.toStatus}`,
      metadata: { from: payload.fromStatus, to: payload.toStatus },
    });

    if (payload.ticketOwnerId !== payload.actorId) {
      await createNotification(pool, {
        userId: payload.ticketOwnerId,
        ticketId: payload.ticketId,
        eventType: 'STATUS_CHANGED',
        title: `Ticket #${payload.ticketId} is now ${payload.toStatus.replace('_', ' ')}`,
        message: `${payload.actorName} moved "${payload.ticketTitle}" from ${payload.fromStatus} to ${payload.toStatus}.`,
      });

      const ownerEmail = await getUserEmail(pool, payload.ticketOwnerId);
      if (ownerEmail) {
        await sendNotificationEmail({
          to: ownerEmail,
          subject: `[RelayDesk] Status updated for Ticket #${payload.ticketId}`,
          text: `Your ticket "${payload.ticketTitle}" changed status from ${payload.fromStatus} to ${payload.toStatus}.`,
        });
      }
    }
  });

  bus.on('COMMENT_ADDED', async (payload) => {
    await insertActivityLog(pool, {
      ticketId: payload.ticketId,
      actorId: payload.actorId,
      eventType: 'COMMENT_ADDED',
      summary: `${payload.actorName} added a comment`,
      metadata: { commentId: payload.commentId, role: payload.actorRole },
    });

    if (payload.actorRole === 'admin' && payload.ticketOwnerId !== payload.actorId) {
      await createNotification(pool, {
        userId: payload.ticketOwnerId,
        ticketId: payload.ticketId,
        eventType: 'COMMENT_ADDED',
        title: `New response on ticket #${payload.ticketId}`,
        message: `${payload.actorName}: "${payload.preview}"`,
      });

      const ownerEmail = await getUserEmail(pool, payload.ticketOwnerId);
      if (ownerEmail) {
        await sendNotificationEmail({
          to: ownerEmail,
          subject: `[RelayDesk] New comment on Ticket #${payload.ticketId}`,
          text: `${payload.actorName} replied: ${payload.preview}`,
        });
      }
    } else if (payload.actorRole === 'user') {
      const admins = await getAdminRecipients(pool, payload.actorId);
      for (const admin of admins) {
        await createNotification(pool, {
          userId: admin.id,
          ticketId: payload.ticketId,
          eventType: 'COMMENT_ADDED',
          title: `User reply on ticket #${payload.ticketId}`,
          message: `${payload.actorName}: "${payload.preview}"`,
        });
      }
    }
  });

  bus.on('TICKET_RESOLVED', async (payload) => {
    await insertActivityLog(pool, {
      ticketId: payload.ticketId,
      actorId: payload.actorId,
      eventType: 'TICKET_RESOLVED',
      summary: `Ticket #${payload.ticketId} marked as resolved by ${payload.actorName}`,
      metadata: { resolvedBy: payload.actorId },
    });

    if (payload.ticketOwnerId !== payload.actorId) {
      await createNotification(pool, {
        userId: payload.ticketOwnerId,
        ticketId: payload.ticketId,
        eventType: 'TICKET_RESOLVED',
        title: `Ticket #${payload.ticketId} resolved`,
        message: `Your support request "${payload.ticketTitle}" has been resolved.`,
      });

      const ownerEmail = await getUserEmail(pool, payload.ticketOwnerId);
      if (ownerEmail) {
        await sendNotificationEmail({
          to: ownerEmail,
          subject: `[RelayDesk] Ticket #${payload.ticketId} Resolved`,
          text: `Good news! Your ticket "${payload.ticketTitle}" was marked resolved by ${payload.actorName}.`,
        });
      }
    }
  });
}
