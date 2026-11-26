
import bcrypt from 'bcryptjs';
import { DbPool } from '../config/db.js';
import { applySchema } from './migrate';

export async function seedDatabase(pool: DbPool): Promise<void> {
  // Ensure database tables exist.
  await applySchema(pool);

  // Check whether users already exist.
  const existing = await pool.query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM users'
  );

  // Create Admin account or promote the existing Admin email.
  const adminHash = await bcrypt.hash('Admin@123', 10);

  const adminRes = await pool.query<{ id: number }>(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email)
     DO UPDATE SET role = 'admin'
     RETURNING id`,
    ['RelayDesk Admin', 'admin@relaydesk.dev', adminHash]
  );

  const adminId = adminRes.rows[0].id;

  // If users already exist, do not duplicate demo data.
  if (Number(existing.rows[0].count) > 0) {
    console.log('Admin account is ready.');
    return;
  }

  // Create demo customer accounts for a fresh database.
  const userHash = await bcrypt.hash('User@123', 10);

  const mayaRes = await pool.query<{ id: number }>(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'user') RETURNING id`,
    ['Maya Lin', 'maya@relaydesk.dev', userHash]
  );

  const liamRes = await pool.query<{ id: number }>(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'user') RETURNING id`,
    ['Liam OConnor', 'liam@relaydesk.dev', userHash]
  );

  const mayaId = mayaRes.rows[0].id;
  const liamId = liamRes.rows[0].id;

  // Demo tickets.
  const ticketsData = [
    {
      title: 'SSO SAML callback returning 401 after IdP certificate rotation',
      description:
        'Our Okta staging workspace rotated its signing certificate this morning. Since then, users redirected back to /auth/saml/callback receive an invalid signature error even after uploading the updated metadata XML.',
      category: 'account',
      priority: 'urgent',
      status: 'in_progress',
      userId: mayaId,
      assignedTo: adminId,
      hoursAgo: 18,
    },
    {
      title: 'Duplicate webhook deliveries on invoice.paid event',
      description:
        'We noticed our billing endpoint received the same invoice.paid payload twice within 400ms for three customers yesterday. Request IDs differ, which breaks our idempotency check.',
      category: 'billing',
      priority: 'high',
      status: 'open',
      userId: liamId,
      assignedTo: null,
      hoursAgo: 12,
    },
    {
      title: 'CSV export truncates multi-line descriptions at 500 chars',
      description:
        'When exporting monthly audit reports from the Analytics tab, rows containing newline characters inside the description field get split across extra lines in Excel.',
      category: 'technical',
      priority: 'medium',
      status: 'open',
      userId: mayaId,
      assignedTo: null,
      hoursAgo: 9,
    },
    {
      title: 'Add keyboard shortcuts for ticket triage queue',
      description:
        'It would save our ops team significant time if J/K navigation and E to resolve were supported in the ticket workspace view.',
      category: 'feature_request',
      priority: 'low',
      status: 'open',
      userId: liamId,
      assignedTo: null,
      hoursAgo: 40,
    },
    {
      title: 'Production API key rotation failed with stale cache warning',
      description:
        'Rotated the primary read-write token in Workspace Settings, and the old key continued authenticating requests for roughly 25 minutes before returning 401.',
      category: 'technical',
      priority: 'high',
      status: 'resolved',
      userId: mayaId,
      assignedTo: adminId,
      hoursAgo: 72,
    },
    {
      title: 'Seat count mismatch on annual Pro renewal invoice',
      description:
        'Invoice #INV-4821 lists 14 active seats, though we deactivated 3 contractor accounts on the 2nd of the month prior to renewal.',
      category: 'billing',
      priority: 'medium',
      status: 'resolved',
      userId: liamId,
      assignedTo: adminId,
      hoursAgo: 96,
    },
    {
      title: 'Two-factor recovery codes download yields empty text file on Safari',
      description:
        'Tested on macOS Safari 18.1: clicking "Download backup codes" opens a blank tab instead of saving recovery-codes.txt.',
      category: 'account',
      priority: 'medium',
      status: 'closed',
      userId: mayaId,
      assignedTo: adminId,
      hoursAgo: 140,
    },
  ];

  const ticketIds: number[] = [];

  // Insert demo tickets and their activity logs.
  for (const item of ticketsData) {
    const resolvedAt =
      item.status === 'resolved' || item.status === 'closed'
        ? new Date(Date.now() - (item.hoursAgo - 6) * 3600_000)
        : null;

    const createdAt = new Date(Date.now() - item.hoursAgo * 3600_000);

    const updatedAt = new Date(
      Date.now() - Math.max(1, item.hoursAgo - 3) * 3600_000
    );

    const res = await pool.query<{ id: number }>(
      `INSERT INTO tickets
       (title, description, category, priority, status, user_id,
        assigned_to, resolved_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        item.title,
        item.description,
        item.category,
        item.priority,
        item.status,
        item.userId,
        item.assignedTo,
        resolvedAt,
        createdAt,
        updatedAt,
      ]
    );

    const ticketId = res.rows[0].id;
    ticketIds.push(ticketId);

    await pool.query(
      `INSERT INTO activity_logs
       (ticket_id, actor_id, event_type, summary, metadata, created_at)
       VALUES ($1, $2, 'TICKET_CREATED', $3, $4, $5)`,
      [
        ticketId,
        item.userId,
        `Ticket #${ticketId} created with ${item.priority} priority`,
        JSON.stringify({
          priority: item.priority,
          category: item.category,
        }),
        createdAt,
      ]
    );

    if (
      item.status === 'in_progress' ||
      item.status === 'resolved' ||
      item.status === 'closed'
    ) {
      await pool.query(
        `INSERT INTO activity_logs
         (ticket_id, actor_id, event_type, summary, metadata, created_at)
         VALUES ($1, $2, 'STATUS_CHANGED', $3, $4, $5)`,
        [
          ticketId,
          adminId,
          `Status updated from open to ${item.status}`,
          JSON.stringify({
            from: 'open',
            to: item.status,
          }),
          updatedAt,
        ]
      );
    }

    if (item.status === 'resolved') {
      await pool.query(
        `INSERT INTO activity_logs
         (ticket_id, actor_id, event_type, summary, metadata, created_at)
         VALUES ($1, $2, 'TICKET_RESOLVED', $3, $4, $5)`,
        [
          ticketId,
          adminId,
          `Ticket #${ticketId} marked as resolved`,
          JSON.stringify({ status: 'resolved' }),
          resolvedAt,
        ]
      );
    }
  }

  // Seed realistic conversation comments.
  const hoursAgo = (hours: number) =>
    new Date(Date.now() - hours * 3600_000);

  await pool.query(
    `INSERT INTO comments
     (ticket_id, user_id, body, created_at)
     VALUES
     ($1, $2, 'Confirmed we are seeing the fingerprint mismatch in the staging SAML assertion parser. Checking if the old cert is still pinned in Redis.', $5),
     ($1, $3, 'Thanks Elena! Let us know if you need a fresh metadata export from Okta.', $6),
     ($4, $2, 'We purged the edge token cache TTL from 30m down to 60s and verified new rotations invalidate immediately.', $7)`,
    [
      ticketIds[0],
      adminId,
      mayaId,
      ticketIds[4],
      hoursAgo(14),
      hoursAgo(11),
      hoursAgo(66),
    ]
  );

  // Seed comment activity logs.
  await pool.query(
    `INSERT INTO activity_logs
     (ticket_id, actor_id, event_type, summary, metadata, created_at)
     VALUES
     ($1, $2, 'COMMENT_ADDED', 'Admin Elena Rostova posted a response', '{"role":"admin"}', $4),
     ($1, $3, 'COMMENT_ADDED', 'Maya Lin replied on ticket', '{"role":"user"}', $5)`,
    [ticketIds[0], adminId, mayaId, hoursAgo(14), hoursAgo(11)]
  );

  // Seed unread notifications.
  await pool.query(
    `INSERT INTO notifications
     (user_id, ticket_id, event_type, title, message, is_read)
     VALUES
     ($1, $2, 'COMMENT_ADDED', 'New reply on ticket #1', 'Elena Rostova commented on your SSO SAML ticket.', FALSE),
     ($1, $3, 'TICKET_RESOLVED', 'Ticket #5 resolved', 'Your API key rotation ticket has been marked as resolved.', FALSE),
     ($4, $5, 'TICKET_CREATED', 'New high-priority ticket #2', 'Liam OConnor submitted: Duplicate webhook deliveries on invoice.paid event', FALSE)`,
    [mayaId, ticketIds[0], ticketIds[4], adminId, ticketIds[1]]
  );

  console.log('Database seeded successfully.');
}

// Run seed directly from the terminal.
if (require.main === module) {
  import('../config/db').then(async ({ createPool }) => {
    const pool = createPool();

    try {
      await seedDatabase(pool);
      console.log('Database seeded.');
    } catch (err) {
      console.error('Seeding failed:', err);
      process.exitCode = 1;
    } finally {
      await pool.end();
    }
  });
}
