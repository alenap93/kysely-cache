export interface DatabaseCache {
  cache: TableCache
}

export interface TableCache {
  key: string
  value: Buffer
  expires: number
  last_access: number
}
