import {
  DeleteResult,
  InsertResult,
  MergeResult,
  Simplify,
  UpdateResult,
} from 'kysely'

export type SimplifySingleResult<O> = O extends InsertResult
  ? O
  : O extends DeleteResult
    ? O
    : O extends UpdateResult
      ? O
      : O extends MergeResult
        ? O
        : Simplify<O> | undefined
