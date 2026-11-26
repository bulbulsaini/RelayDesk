import bcrypt from 'bcryptjs';
import { newDb } from 'pg-mem';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { DbPool } from '../src/config/db';
import { TicketEventBus } from '../src/events/ticketEvents';
import { applySchema } from '../src/db/migrate';

function createTestDatabase(): DbPool {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  const pgAdapter = mem.adapters.createPg();
  return new pgAdapter.Pool();
}

describe('RelayDesk Support Ticket API', () => {
  let pool: DbPool;
  let app: ReturnType<typeof createApp>['app'];
  let eventBus: TicketEventBus;

  let adminToken: string;
  let mayaToken: string;
  let liamToken: string;

  beforeEach(async () => {
    pool = createTestDatabase();
    await applySchema(pool);

    const created = createApp(pool);
    app = created.app;
    eventBus = created.eventBus;

    const adminHash = await bcrypt.hash('AdminPass123!', 10);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')`,
      ['Admin User', 'admin@test.dev', adminHash]
    );

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.dev', password: 'AdminPass123!' });
    adminToken = adminLogin.body.token;

    const mayaReg = await request(app).post('/api/auth/register').send({
      name: 'Maya User',
      email: 'maya@test.dev',
      password: 'Password123!',
    });
    mayaToken = mayaReg.body.token;

    const liamReg = await request(app).post('/api/auth/register').send({
      name: 'Liam User',
      email: 'liam@test.dev',
      password: 'Password123!',
    });
    liamToken = liamReg.body.token;
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it('enforces JWT authentication and never allows self-assigning admin on register', async () => {
    const unauth = await request(app).get('/api/tickets');
    expect(unauth.status).toBe(401);

    const reg = await request(app).post('/api/auth/register').send({
      name: 'Attempt Escalation',
      email: 'hacker@test.dev',
      password: 'Password123!',
      role: 'admin',
    });
    expect(reg.status).toBe(201);
    expect(reg.body.user.role).toBe('user');
  });

  it('allows users to create, view, edit, and delete their own open tickets while isolating other users', async () => {
    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${mayaToken}`)
      .send({
        title: 'Webhook timeout on staging cluster',
        description: 'Requests to /webhooks/stripe time out after 5 seconds in eu-west.',
        category: 'technical',
        priority: 'high',
      });

    expect(createRes.status).toBe(201);
    const ticketId = createRes.body.ticket.id;
    expect(createRes.body.ticket.status).toBe('open');

    // Liam cannot read Maya's ticket
    const forbiddenView = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${liamToken}`);
    expect(forbiddenView.status).toBe(403);

    // Maya cannot change status directly
    const forbiddenStatus = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${mayaToken}`)
      .send({ status: 'resolved' });
    expect(forbiddenStatus.status).toBe(403);

    // Maya can update title & priority while open
    const updateRes = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${mayaToken}`)
      .send({ priority: 'urgent', title: 'Webhook timeout on production cluster' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.ticket.priority).toBe('urgent');

    // Maya can delete her open ticket
    const deleteRes = await request(app)
      .delete(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${mayaToken}`);
    expect(deleteRes.status).toBe(204);
  });

  it('supports admin filtering, search, sorting, pagination, status transitions, and comments', async () => {
    await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${mayaToken}`)
      .send({
        title: 'Billing invoice PDF missing VAT ID',
        description: 'Our EU VAT number is not rendered on downloaded PDF invoices.',
        category: 'billing',
        priority: 'medium',
      });

    const urgentRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${liamToken}`)
      .send({
        title: 'Database connection pool exhausted',
        description: 'Seeing 503 errors across API nodes during peak traffic.',
        category: 'technical',
        priority: 'urgent',
      });
    const urgentId = urgentRes.body.ticket.id;

    // Admin lists all tickets filtered by priority
    const adminList = await request(app)
      .get('/api/tickets?priority=urgent&page=1&limit=5')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminList.status).toBe(200);
    expect(adminList.body.items).toHaveLength(1);
    expect(adminList.body.items[0].id).toBe(urgentId);
    expect(adminList.body.pagination.total).toBe(1);

    // Admin adds a comment and marks ticket resolved
    const commentRes = await request(app)
      .post(`/api/tickets/${urgentId}/comments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ body: 'Increased pool max size to 40 and restarted worker pods.' });
    expect(commentRes.status).toBe(201);

    const resolveRes = await request(app)
      .patch(`/api/tickets/${urgentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'resolved' });
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.ticket.status).toBe('resolved');
    expect(resolveRes.body.ticket.resolved_at).toBeTruthy();

    await eventBus.waitForIdle();

    // Verify event-driven activity log recorded TICKET_CREATED, COMMENT_ADDED, STATUS_CHANGED, TICKET_RESOLVED
    const activityRes = await request(app)
      .get(`/api/tickets/${urgentId}/activity`)
      .set('Authorization', `Bearer ${liamToken}`);
    expect(activityRes.status).toBe(200);
    const eventTypes = activityRes.body.activity.map((a: { event_type: string }) => a.event_type);
    expect(eventTypes).toEqual(
      expect.arrayContaining(['TICKET_CREATED', 'COMMENT_ADDED', 'STATUS_CHANGED', 'TICKET_RESOLVED'])
    );

    // Verify notifications were created for ticket owner (Liam)
    const notifRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${liamToken}`);
    expect(notifRes.status).toBe(200);
    expect(notifRes.body.unreadCount).toBeGreaterThanOrEqual(2);
  });

  it('prevents non-admin users from accessing admin-only endpoints', async () => {
    const res = await request(app)
      .get('/api/activity')
      .set('Authorization', `Bearer ${mayaToken}`);
    expect(res.status).toBe(403);

    const usersRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${mayaToken}`);
    expect(usersRes.status).toBe(403);
  });

  it('computes scoped dashboard stats and enforces closed/in-progress lifecycle rules', async () => {
    const created = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${mayaToken}`)
      .send({
        title: 'Export timeout on large workspace',
        description: 'Exporting 15k rows times out after 30 seconds.',
        category: 'technical',
        priority: 'medium',
      });
    const tid = created.body.ticket.id;

    // Admin moves ticket to in_progress
    await request(app)
      .patch(`/api/tickets/${tid}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'in_progress' });

    // Owner cannot delete an in_progress ticket
    const delBlocked = await request(app)
      .delete(`/api/tickets/${tid}`)
      .set('Authorization', `Bearer ${mayaToken}`);
    expect(delBlocked.status).toBe(400);

    // Admin closes ticket; subsequent comment should be rejected
    await request(app)
      .patch(`/api/tickets/${tid}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'closed' });

    const commentBlocked = await request(app)
      .post(`/api/tickets/${tid}/comments`)
      .set('Authorization', `Bearer ${mayaToken}`)
      .send({ body: 'Reopening question' });
    expect(commentBlocked.status).toBe(400);

    const statsRes = await request(app)
      .get('/api/tickets/stats')
      .set('Authorization', `Bearer ${mayaToken}`);
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.stats.total).toBe(1);
    expect(statsRes.body.stats.byStatus.closed).toBe(1);
  });
});
