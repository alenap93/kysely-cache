import { Dialect } from 'kysely'
import { LRUCacheOpts } from './lru-cache-opts'
import { QueryCompilers } from '../types/query-compilers'

export interface LRUCacheSQLOpts extends LRUCacheOpts {
  dialect?: Dialect
  compression?: boolean
  queryCompiler?: QueryCompilers
}
