import { SqliteDialect } from 'kysely'
import { LRUCacheSQLOpts } from '../../src/interfaces/lru-cache-sql-opts'
import Database from 'better-sqlite3'
import { PGlite } from "@electric-sql/pglite"
import { PGliteDialect } from "kysely-pglite-dialect"

const DIALECT_CONFIGS = {
  sqlite: {
    databasePath: ':memory:',
  },
}

export const DB_CONFIGS: { name: string; config: LRUCacheSQLOpts }[] = [
  {
    name: 'Postgres',
    config: {
      dialect: new PGliteDialect(new PGlite('memory://')),
      queryCompiler: 'postgres'
    }
  },
  {
    name: 'Sqlite',
    config: {
      dialect: new SqliteDialect({
        database: async () => new Database(DIALECT_CONFIGS.sqlite.databasePath),
      }),
      queryCompiler: 'sqlite',
    },
  },
]
