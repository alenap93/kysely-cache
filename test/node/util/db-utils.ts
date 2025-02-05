import { MysqlDialect, SqliteDialect } from 'kysely'
import { createPool } from 'mysql2'
import { LRUCacheSQLOpts } from '../../../src/interfaces/lru-cache-sql-opts'
import Database from 'better-sqlite3'
import { PGlite } from '@electric-sql/pglite'
import { PGliteDialect } from 'kysely-pglite-dialect'

const DIALECT_CONFIGS = {
  sqlite: {
    databasePath: ':memory:',
  },
  mysql: {
    database: 'kysely-cache_test',
    host: 'localhost',
    user: 'kysely',
    password: 'kysely',
    port: 3306,
    supportBigNumbers: true,
    bigNumberStrings: true,
    connectionLimit: 20,
  },
}

export const DB_CONFIGS: { name: string; config: LRUCacheSQLOpts }[] = [
  {
    name: 'Postgres',
    config: {
      dialect: new PGliteDialect(new PGlite('memory://')),
      queryCompiler: 'postgres',
    },
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
  {
    name: 'Mysql',
    config: {
      dialect: new MysqlDialect({
        pool: async () => createPool(DIALECT_CONFIGS.mysql),
      }),
      queryCompiler: 'mysql',
    },
  },
]
