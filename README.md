
# kysely-cache

[![CI](https://github.com/alenap93/kysely-cache/actions/workflows/tests.yml/badge.svg)](https://github.com/alenap93/kysely-cache/actions/workflows/tests.yml)
[![NPM version](https://img.shields.io/npm/v/kysely-cache.svg?style=flat)](https://www.npmjs.com/package/kysely-cache)
[![NPM downloads](https://img.shields.io/npm/dm/kysely-cache.svg?style=flat)](https://www.npmjs.com/package/kysely-cache)
[![js-prettier-style](https://img.shields.io/badge/code%20style-prettier-brightgreen.svg?style=flat)](https://prettier.io/)

Kysely Cache plugin; with this plugin you can cache a query and make next queries faster, that will not go directly to the database, but will be getted from the cache.
This plugin has three different implementation **KyselyLRUSQLCache**, **KyselyLRUCache** and **KyselyLRUKeyVCache**.

## Install

```
npm i kysely kysely-cache
```

## Usage

### KyselyLRUSQLCache

**Description**

This cache stores data inside a DB (sqlite, mysql or postgres) and sets a cached query (and results) lifetime (ttl) and a maximum number of queries (and elements)

**Options**

- max:  *max number of items (query results) in cache, default 50*
- ttl:  *time to live (milliseconds), default: 60000*
- debounceTime:  *debounce time (ms) to wait for expired items check after single "set" value in cache, if 0 no check will be done after the set, default: 1000*
- intervalCheckTime:  *interval time (ms) between each expired items check (further to check after the "set" value in cache), default: 60000*
- dialect:  *Kysely Dialect, default: SQLite Dialect with in memory DB*
- queryCompiler:  *sqlite, mysql or postgres, default: sqlite*

**Api**

- clear(): *clear the cache, return: Promise\<void\>*
- destroy(): *clear the cache and release all resources and disconnects from the cache database, return: Promise\<void\>*
- createCache(opts): *create the cache, return: Promise\<KyselyLRUSQLCache\<DB\>\>*
- execute(queryBuilder: SelectQueryBuilder): *execute the query or return data from the cache as a list of items*
- executeTakeFirst(queryBuilder: SelectQueryBuilder): *execute the query or return data from the cache, it return only the first element*
- executeTakeFirstOrThrow(queryBuilder: SelectQueryBuilder, errorConstructor:  NoResultErrorConstructor): *execute the query or return data from the cache, it return only the first element, if no element will be found, it will throw an error*

**How to use**

    const sqliteDialect = new SqliteDialect({ database: new Database(':memory:')})
    
    const kyselyInstance = new Kysely<Database>({ dialect:  sqliteDialect })
    
    await kyselyInstance.schema
    .createTable('person')
    .addColumn('id', 'integer', (col) => col.primaryKey())
    .addColumn('first_name', 'varchar(255)')
    .addColumn('last_name', 'varchar(255)')
    .addColumn('gender', 'varchar(255)')
    .execute()
    
    await kyselyInstance
    .insertInto('person')
    .values({
    first_name: 'Max',
    last_name: 'Jack',
    gender: 'man',
    })
    .execute()
    
    const kyselyLRUSQLCacheInstance = await KyselyLRUSQLCache.createCache<Database>(opt.config)
    
    const queryBuilderSelectFrom = kyselyInstance
    .selectFrom('person')
    .selectAll()
    
    const people = await kyselyLRUSQLCacheInstance.execute(queryBuilderSelectFrom)

### KyselyLRUCache

**Description**

This cache keeps data in memory (inside an object) and sets a cache query (and results) lifetime (ttl) and a maximum number of queries (and elements)

**Options**

- max:  *max number of items (query results) in cache, default 50*
- ttl:  *time to live (milliseconds), default: 60000*

**Api**

- clear(): *clear the cache, return: void*
- createCache(opts): *create the cache, return: KyselyLRUCache\<DB\>*
- execute(queryBuilder: SelectQueryBuilder): *execute the query or return data from the cache as a list of items*
- executeTakeFirst(queryBuilder: SelectQueryBuilder): *execute the query or return data from the cache, it return only the first element*
- executeTakeFirstOrThrow(queryBuilder: SelectQueryBuilder, errorConstructor:  NoResultErrorConstructor): *execute the query or return data from the cache, it return only the first element, if no element will be found, it will throw an error*

**How to use**

    const sqliteDialect = new SqliteDialect( { database: new  Database(':memory:') } )
    
    const kyselyInstance = new Kysely<Database>( { dialect:  sqliteDialect } )
    
    await kyselyInstance.schema.createTable('person')
    .addColumn('id', 'integer', (col) =>  col.primaryKey())
    .addColumn('first_name', 'varchar(255)')
    .addColumn('last_name', 'varchar(255)')
    .addColumn('gender', 'varchar(255)')
    .execute()
    
    await kyselyInstance.insertInto('person').values( { first_name: 'Max', last_name: 'Jack', gender: 'man' } )
    .execute()
    
    const kyselyLRUCacheInstance = KyselyLRUCache.createCache<Database>( { max: 50, ttl: 60000 } )
    
    const kyselySelectQueryBuilderOne = kyselyInstance.selectFrom('person').selectAll()
    const persone = await KyselyLRUCacheInstance.executeTakeFirstOrThrow(kyselySelectQueryBuilderOne)

### KyselyLRUKeyVCache

**Description**

This cache keeps data using KeyV storage, with this cache you have to use KeyV options of the different stores

***This cache needs KeyV!***

    npm i --save keyv

**Options**

- store: *The storage adapter instance to be used by Keyv.*
- ttl: *TTL, default: 60000*
- compression: *Enable compression options*

**Api**

- clear(): *clear the cache, return: void*
- disconnect(): *clear the cache and release all resources and disconnects from the cache database, return: Promise\<void\>*
- createCache(opts): *create the cache, return: KyselyLRUKeyVCache\<DB\>*
- execute(queryBuilder: SelectQueryBuilder): *execute the query or return data from the cache as a list of items*
- executeTakeFirst(queryBuilder: SelectQueryBuilder): *execute the query or return data from the cache, it return only the first element*
- executeTakeFirstOrThrow(queryBuilder: SelectQueryBuilder, errorConstructor:  NoResultErrorConstructor): *execute the query or return data from the cache, it return only the first element, if no element will be found, it will throw an error*

**How to use**

    const sqliteDialect = new SqliteDialect( { database: new  Database(':memory:') } )
    
    const kyselyInstance = new Kysely<Database>( { dialect:  sqliteDialect } )
    
    await kyselyInstance.schema.createTable('person')
    .addColumn('id', 'integer', (col) =>  col.primaryKey())
    .addColumn('first_name', 'varchar(255)')
    .addColumn('last_name', 'varchar(255)')
    .addColumn('gender', 'varchar(255)')
    .execute()
    
    await kyselyInstance.insertInto('person').values( { first_name: 'Max', last_name: 'Jack', gender: 'man' } )
    .execute()
    
    const kyselyLRUKeyVCacheInstance = KyselyLRUKeyVCache.createCache<Database>( { ttl: 60000 } )
    
    const kyselySelectQueryBuilderOne = kyselyInstance.selectFrom('person').selectAll()
    const persone = await kyselyLRUKeyVCacheInstance.executeTakeFirstOrThrow(kyselySelectQueryBuilderOne)


## License

Licensed under [MIT](./LICENSE).
