import {
  SelectQueryBuilder,
  NoResultErrorConstructor,
  QueryNode,
  Simplify,
} from 'kysely'
import hash from 'object-hash'
import cbor from 'cbor'
import { SimplifySingleResult } from '../types/simplify-single-result'

export class KyselyLRUCachePrimitive<DB> {
  /**
   * Execute the query and return the results list
   */
  async execute<T extends keyof DB, O>(
    queryBuilder: SelectQueryBuilder<DB, T, O>,
  ): Promise<Simplify<O>[]> {
    const cachedValue = await this.primitiveGet(queryBuilder)
    if (cachedValue) {
      return cachedValue
    }
    const result = (await queryBuilder.execute()) as unknown as Simplify<O>[]
    await this.primitiveSet(queryBuilder, result)
    return result
  }

  /**
   * Execute the query and return the first result
   */
  async executeTakeFirst<T extends keyof DB, O>(
    queryBuilder: SelectQueryBuilder<DB, T, O>,
  ): Promise<SimplifySingleResult<O>> {
    const cachedValue = (await this.primitiveGet(
      queryBuilder,
    )) as unknown as SimplifySingleResult<O>
    if (cachedValue) {
      return cachedValue
    }
    const result = await queryBuilder.executeTakeFirst()
    await this.primitiveSet(queryBuilder, result)
    return result
  }

  /**
   * Execute the query and return the first result or
   * throw an error if it is not found
   */
  async executeTakeFirstOrThrow<T extends keyof DB, O>(
    queryBuilder: SelectQueryBuilder<DB, T, O>,
    errorConstructor?: NoResultErrorConstructor | ((node: QueryNode) => Error),
  ): Promise<Simplify<O>> {
    const cachedValue = (await this.primitiveGet(
      queryBuilder,
    )) as unknown as Simplify<O>
    if (cachedValue) {
      return cachedValue
    }
    const result = await queryBuilder.executeTakeFirstOrThrow(errorConstructor)
    this.primitiveSet(queryBuilder, result)
    return result
  }

  private async primitiveSet<T extends keyof DB, O>(
    queryBuilder: SelectQueryBuilder<DB, T, O>,
    value: any,
  ): Promise<void> {
    await this.set(
      queryBuilder,
      this.hashQueryBuilder(queryBuilder),
      value,
      cbor.encodeOne(value),
    )
  }

  private async primitiveGet<T extends keyof DB, O>(
    queryBuilder: SelectQueryBuilder<DB, T, O>,
  ): Promise<any> {
    return this.get(queryBuilder, this.hashQueryBuilder(queryBuilder))
  }

  protected async set<T extends keyof DB, O>(
    queryBuilder: SelectQueryBuilder<DB, T, O>,
    hashQueryBuilder: string,
    value: any,
    encodedValue: Buffer,
  ): Promise<void> {
    throw new Error('set method not overridden')
  }

  protected async get<T extends keyof DB, O>(
    queryBuilder: SelectQueryBuilder<DB, T, O>,
    hashQueryBuilder: string,
  ): Promise<any> {
    throw new Error('get method not overridden')
  }

  protected hashQueryBuilder<T extends keyof DB, O>(
    queryBuilder: SelectQueryBuilder<DB, T, O>,
  ): string {
    const { sql, parameters } = queryBuilder.compile()
    return hash.sha1({ sql, parameters })
  }
}
