import { Pool, QueryResult, QueryResultRow } from 'pg';
import { env } from './env';

export type DbPool = Pick<Pool, 'query' | 'connect' | 'end'>;

export function createPool(connectionString = env.databaseUrl): Pool {
  return new Pool({
    connectionString,
    max: 15,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

export async function runQuery<T extends QueryResultRow = QueryResultRow>(
  pool: DbPool,
  sql: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return pool.query<T>(sql, params);
}
