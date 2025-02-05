import { Kysely, SelectQueryBuilder, SqliteDialect, sql } from 'kysely'
import { DatabaseCache, TableCache } from './interfaces/db-cache'
import cbor from 'cbor'
import pDebounce from 'p-debounce'
import { LRUCacheSQLOpts } from './interfaces/lru-cache-sql-opts'
import Database from 'better-sqlite3'
import { KyselyLRUCachePrimitive } from './classes/kysely-lru-cache-primitive'
import { QueryCompilers } from './types/query-compilers'

export class KyselyLRUSQLCache<DB> extends KyselyLRUCachePrimitive<DB> {
  kyselyDBCache: Kysely<DatabaseCache>

  private ttl = 60000
  private max = 50
  private debounceTime = 1000
  private intervalCheckTime = 60000

  private queryCompiler: QueryCompilers = 'sqlite'

  private isDestroyed = false

  private checkInterval?: NodeJS.Timeout

  /**
   * check the expired items
   */
  private checkForExpiredItemsDebounced = pDebounce(
    this.checkForExpiredItems,
    this.debounceTime,
  )

  private constructor(opts: LRUCacheSQLOpts = {}) {
    super()

    this.max = opts.max ?? this.max
    this.ttl = opts.ttl ?? this.ttl
    this.intervalCheckTime = opts.intervalCheckTime ?? this.intervalCheckTime
    this.debounceTime =
      opts.debounceTime === null || opts.debounceTime === undefined
        ? this.debounceTime
        : opts.debounceTime
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

  /**
   * create the KyselyLRUSQLCache instance
   */
  static async createCache<DB>(
    opts: LRUCacheSQLOpts = {},
  ): Promise<KyselyLRUSQLCache<DB>> {
    const kyselyLRUSQLCacheInstance = new KyselyLRUSQLCache<DB>(opts)

    await kyselyLRUSQLCacheInstance.synchronize()

    return kyselyLRUSQLCacheInstance
  }

  /**
   * synchronize the db with the necessary tables and
   * run the checkforExpiredItems with setInterval
   */
  private async synchronize(): Promise<void> {
    switch (this.queryCompiler) {
      case 'postgres':
      case 'sqlite':
        await this.kyselyDBCache.transaction().execute(async (trx) => {
          await trx.schema
            .createTable('cache')
            .ifNotExists()
            .addColumn('key', 'text', (col) => col.primaryKey())
            .addColumn(
              'value',
              this.queryCompiler === 'sqlite' ? 'blob' : 'bytea',
            )
            .addColumn('expires', 'bigint')
            .addColumn('last_access', 'bigint')
            .execute()

          await trx.schema
            .createIndex('expires_index')
            .ifNotExists()
            .column('expires')
            .on('cache')
            .execute()

          await trx.schema
            .createIndex('last_access_index')
            .ifNotExists()
            .column('last_access')
            .on('cache')
            .execute()

          return trx.schema
            .createIndex('key_expires_index')
            .ifNotExists()
            .columns(['key', 'expires'])
            .on('cache')
            .execute()
        })
        break
      case 'mysql':
        await this.kyselyDBCache.transaction().execute(async (trx) => {
          await trx.schema
            .createTable('cache')
            .ifNotExists()
            .addColumn('key', sql<string>`MEDIUMTEXT`)
            .addColumn('value', sql<string>`mediumblob`)
            .addColumn('expires', 'bigint')
            .addColumn('last_access', 'bigint')
            .execute()

          const sqlStatementShowIndexExpiresIndeces = await sql<
            any[]
          >`SHOW INDEX FROM cache WHERE Key_name = 'expires_index'`.execute(trx)

          if (sqlStatementShowIndexExpiresIndeces?.rows?.length === 0) {
            await trx.schema
              .createIndex('expires_index')
              .column('expires')
              .on('cache')
              .execute()
          }

          const sqlStatementShowIndexLastAccessIndeces = await sql<
            any[]
          >`SHOW INDEX FROM cache WHERE Key_name = 'last_access_index'`.execute(
            trx,
          )

          if (sqlStatementShowIndexLastAccessIndeces?.rows?.length === 0) {
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
    }, this.intervalCheckTime)

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

    try {
      switch (this.queryCompiler) {
        case 'sqlite':
        case 'postgres':
          await this.kyselyDBCache
            .insertInto('cache')
            .values({
              key: hashQueryBuilder,
              value: encodedValue,
              expires,
              last_access: Date.now(),
            })
            .onConflict((cfclt) =>
              cfclt.column('key').doUpdateSet({
                value: encodedValue,
                expires,
                last_access: Date.now(),
              }),
            )
            .execute()
          break
        case 'mysql':
          await this.kyselyDBCache
            .insertInto('cache')
            .values({
              key: hashQueryBuilder,
              value: encodedValue,
              expires,
              last_access: Date.now(),
            })
            .onDuplicateKeyUpdate({
              value: encodedValue,
              expires,
              last_access: Date.now(),
            })
            .execute()
          break
      }
    } catch (err) {
      console.error('KyselyLRUSQLCache: Error during setting data in DB ', err)
    }

    if (this.debounceTime) {
      setImmediate(this.checkForExpiredItemsDebounced.bind(this))
    }
  }

  protected async get<T extends keyof DB, O>(
    queryBuilder: SelectQueryBuilder<DB, T, O>,
  ): Promise<any> {
    this.checkIfDestroyed()

    let getSQLResult:
      | Omit<TableCache, 'key' | 'expires' | 'last_access'>
      | undefined

    try {
      switch (this.queryCompiler) {
        case 'sqlite':
        case 'postgres':
          getSQLResult = await this.kyselyDBCache
            .updateTable('cache')
            .set({ last_access: Date.now() })
            .where(({ and, eb, or }) =>
              and([
                eb('key', '=', this.hashQueryBuilder(queryBuilder)),
                or([eb('expires', '>', Date.now()), eb('expires', 'is', null)]),
              ]),
            )
            .returning(['value'])
            .executeTakeFirst()
          break
        case 'mysql':
          getSQLResult = await this.kyselyDBCache
            .transaction()
            .execute(async (trx) => {
              await trx
                .updateTable('cache')
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
                .select(['value'])
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
    } catch (err) {
      console.error(
        'KyselyLRUSQLCache: Error during getting data from DB ',
        err,
      )
    }

    return getSQLResult?.value
      ? cbor.decodeFirst(getSQLResult?.value)
      : undefined
  }

  /**
   * Clear the cache
   */
  async clear(): Promise<void> {
    this.checkIfDestroyed()

    try {
      await this.kyselyDBCache.deleteFrom('cache').execute()
    } catch (err) {
      console.error('KyselyLRUSQLCache: Error during cache clean ', err)
    }
  }

  /**
   * clear the cache and release all resources and disconnects from the cache database
   */
  async destroy(): Promise<void> {
    await this.clear()
    clearInterval(this.checkInterval)
    this.kyselyDBCache.destroy()
    this.isDestroyed = true
  }

  /**
   * check if db has been destroyed
   */
  private checkIfDestroyed(): void {
    if (this.isDestroyed) {
      throw new Error('KyselyLRUSQLCache: Cache has been destroyed')
    }
  }

  private async checkForExpiredItems(): Promise<void> {
    try {
      await this.kyselyDBCache
        .deleteFrom('cache')
        .where('expires', '<', Date.now())
        .execute()
    } catch (err) {
      console.error(
        'KyselyLRUSQLCache: Error during delete expired items ',
        err,
      )
    }

    if (this.max > 0) {
      try {
        await this.kyselyDBCache
          .with('lru', (db) =>
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
      } catch (err) {
        console.error(
          `KyselyLRUSQLCache: Error during delete older items than first ${this.max} `,
          err,
        )
      }
    }
  }
}
