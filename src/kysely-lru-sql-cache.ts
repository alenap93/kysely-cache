import { Kysely, SelectQueryBuilder, SqliteDialect, sql } from 'kysely'
import { DatabaseCache, TableCache } from './interfaces/db-cache'
import zlib from 'node:zlib'
import cbor from 'cbor'
import { promisify } from 'node:util'
import pDebounce from 'p-debounce'
import { LRUCacheSQLOpts } from './interfaces/lru-cache-sql-opts'
import Database from 'better-sqlite3'
import { KyselyLRUCachePrimitive } from './classes/kysely-lru-cache-primitive'
import { QueryCompilers } from './types/query-compilers'

const COMPRESSION_MIN_LENGTH = 512

export class KyselyLRUSQLCache<DB> extends KyselyLRUCachePrimitive<DB> {
  kyselyDBCache?: Kysely<DatabaseCache>

  private ttl = 60000
  private max = 50
  private compression = false
  private queryCompiler: QueryCompilers = 'sqlite'

  private isDestroyed = false

  private checkInterval?: NodeJS.Timeout

  private compress = promisify(zlib.gzip)
  private decompress = promisify(zlib.gunzip)

  private checkForExpiredItems = pDebounce(
    async () => {
      await this.kyselyDBCache
        ?.deleteFrom('cache')
        .where('expires', '<', Date.now())
        .execute()

      if (this.max > 0) {
        await this.kyselyDBCache
          ?.with('lru', (db) =>
            db
              .selectFrom('cache')
              .select('key')
              .orderBy('last_access', 'desc')
              .$if(this.queryCompiler === 'sqlite', (qb) => qb.limit(-1))
              .$if(this.queryCompiler === 'mysql', (qb) => qb.limit(100_000))
              .offset(this.max),
          )
          .deleteFrom('cache')
          .where('key', 'in', (qIn) => qIn.selectFrom('lru').select('key'))
          .execute()
      }
    },
    500,
    {
      before: true,
    },
  )

  private constructor(opts: LRUCacheSQLOpts = {}) {
    super()
    this.compression = opts.compression ?? this.compression
    this.max = opts.max ?? this.max
    this.ttl = opts.ttl ?? this.ttl
    this.queryCompiler = opts.queryCompiler ?? 'sqlite'
    if (!opts.dialect) {
      opts.dialect = new SqliteDialect({
        database: new Database(':memory:'),
      })
    }

    this.kyselyDBCache = new Kysely<DatabaseCache>({
      dialect: opts.dialect,
    })
  }

  static async createCache<DB>(
    opts: LRUCacheSQLOpts = {},
  ): Promise<KyselyLRUSQLCache<DB>> {
    opts.queryCompiler = opts.queryCompiler ?? 'sqlite'
    if (!opts.dialect) {
      opts.dialect = new SqliteDialect({
        database: new Database(':memory:'),
      })
    }

    const kyselyLRUSQLCacheInstance = new KyselyLRUSQLCache<DB>(opts)

    kyselyLRUSQLCacheInstance.kyselyDBCache = new Kysely<DatabaseCache>({
      dialect: opts.dialect,
    })

    await kyselyLRUSQLCacheInstance.syncronize()

    return kyselyLRUSQLCacheInstance
  }

  private async syncronize(): Promise<void> {
    switch (this.queryCompiler) {
      case 'sqlite':
        await this.kyselyDBCache?.transaction().execute(async (trx) => {
          await trx.schema
            .createTable('cache')
            .ifNotExists()
            .addColumn('key', 'text', (col) => col.primaryKey())
            .addColumn('value', 'blob')
            .addColumn('expires', 'bigint')
            .addColumn('last_access', 'bigint')
            .addColumn('compressed', 'smallint')
            .execute()

          await trx.schema
            .createIndex('key_index')
            .ifNotExists()
            .unique()
            .column('key')
            .on('cache')
            .execute()

          await trx.schema
            .createIndex('expires_index')
            .ifNotExists()
            .column('expires')
            .on('cache')
            .execute()

          return trx.schema
            .createIndex('last_access_index')
            .ifNotExists()
            .column('last_access')
            .on('cache')
            .execute()
        })
        break
      case 'postgres':
        await this.kyselyDBCache?.transaction().execute(async (trx) => {
          await trx.schema
            .createTable('cache')
            .ifNotExists()
            .addColumn('key', 'text', (col) => col.primaryKey())
            .addColumn('value', 'bytea')
            .addColumn('expires', 'bigint')
            .addColumn('last_access', 'bigint')
            .addColumn('compressed', 'smallint')
            .execute()

          await trx.schema
            .createIndex('key_index')
            .ifNotExists()
            .unique()
            .column('key')
            .on('cache')
            .execute()

          await trx.schema
            .createIndex('expires_index')
            .ifNotExists()
            .column('expires')
            .on('cache')
            .execute()

          return trx.schema
            .createIndex('last_access_index')
            .ifNotExists()
            .column('last_access')
            .on('cache')
            .execute()
        })
        break
      case 'mysql':
        await this.kyselyDBCache?.transaction().execute(async (trx) => {
          await trx.schema
            .createTable('cache')
            .ifNotExists()
            .addColumn('key', sql<string>`MEDIUMTEXT`)
            .addColumn('value', sql<string>`mediumblob`)
            .addColumn('expires', 'bigint')
            .addColumn('last_access', 'bigint')
            .addColumn('compressed', 'smallint')
            .execute()

          const checkKeyIndexCount = await trx
            .selectFrom(<any>'information_schema.statistics')
            .select(({ fn }) => [fn.count<number>('index_name').as('count')])
            .where('table_schema', '=', 'DATABASE()')
            .where('index_name', '=', 'key_index')
            .where('table_name', '=', 'cache')
            .executeTakeFirst()

          if (checkKeyIndexCount && checkKeyIndexCount.count > 1) {
            await trx.schema
              .createIndex('key_index')
              .unique()
              .column('key')
              .on('cache')
              .execute()
          }

          const checkExpiredIndexCount = await trx
            .selectFrom(<any>'information_schema.statistics')
            .select(({ fn }) => [fn.count<number>('index_name').as('count')])
            .where('table_schema', '=', 'DATABASE()')
            .where('index_name', '=', 'expires_index')
            .where('table_name', '=', 'cache')
            .executeTakeFirst()

          if (checkExpiredIndexCount && checkExpiredIndexCount.count > 1) {
            await trx.schema
              .createIndex('expires_index')
              .column('expires')
              .on('cache')
              .execute()
          }

          const checkLastAccessIndexCount = await trx
            .selectFrom(<any>'information_schema.statistics')
            .select(({ fn }) => [fn.count<number>('index_name').as('count')])
            .where('table_schema', '=', 'DATABASE()')
            .where('index_name', '=', 'last_access_index')
            .where('table_name', '=', 'cache')
            .executeTakeFirst()

          if (
            checkLastAccessIndexCount &&
            checkLastAccessIndexCount.count > 1
          ) {
            await trx.schema
              .createIndex('last_access_index')
              .column('last_access')
              .on('cache')
              .execute()
          }
        })
        break
    }

    this.checkInterval = setInterval(async () => {
      await this.checkForExpiredItems()
    }, 5000)

    await this.clear()
  }

