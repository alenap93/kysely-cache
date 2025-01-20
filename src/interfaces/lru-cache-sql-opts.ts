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
}
