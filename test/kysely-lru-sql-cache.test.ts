import { Generated, Kysely, SqliteDialect } from 'kysely'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { KyselyLRUSQLCache } from '../src'
import { DB_CONFIGS } from './util/db-utils'
import Database from 'better-sqlite3'

export interface Database {
  person: PersonTable
}

export interface PersonTable {
  id: Generated<number>

  first_name: string

  gender: 'man' | 'woman' | 'other'

  last_name: string
}

DB_CONFIGS.map((opt) => {
  describe(`KyselyLRUSQLCache ${opt.name}`, () => {
    let kyselyInstance: Kysely<Database>

    beforeEach(async () => {
      kyselyInstance = new Kysely<Database>({
        dialect: new SqliteDialect({
          database: new Database(':memory:'),
        })
      })

      await kyselyInstance.schema
        .createTable('person')
        .ifNotExists()
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

    it('it can be instanced', async () => {
      const kyselyLRUSQLCacheInstance =
        await KyselyLRUSQLCache.createCache<Database>(opt.config)

      expect(kyselyLRUSQLCacheInstance).to.be.instanceOf(
        KyselyLRUSQLCache<Database>,
      )
    })

    it('it can be instanced also without opt, with default: sqlite', async () => {
      const kyselyLRUSQLCacheInstance =
        await KyselyLRUSQLCache.createCache<Database>()

      expect(kyselyLRUSQLCacheInstance).to.be.instanceOf(
        KyselyLRUSQLCache<Database>,
      )
    })

    it('it can be instanced and synced', async () => {
      const kyselyLRUSQLCacheInstance =
        await KyselyLRUSQLCache.createCache<Database>(opt.config)

      const countCacheAfterSelect =
        (await kyselyLRUSQLCacheInstance.kyselyDBCache
          ?.selectFrom('cache')
          .select(({ fn }) => [fn.count<number>('key').as('count')])
          .executeTakeFirst())!

      expect(+countCacheAfterSelect.count).to.be.eq(0)
    })

    it('it throw error if is destroyed', async () => {
      const kyselyLRUSQLCacheInstance =
        await KyselyLRUSQLCache.createCache<Database>(opt.config)

      await kyselyLRUSQLCacheInstance.destroy()

      const kyselySelectQueryBuilder = kyselyInstance
        .selectFrom('person')
        .selectAll()

      await expect(
        kyselyLRUSQLCacheInstance.execute(kyselySelectQueryBuilder),
      ).rejects.toThrowError('Cache has been destroyed')
    })

    it('it has 1 record in cache after a select if executed, and has 0 record after it is cleared', async () => {
      const kyselyLRUSQLCacheInstance =
        await KyselyLRUSQLCache.createCache<Database>(opt.config)

      const queryBuilderSelectFrom = kyselyInstance
        .selectFrom('person')
        .selectAll()

      const people = await kyselyLRUSQLCacheInstance.execute(queryBuilderSelectFrom)

      expect(people[0]?.first_name).to.be.eq('Max')

      const countCacheAfterSelect =
        (await kyselyLRUSQLCacheInstance.kyselyDBCache
          ?.selectFrom('cache')
          .select(({ fn }) => [fn.count<number>('key').as('count')])
          .executeTakeFirst())!

      expect(+countCacheAfterSelect.count).to.be.eq(1)

      await kyselyLRUSQLCacheInstance.clear()

      const countCacheAfterClear =
        (await kyselyLRUSQLCacheInstance.kyselyDBCache
          ?.selectFrom('cache')
          .select(({ fn }) => [fn.count<number>('key').as('count')])
          .executeTakeFirst())!

      expect(+countCacheAfterClear.count).to.be.eq(0)
    })

    it('it has to check if exist record to remove or max elements in cache is reached', async () => {
      const kyselyLRUSQLCacheInstance =
        await KyselyLRUSQLCache.createCache<Database>({
          ...opt.config,
          max: 1,
        })

      const firstQueryBuilder = kyselyInstance.selectFrom('person').selectAll()
      const secondQueryBuilder = kyselyInstance
        .selectFrom('person')
        .select('gender')

      await kyselyLRUSQLCacheInstance.execute(firstQueryBuilder)

      await kyselyLRUSQLCacheInstance.execute(secondQueryBuilder)

      const countCacheAfterFirstSelect =
        (await kyselyLRUSQLCacheInstance.kyselyDBCache
          ?.selectFrom('cache')
          .select(({ fn }) => [fn.count<number>('key').as('count')])
          .executeTakeFirst())!

      expect(+countCacheAfterFirstSelect.count).to.be.eq(2)

      await new Promise((resolve) => setTimeout(resolve, 2000))

      const countCacheAfterSecondSelect =
        (await kyselyLRUSQLCacheInstance.kyselyDBCache
          ?.selectFrom('cache')
          .select(({ fn }) => [fn.count<number>('key').as('count')])
          .executeTakeFirst())!

      expect(+countCacheAfterSecondSelect.count).to.be.eq(1)
    }, 10000)

    it('it has size 1 if same select is executed twice', async () => {
      const kyselyLRUSQLCacheInstance =
        await KyselyLRUSQLCache.createCache<Database>(opt.config)

      const kyselySelectQueryBuilderOne = kyselyInstance
        .selectFrom('person')
        .selectAll()

      await kyselyLRUSQLCacheInstance.execute(kyselySelectQueryBuilderOne)

      const kyselySelectQueryBuilderTwo = kyselyInstance
        .selectFrom('person')
        .selectAll()

      const people = await kyselyLRUSQLCacheInstance.execute(kyselySelectQueryBuilderTwo)

      const countCacheAfterSecondSelect =
        (await kyselyLRUSQLCacheInstance.kyselyDBCache
          ?.selectFrom('cache')
          .select(({ fn }) => [fn.count<number>('key').as('count')])
          .executeTakeFirst())!

      expect(+countCacheAfterSecondSelect.count).to.be.eq(1)
      expect(people[0]?.first_name).to.be.equal('Max')
    })
  })
})
