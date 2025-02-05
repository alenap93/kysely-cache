import { Dialect } from 'kysely'
import { LRUCacheOpts } from './lru-cache-opts'
import { QueryCompilers } from '../types/query-compilers'

export interface LRUCacheSQLOpts extends LRUCacheOpts {
  /**
   * Kysely Dialect
   * @default SQLite
   */
  dialect?: Dialect

  /**
   * sqlite, mysql or postgres
   * @default sqlite
   */
  queryCompiler?: QueryCompilers

  /**
   * debounce time (ms) to wait for expired items check after single "set" value in cache, if 0 no check will be done after the set
   * @default 1000
   */
  debounceTime?: number

  /**
   * interval time (ms) between each expired items check (further to check after the "set" value in cache)
   * @default 60000
   */
  intervalCheckTime?: number
}
