
import { createApp } from './app';
import { createPool } from './config/db';
import { env } from './config/env';
import { applySchema } from './db/migrate';
import { seedDatabase } from './db/seed';

async function bootstrap() {
  const pool = createPool();

  await applySchema(pool);

  // Temporarily create/reset the admin account.
  await seedDatabase(pool);

  const { app } = createApp(pool);

  const server = app.listen(env.port, () => {
    console.log(`RelayDesk API listening on http://localhost:${env.port}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down...`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
