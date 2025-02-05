export type DeserializedData<Value> = {
  value?: Value
  expires?: number | null
}

export type CompressionAdapter = {
  compress(value: any, options?: any): Promise<any>
  decompress(value: any, options?: any): Promise<any>
  serialize<Value>(data: DeserializedData<Value>): Promise<string> | string
  deserialize<Value>(
    data: string,
  ):
    | Promise<DeserializedData<Value> | undefined>
    | DeserializedData<Value>
    | undefined
}

export type Serialize = <Value>(
  data: DeserializedData<Value>,
) => Promise<string> | string

export type Deserialize = <Value>(
  data: string,
) =>
  | Promise<DeserializedData<Value> | undefined>
  | DeserializedData<Value>
  | undefined

export type StoredDataNoRaw<Value> = Value | undefined

export type StoredDataRaw<Value> = DeserializedData<Value> | undefined

export type StoredData<Value> = StoredDataNoRaw<Value> | StoredDataRaw<Value>

export type IEventEmitter = {
  on(event: string, listener: (...arguments_: any[]) => void): IEventEmitter
}

export type KeyvStoreAdapter = {
  opts: any
  namespace?: string
  get<Value>(key: string): Promise<StoredData<Value> | undefined>
  set(key: string, value: any, ttl?: number): any
  delete(key: string): Promise<boolean>
  clear(): Promise<void>
  has?(key: string): Promise<boolean>
  getMany?<Value>(keys: string[]): Promise<Array<StoredData<Value | undefined>>>
  disconnect?(): Promise<void>
  deleteMany?(key: string[]): Promise<boolean>
  iterator?<Value>(
    namespace?: string,
  ): AsyncGenerator<Array<string | Awaited<Value> | undefined>, void>
} & IEventEmitter

export type KeyvOptions = {
  /** The storage adapter instance to be used by Keyv. */
  store?: KeyvStoreAdapter | Map<any, any> | any
  /** TTL, default: 60000 ms */
  ttl?: number
  /** Enable compression options **/
  compression?: CompressionAdapter | any
}
