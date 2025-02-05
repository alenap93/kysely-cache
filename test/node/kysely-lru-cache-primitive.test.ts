import Database from 'better-sqlite3'
import { Generated, Kysely, SelectQueryBuilder, SqliteDialect } from 'kysely'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { KyselyLRUCachePrimitive } from '../../src'

export interface Database {
  person: PersonTable
}

export interface PersonTable {
  id: Generated<number>

  first_name: string

  gender: 'man' | 'woman' | 'other'

  last_name: string
}

class KyselyLRUCacheCustom<DB> extends KyselyLRUCachePrimitive<DB> {
  constructor() {
    super()
  }
}

class KyselyLRUCacheCustomWithGET<DB> extends KyselyLRUCachePrimitive<DB> {
  constructor() {
    super()
  }

  protected async get<T extends keyof DB, O>(
    queryBuilder: SelectQueryBuilder<DB, T, O>,
    hashQueryBuilder: string,
  ): Promise<any> {
    return undefined
  }
}

describe('KyselyLRUCacheCustom', () => {
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
    await kyselyInstance.destroy()
  })

  it('it can be instanced', () => {
    const kyselyLRUCacheCustomInstance = new KyselyLRUCacheCustom<Database>()

    expect(kyselyLRUCacheCustomInstance).to.be.instanceOf(
      KyselyLRUCacheCustom<Database>,
    )
  })

  it('it throw an error if something is executed and get not overridden', async () => {
    const kyselyLRUCacheCustomInstance = new KyselyLRUCacheCustom<Database>()

    const kyselySelectQueryBuilder = kyselyInstance
      .selectFrom('person')
      .selectAll()
    await expect(
      kyselyLRUCacheCustomInstance.execute(kyselySelectQueryBuilder),
    ).rejects.toThrowError('get method not overridden')
  })
})

describe('KyselyLRUCacheCustomWithGET', () => {
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
    await kyselyInstance.destroy()
  })

  it('it can be instanced', () => {
    const kyselyLRUCacheCustomWithGETInstance =
      new KyselyLRUCacheCustomWithGET<Database>()

    expect(kyselyLRUCacheCustomWithGETInstance).to.be.instanceOf(
      KyselyLRUCacheCustomWithGET<Database>,
    )
  })

  it('it throw an error if something is executed and set not overridden', async () => {
    const kyselyLRUCacheCustomWithGETInstance =
      new KyselyLRUCacheCustomWithGET<Database>()

    const kyselySelectQueryBuilder = kyselyInstance
      .selectFrom('person')
      .selectAll()
    await expect(
      kyselyLRUCacheCustomWithGETInstance.execute(kyselySelectQueryBuilder),
    ).rejects.toThrowError('set method not overridden')
  })
})
