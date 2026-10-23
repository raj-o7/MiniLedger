import { createApp } from './app';
import { loadConfig, loadEnvFileIfPresent } from './config';
import { createPool } from './db/pool';

async function main(): Promise<void> {
  loadEnvFileIfPresent();
  const config = loadConfig();
  const db = createPool(config.databaseUrl);

  try {
    await db.query('SELECT 1');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not connect to PostgreSQL (${reason}). Check DATABASE_URL in .env.`);
  }

  const app = createApp({ db, config });
  const server = app.listen(config.port, (error?: Error) => {
    if (error) {
      console.error(`Could not start server on port ${config.port}: ${error.message}`);
      process.exit(1);
    }
    console.log(`MiniLedger API listening on http://localhost:${config.port}`);
  });

  const shutdown = () => {
    console.log('Shutting down...');
    server.close(() => {
      db.end().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
