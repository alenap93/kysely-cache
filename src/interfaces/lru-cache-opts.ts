export interface LRUCacheOpts {
  /**
   * max number of items (query results) in cache
   * @default 50
   */
  max?: number

  /**
   * time to live (milliseconds)
   * @default 60000
   */
  ttl?: number
}
