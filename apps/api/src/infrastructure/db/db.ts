import pg from 'pg';

// bigint (int8) arrives as a string by default. Our ids and counts fit in
// Number.MAX_SAFE_INTEGER, so return plain numbers. NUMERIC stays a string.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/** Anything that can run a query: the pool or a client inside a transaction. */
export interface QueryExecutor {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<pg.QueryResult<R>>;
}

export class Database implements QueryExecutor {
  readonly #config: DbConfig;
  #pool: pg.Pool | null = null;

  constructor(config: DbConfig) {
    this.#config = config;
  }

  async connect(): Promise<void> {
    if (this.#pool) return;
    const pool = new pg.Pool({
      ...this.#config,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 2_000,
    });
    try {
      await pool.query('SELECT 1');
    } catch (error) {
      await pool.end();
      throw error;
    }
    this.#pool = pool;
  }

  query<R extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]) {
    return this.#requirePool().query<R>(text, params);
  }

  /**
   * Runs `work` inside ONE dedicated connection, so BEGIN / FOR UPDATE /
   * COMMIT / ROLLBACK all happen on the same session.
   */
  async transaction<T>(work: (tx: QueryExecutor) => Promise<T>): Promise<T> {
    const client = await this.#requirePool().connect();
    let brokenConnection: Error | undefined;
    try {
      await client.query('BEGIN');
      const tx: QueryExecutor = {
        query: <R extends pg.QueryResultRow>(text: string, params?: unknown[]) => client.query<R>(text, params),
      };
      const result = await work(tx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // don't return a broken connection to the pool
        brokenConnection = rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError));
      }
      throw error;
    } finally {
      client.release(brokenConnection);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.#pool) return;
    const pool = this.#pool;
    this.#pool = null;
    await pool.end();
  }

  #requirePool(): pg.Pool {
    if (!this.#pool) throw new Error('Database not initialized. Call connect() first.');
    return this.#pool;
  }
}
