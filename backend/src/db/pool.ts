import { Pool, types } from 'pg';

// By default `pg` turns DATE columns into JavaScript Date objects at local midnight,
// which can shift the day depending on the server timezone. Keep them as 'YYYY-MM-DD' strings.
types.setTypeParser(types.builtins.DATE, (value: string) => value);

export function createPool(connectionString: string): Pool {
  const pool = new Pool({ connectionString, max: 10 });

  // Without this listener, an error on an idle connection would crash the process.
  pool.on('error', (error) => {
    console.error('Unexpected PostgreSQL connection error:', error.message);
  });

  return pool;
}
