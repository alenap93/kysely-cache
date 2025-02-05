import { SelectQueryBuilder } from 'kysely'
import cbor from 'cbor'
import { KyselyLRUCachePrimitive } from './classes/kysely-lru-cache-primitive'
import { KeyvOptions } from './interfaces/lru-cache-keyv-opts'

export class KyselyLRUKeyVCache<DB> extends KyselyLRUCachePrimitive<DB> {
  cache: any
  isDisconnected = false

  private constructor(options: KeyvOptions) {
    super()
    const { Keyv } = require('keyv')
    this.cache = new Keyv(options.store, options)
  }

  /**
   * create the KyselyLRUKeyVCache instance
   */
  static createCache<DB>(options: KeyvOptions): KyselyLRUKeyVCache<DB> {
    if (!options?.ttl) {
      options.ttl = 60000
    }
    return new KyselyLRUKeyVCache<DB>(options)
  }

  /**
   * Clear the cache
   */
  async clear(): Promise<void> {
    this.checkIfDisconnected()
    await this.cache.clear()
  }

  protected async set<T extends keyof DB, O>(
    queryBuilder: SelectQueryBuilder<DB, T, O>,
    hashQueryBuilder: string,
    value: any,
    encodedValue: Buffer,
  ): Promise<void> {
    this.checkIfDisconnected()

    try {
      await this.cache.set(hashQueryBuilder, encodedValue)
    } catch (err) {
      console.error('KyselyLRUKeyVCache: Error during set data in cache ', err)
    }
  }

  protected async get<T extends keyof DB, O>(
    queryBuilder: SelectQueryBuilder<DB, T, O>,
    hashQueryBuilder: string,
  ): Promise<any> {
    this.checkIfDisconnected()

    let result = undefined
    try {
      const bufferCachedValue = await this.cache.get(hashQueryBuilder)
      result = bufferCachedValue
        ? cbor.decodeFirst(bufferCachedValue)
        : undefined
    } catch (err) {
      console.error(
        'KyselyLRUKeyVCache: Error during get data from cache ',
        err,
      )
    } finally {
      return result
    }
  }

  /**
   * clear the cache and release all resources and disconnects from the keyv instance
   */
  async disconnect(): Promise<void> {
    await this.clear()
    this.cache.disconnect()
    this.isDisconnected = true
  }

  /**
   * check if keyv instance has been disconnected
   */
  private checkIfDisconnected(): void {
    if (this.isDisconnected) {
      throw new Error('KyselyLRUKeyVCache: Cache has been disconnected')
    }
  }
}
