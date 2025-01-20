import { lru, LRU } from 'tiny-lru'
import { SelectQueryBuilder } from 'kysely'
import cbor from 'cbor'
import { LRUCacheOpts } from './interfaces/lru-cache-opts'
import { KyselyLRUCachePrimitive } from './classes/kysely-lru-cache-primitive'

export class KyselyLRUCache<DB> extends KyselyLRUCachePrimitive<DB> {
  cache?: LRU<Buffer>

  private constructor(opts: LRUCacheOpts = {}) {
    super()
    const { max, ttl } = opts
    this.cache = lru(max || 50, ttl || 60000)
  }

  /**
   * create the KyselyLRUCache instance
   */
  static createCache<DB>(opts: LRUCacheOpts = {}): KyselyLRUCache<DB> {
    return new KyselyLRUCache<DB>(opts)
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache?.clear()
  }

  protected async set<T extends keyof DB, O>(
    queryBuilder: SelectQueryBuilder<DB, T, O>,
    hashQueryBuilder: string,
    value: any,
    encodedValue: Buffer,
  ): Promise<void> {
    this.cache?.set(hashQueryBuilder, encodedValue)
  }

  protected async get<T extends keyof DB, O>(
    queryBuilder: SelectQueryBuilder<DB, T, O>,
    hashQueryBuilder: string,
  ): Promise<any> {
    const bufferCachedValue = this.cache?.get(hashQueryBuilder)
    return bufferCachedValue ? cbor.decodeFirst(bufferCachedValue) : undefined
  }
}
