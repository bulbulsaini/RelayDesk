import { DbPool } from '../../config/db';
import { ListTicketsQuery } from './tickets.schema';

export interface TicketRecord {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  user_id: number;
  assigned_to: number | null;
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
  submitter_name: string;
  submitter_email: string;
  assignee_name: string | null;
  comment_count: number;
}

const TICKET_SELECT = `
  SELECT
    t.id,
    t.title,
    t.description,
    t.category,
    t.priority,
    t.status,
    t.user_id,
    t.assigned_to,
    t.resolved_at,
    t.created_at,
    t.updated_at,
    u.name AS submitter_name,
    u.email AS submitter_email,
    a.name AS assignee_name,
    COALESCE(cc.comment_count, 0) AS comment_count
  FROM tickets t
  JOIN users u ON u.id = t.user_id
  LEFT JOIN users a ON a.id = t.assigned_to
  LEFT JOIN (
    SELECT ticket_id, CAST(COUNT(*) AS INTEGER) AS comment_count
    FROM comments
    GROUP BY ticket_id
  ) cc ON cc.ticket_id = t.id
`;

const SORT_COLUMNS: Record<ListTicketsQuery['sortBy'], string> = {
  created_at: 't.created_at',
  updated_at: 't.updated_at',
  status: 't.status',
  priority: `CASE t.priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END`,
};

export class TicketsRepository {
  constructor(private readonly pool: DbPool) {}

  async findById(id: number): Promise<TicketRecord | null> {
    const res = await this.pool.query<TicketRecord>(`${TICKET_SELECT} WHERE t.id = $1`, [id]);
    return res.rows[0] ?? null;
  }

  async findMany(filters: ListTicketsQuery, scopedUserId?: number) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    const pushParam = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };

    if (scopedUserId !== undefined) {
      conditions.push(`t.user_id = ${pushParam(scopedUserId)}`);
    } else if (filters.userId !== undefined) {
      conditions.push(`t.user_id = ${pushParam(filters.userId)}`);
    }

    if (filters.status) {
      conditions.push(`t.status = ${pushParam(filters.status)}`);
    }
    if (filters.priority) {
      conditions.push(`t.priority = ${pushParam(filters.priority)}`);
    }
    if (filters.category) {
      conditions.push(`t.category = ${pushParam(filters.category)}`);
    }
    if (filters.q) {
      const cleanedId = filters.q.replace(/^(rd-|#)/i, '');
      const parsedId = /^\d+$/.test(cleanedId) ? Number(cleanedId) : null;
      const pattern = `%${filters.q}%`;
      const patternRef = pushParam(pattern);

      if (parsedId !== null) {
        const idRef = pushParam(parsedId);
        conditions.push(`(t.title ILIKE ${patternRef} OR t.description ILIKE ${patternRef} OR t.id = ${idRef})`);
      } else {
        conditions.push(`(t.title ILIKE ${patternRef} OR t.description ILIKE ${patternRef})`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderColumn = SORT_COLUMNS[filters.sortBy];
    const orderDirection = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';

    const countRes = await this.pool.query<{ total: number }>(
      `SELECT CAST(COUNT(*) AS INTEGER) AS total FROM tickets t ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total ?? 0;

    const offset = (filters.page - 1) * filters.limit;
    const limitRef = pushParam(filters.limit);
    const offsetRef = pushParam(offset);

    const rowsRes = await this.pool.query<TicketRecord>(
      `${TICKET_SELECT}
       ${whereClause}
       ORDER BY ${orderColumn} ${orderDirection}, t.id DESC
       LIMIT ${limitRef} OFFSET ${offsetRef}`,
      params
    );

    return {
      items: rowsRes.rows,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / filters.limit)),
      },
    };
  }

  async create(data: {
    title: string;
    description: string;
    category: string;
    priority: string;
    userId: number;
  }): Promise<TicketRecord> {
    const res = await this.pool.query<{ id: number }>(
      `INSERT INTO tickets (title, description, category, priority, status, user_id)
       VALUES ($1, $2, $3, $4, 'open', $5)
       RETURNING id`,
      [data.title, data.description, data.category, data.priority, data.userId]
    );
    const created = await this.findById(res.rows[0].id);
    return created!;
  }

  async update(
    id: number,
    fields: {
      title?: string;
      description?: string;
      category?: string;
      priority?: string;
      status?: string;
      assigned_to?: number | null;
      resolved_at?: Date | null;
    }
  ): Promise<TicketRecord | null> {
    const assignments: string[] = [];
    const params: unknown[] = [];

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        params.push(value);
        assignments.push(`${key} = $${params.length}`);
      }
    }

    if (assignments.length === 0) {
      return this.findById(id);
    }

    assignments.push('updated_at = NOW()');
    params.push(id);

    await this.pool.query(
      `UPDATE tickets SET ${assignments.join(', ')} WHERE id = $${params.length}`,
      params
    );

    return this.findById(id);
  }

  async delete(id: number): Promise<boolean> {
    const res = await this.pool.query('DELETE FROM tickets WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async getStats(scopedUserId?: number) {
    const whereClause = scopedUserId !== undefined ? 'WHERE user_id = $1' : '';
    const params = scopedUserId !== undefined ? [scopedUserId] : [];

    const statusRes = await this.pool.query<{ status: string; count: number }>(
      `SELECT status, CAST(COUNT(*) AS INTEGER) AS count
       FROM tickets ${whereClause}
       GROUP BY status`,
      params
    );

    const priorityRes = await this.pool.query<{ priority: string; count: number }>(
      `SELECT priority, CAST(COUNT(*) AS INTEGER) AS count
       FROM tickets ${whereClause}
       GROUP BY priority`,
      params
    );

    const categoryRes = await this.pool.query<{ category: string; count: number }>(
      `SELECT category, CAST(COUNT(*) AS INTEGER) AS count
       FROM tickets ${whereClause}
       GROUP BY category`,
      params
    );

    const byStatus = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
    for (const row of statusRes.rows) {
      byStatus[row.status as keyof typeof byStatus] = row.count;
    }

    const byPriority = { low: 0, medium: 0, high: 0, urgent: 0 };
    for (const row of priorityRes.rows) {
      byPriority[row.priority as keyof typeof byPriority] = row.count;
    }

    const byCategory: Record<string, number> = {};
    for (const row of categoryRes.rows) {
      byCategory[row.category] = row.count;
    }

    const total = byStatus.open + byStatus.in_progress + byStatus.resolved + byStatus.closed;

    return {
      total,
      byStatus,
      byPriority,
      byCategory,
    };
  }
}
