import Database from 'better-sqlite3'
import { Generated, Kysely, SqliteDialect } from 'kysely'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KyselyLRUKeyVCache } from '../../src'

export interface Database {
  person: PersonTable
}

export interface PersonTable {
  id: Generated<number>

  first_name: string

  gender: 'man' | 'woman' | 'other'

  last_name: string
}

describe('KyselyLRUKeyVCache', () => {
  let kyselyInstance: Kysely<Database>

  beforeEach(async () => {
    const sqliteDialect = new SqliteDialect({
      database: new Database(':memory:'),
    })

    kyselyInstance = new Kysely<Database>({ dialect: sqliteDialect })

    await kyselyInstance.schema
      .createTable('person')
      .addColumn('id', 'integer', (col) => col.primaryKey())
      .addColumn('first_name', 'varchar(255)')
      .addColumn('last_name', 'varchar(255)')
      .addColumn('gender', 'varchar(255)')
      .execute()

    await kyselyInstance
      .insertInto('person')
      .values({
        first_name: 'Max',
        last_name: 'Jack',
        gender: 'man',
      })
      .execute()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await kyselyInstance.destroy()
  })

  it('it can be instanced', () => {
    const kyselyLRUCacheInstance = KyselyLRUKeyVCache.createCache<Database>({
      ttl: 60000,
    })

    expect(kyselyLRUCacheInstance).to.be.instanceOf(
      KyselyLRUKeyVCache<Database>,
    )
  })

  it('it can be instanced with default value if options is not passed', () => {
    const kyselyLRUCacheInstance = KyselyLRUKeyVCache.createCache<Database>({})

    expect(kyselyLRUCacheInstance.cache.ttl).to.be.eq(60000)
  })

  it('it has size 1 if a select is executed', async () => {
    const kyselyLRUCacheInstance = KyselyLRUKeyVCache.createCache<Database>({
      ttl: 60000,
    })
    const kyselySelectQueryBuilder = kyselyInstance
      .selectFrom('person')
      .selectAll()
    const people = await kyselyLRUCacheInstance.execute(
      kyselySelectQueryBuilder,
    )

    let size = 0
    for await (const _ of kyselyLRUCacheInstance.cache.iterator()) {
      size++
    }
    expect(size).to.be.equal(1)
    expect(people[0]?.first_name).to.be.equal('Max')
  })

  it('it has size 1 if same select is executed twice', async () => {
    const kyselyLRUCacheInstance = KyselyLRUKeyVCache.createCache<Database>({
      ttl: 60000,
    })
    const kyselySelectQueryBuilderOne = kyselyInstance
      .selectFrom('person')
      .selectAll()
    await kyselyLRUCacheInstance.execute(kyselySelectQueryBuilderOne)
    const kyselySelectQueryBuilderTwo = kyselyInstance
      .selectFrom('person')
      .selectAll()
    const people = await kyselyLRUCacheInstance.execute(
      kyselySelectQueryBuilderTwo,
    )

    let size = 0
    for await (const _ of kyselyLRUCacheInstance.cache.iterator()) {
      size++
    }
    expect(size).to.be.equal(1)
    expect(people[0]?.first_name).to.be.equal('Max')
  })

  it('it has size 2 if is executed 2 different query', async () => {
    const kyselyLRUCacheInstance = KyselyLRUKeyVCache.createCache<Database>({
      ttl: 60000,
    })
    const kyselySelectQueryBuilderOne = kyselyInstance
      .selectFrom('person')
      .selectAll()
    await kyselyLRUCacheInstance.execute(kyselySelectQueryBuilderOne)
    const kyselySelectQueryBuilderTwo = kyselyInstance
      .selectFrom('person')
      .select('gender')
    await kyselyLRUCacheInstance.execute(kyselySelectQueryBuilderTwo)

    let size = 0
    for await (const _ of kyselyLRUCacheInstance.cache.iterator()) {
      size++
    }
    expect(size).to.be.equal(2)
  })

  it('it has size 0 if a select is executed and then cleaned', async () => {
    const kyselyLRUCacheInstance = KyselyLRUKeyVCache.createCache<Database>({
      ttl: 60000,
    })
    const kyselySelectQueryBuilder = kyselyInstance
      .selectFrom('person')
      .selectAll()
    await kyselyLRUCacheInstance.execute(kyselySelectQueryBuilder)

    await kyselyLRUCacheInstance.clear()

    let size = 0
    for await (const _ of kyselyLRUCacheInstance.cache.iterator()) {
      size++
    }
    expect(size).to.be.equal(0)
  })

  it('it has size 1 if a select is executed with executeTakeFirst', async () => {
    const kyselyLRUCacheInstance = KyselyLRUKeyVCache.createCache<Database>({
      ttl: 60000,
    })
    const kyselySelectQueryBuilder = kyselyInstance
      .selectFrom('person')
      .selectAll()
    await kyselyLRUCacheInstance.executeTakeFirst(kyselySelectQueryBuilder)

    let size = 0
    for await (const _ of kyselyLRUCacheInstance.cache.iterator()) {
      size++
    }
    expect(size).to.be.equal(1)
  })

  it('it has size 1 if same select is executed twice with executeTakeFirst', async () => {
    const kyselyLRUCacheInstance = KyselyLRUKeyVCache.createCache<Database>({
      ttl: 60000,
    })
    const kyselySelectQueryBuilderOne = kyselyInstance
      .selectFrom('person')
      .selectAll()
    await kyselyLRUCacheInstance.executeTakeFirst(kyselySelectQueryBuilderOne)
    const kyselySelectQueryBuilderTwo = kyselyInstance
      .selectFrom('person')
      .selectAll()
    await kyselyLRUCacheInstance.executeTakeFirst(kyselySelectQueryBuilderTwo)

    let size = 0
    for await (const _ of kyselyLRUCacheInstance.cache.iterator()) {
      size++
    }
    expect(size).to.be.equal(1)
  })

  it('it has size 2 if is executed 2 different query with executeTakeFirst', async () => {
    const kyselyLRUCacheInstance = KyselyLRUKeyVCache.createCache<Database>({
      ttl: 60000,
    })
    const kyselySelectQueryBuilderOne = kyselyInstance
      .selectFrom('person')
      .selectAll()
    await kyselyLRUCacheInstance.executeTakeFirst(kyselySelectQueryBuilderOne)
    const kyselySelectQueryBuilderTwo = kyselyInstance
      .selectFrom('person')
      .select('gender')
    await kyselyLRUCacheInstance.executeTakeFirst(kyselySelectQueryBuilderTwo)

    let size = 0
    for await (const _ of kyselyLRUCacheInstance.cache.iterator()) {
      size++
    }
    expect(size).to.be.equal(2)
  })

  it('it has size 0 if a select is executed with executeTakeFirst and then cleaned', async () => {
    const kyselyLRUCacheInstance = KyselyLRUKeyVCache.createCache<Database>({
      ttl: 60000,
    })
    const kyselySelectQueryBuilder = kyselyInstance
      .selectFrom('person')
      .selectAll()
    await kyselyLRUCacheInstance.executeTakeFirst(kyselySelectQueryBuilder)

    await kyselyLRUCacheInstance.clear()

    let size = 0
    for await (const _ of kyselyLRUCacheInstance.cache.iterator()) {
      size++
    }
    expect(size).to.be.equal(0)
  })

  it('it has size 1 if a select is executed with executeTakeFirstOrThrow', async () => {
    const kyselyLRUCacheInstance = KyselyLRUKeyVCache.createCache<Database>({
      ttl: 60000,
    })
    const kyselySelectQueryBuilder = kyselyInstance
      .selectFrom('person')
      .selectAll()
    await kyselyLRUCacheInstance.executeTakeFirstOrThrow(
      kyselySelectQueryBuilder,
    )

    let size = 0
    for await (const _ of kyselyLRUCacheInstance.cache.iterator()) {
      size++
    }
    expect(size).to.be.equal(1)
  })

  it('it has size 1 if same select is executed twice with executeTakeFirstOrThrow', async () => {
    const kyselyLRUCacheInstance = KyselyLRUKeyVCache.createCache<Database>({
      ttl: 60000,
    })
    const kyselySelectQueryBuilderOne = kyselyInstance
      .selectFrom('person')
      .selectAll()
    await kyselyLRUCacheInstance.executeTakeFirstOrThrow(
      kyselySelectQueryBuilderOne,
    )
    const kyselySelectQueryBuilderTwo = kyselyInstance
      .selectFrom('person')
      .selectAll()
    await kyselyLRUCacheInstance.executeTakeFirstOrThrow(
      kyselySelectQueryBuilderTwo,
    )

    let size = 0
    for await (const _ of kyselyLRUCacheInstance.cache.iterator()) {
      size++
    }
    expect(size).to.be.equal(1)
  })

  it('it has size 2 if is executed 2 different query with executeTakeFirstOrThrow passing an error handler ', async () => {
    const kyselyLRUCacheInstance = KyselyLRUKeyVCache.createCache<Database>({
      ttl: 60000,
    })
    const kyselySelectQueryBuilderOne = kyselyInstance
      .selectFrom('person')
      .selectAll()
    await kyselyLRUCacheInstance.executeTakeFirstOrThrow(
      kyselySelectQueryBuilderOne,
    )
    const kyselySelectQueryBuilderTwo = kyselyInstance
      .selectFrom('person')
      .select('gender')
    await kyselyLRUCacheInstance.executeTakeFirstOrThrow(
      kyselySelectQueryBuilderTwo,
      (err) => {
        throw new Error('Error: ' + JSON.stringify(err))
      },
    )

    let size = 0
    for await (const _ of kyselyLRUCacheInstance.cache.iterator()) {
      size++
    }
    expect(size).to.be.equal(2)
  })

  it('it has size 0 if a select is executed with executeTakeFirstOrThrow and then cleaned', async () => {
    const kyselyLRUCacheInstance = KyselyLRUKeyVCache.createCache<Database>({
      ttl: 60000,
    })
    const kyselySelectQueryBuilder = kyselyInstance
      .selectFrom('person')
      .selectAll()
    await kyselyLRUCacheInstance.executeTakeFirstOrThrow(
      kyselySelectQueryBuilder,
    )

    await kyselyLRUCacheInstance.clear()

    let size = 0
    for await (const _ of kyselyLRUCacheInstance.cache.iterator()) {
      size++
    }
    expect(size).to.be.equal(0)
  })

  it('it has to write error if cache has problem when set (ex: is undefined)', async () => {
    const kyselyLRUCacheInstance = KyselyLRUKeyVCache.createCache<Database>({
      ttl: 60000,
    })
    const kyselySelectQueryBuilder = kyselyInstance
      .selectFrom('person')
      .selectAll()

    const consoleErrorMock = vi.fn()
    vi.spyOn(console, 'error').mockImplementation(consoleErrorMock)

    kyselyLRUCacheInstance.cache = undefined!

    await kyselyLRUCacheInstance.executeTakeFirstOrThrow(
      kyselySelectQueryBuilder,
    )

    expect(consoleErrorMock).toBeCalledTimes(2)
  })

  it('it throw error if is disconnected', async () => {
    const kyselyLRUCacheInstance =
      await KyselyLRUKeyVCache.createCache<Database>({ ttl: 60000 })

    await kyselyLRUCacheInstance.disconnect()

    const kyselySelectQueryBuilder = kyselyInstance
      .selectFrom('person')
      .selectAll()

    await expect(
      kyselyLRUCacheInstance.execute(kyselySelectQueryBuilder),
    ).rejects.toThrowError('KyselyLRUKeyVCache: Cache has been disconnected')
  })
})