  protected async set<T extends keyof DB, O>(
    queryBuilder: SelectQueryBuilder<DB, T, O>,
    hashQueryBuilder: string,
    value: any,
    encodedValue: Buffer,
  ): Promise<void> {
    this.checkIfDestroyed()

    const expires = Date.now() + this.ttl

    const isToCompress =
      this.compression && encodedValue.length >= COMPRESSION_MIN_LENGTH

    if (isToCompress) {
      encodedValue = await this.compress(encodedValue)
    }

    switch (this.queryCompiler) {
      case 'sqlite':
      case 'postgres':
        await this.kyselyDBCache
          ?.insertInto('cache')
          .values({
            key: hashQueryBuilder,
            value: encodedValue,
            expires,
            last_access: Date.now(),
            compressed: isToCompress ? 1 : 0,
          })
          .onConflict((cfclt) =>
            cfclt.column('key').doUpdateSet({
              value: encodedValue,
              expires,
              last_access: Date.now(),
              compressed: isToCompress ? 1 : 0,
            }),
          )
          .execute()
        break
      case 'mysql':
        await this.kyselyDBCache
          ?.insertInto('cache')
          .values({
            key: hashQueryBuilder,
            value: encodedValue,
            expires,
            last_access: Date.now(),
            compressed: isToCompress ? 1 : 0,
          })
          .onDuplicateKeyUpdate({
            value: encodedValue,
            expires,
            last_access: Date.now(),
            compressed: isToCompress ? 1 : 0,
          })
          .execute()
        break
    }

    setImmediate(this.checkForExpiredItems.bind(this))
  }

  protected async get<T extends keyof DB, O>(
    queryBuilder: SelectQueryBuilder<DB, T, O>,
  ): Promise<any> {
    this.checkIfDestroyed()

    let getSQLResult:
      | Omit<TableCache, 'key' | 'expires' | 'last_access'>
      | undefined

    switch (this.queryCompiler) {
      case 'sqlite':
      case 'postgres':
        getSQLResult = await this.kyselyDBCache
          ?.updateTable('cache')
          .set({ last_access: Date.now() })
          .where(({ and, eb, or }) =>
            and([
              eb('key', '=', this.hashQueryBuilder(queryBuilder)),
              or([eb('expires', '>', Date.now()), eb('expires', 'is', null)]),
            ]),
          )
          .returning(['value', 'compressed'])
          .executeTakeFirst()
        break
      case 'mysql':
        getSQLResult = await this.kyselyDBCache
          ?.transaction()
          .execute(async (trx) => {
            await trx
              ?.updateTable('cache')
              .set({ last_access: Date.now() })
              .where(({ and, eb, or }) =>
                and([
                  eb('key', '=', this.hashQueryBuilder(queryBuilder)),
                  or([
                    eb('expires', '>', Date.now()),
                    eb('expires', 'is', null),
                  ]),
                ]),
              )
              .execute()

            return trx
              .selectFrom('cache')
              .select(['value', 'compressed'])
              .where(({ and, eb, or }) =>
                and([
                  eb('key', '=', this.hashQueryBuilder(queryBuilder)),
                  or([
                    eb('expires', '>', Date.now()),
                    eb('expires', 'is', null),
                  ]),
                ]),
              )
              .executeTakeFirst()
          })
        break
    }

    if (getSQLResult?.compressed) {
      getSQLResult.value = await this.decompress(getSQLResult.value)
    }

    return getSQLResult?.value
      ? cbor.decodeFirst(getSQLResult?.value)
      : undefined
  }

  async clear(): Promise<void> {
    this.checkIfDestroyed()
    await this.kyselyDBCache?.deleteFrom('cache').execute()
  }

  async destroy(): Promise<void> {
    await this.clear()
    clearInterval(this.checkInterval)
    this.kyselyDBCache?.destroy()
    this.isDestroyed = true
  }

  private checkIfDestroyed(): void {
    if (this.isDestroyed) {
      throw new Error('Cache has been destroyed')
    }
  }
}
