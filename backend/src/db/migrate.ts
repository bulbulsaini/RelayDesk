
import fs from 'node:fs';
import path from 'node:path';
import('../config/db.js')

export async function applySchema(pool: DbPool): Promise<void> {
  const schemaPath = path.resolve(process.cwd(), 'src/db/schema.sql');

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Database schema file not found: ${schemaPath}`);
  }

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
