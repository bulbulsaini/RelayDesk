import fs from 'node:fs';
import path from 'node:path';
import { DbPool } from '../config/db';

export async function applySchema(pool: DbPool): Promise<void> {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
}

if (require.main === module) {
  import('../config/db').then(async ({ createPool }) => {
    const pool = createPool();
    try {
      await applySchema(pool);
      console.log('Database schema applied.');
    } catch (err) {
      console.error('Migration failed:', err);
      process.exitCode = 1;
    } finally {
      await pool.end();
    }
  });
}
