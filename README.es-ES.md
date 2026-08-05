

# kysely-cache

[![CI](https://github.com/alenap93/kysely-cache/actions/workflows/tests.yml/badge.svg)](https://github.com/alenap93/kysely-cache/actions/workflows/tests.yml)
[![NPM version](https://img.shields.io/npm/v/kysely-cache.svg?style=flat)](https://www.npmjs.com/package/kysely-cache)
[![NPM downloads](https://img.shields.io/npm/dm/kysely-cache.svg?style=flat)](https://www.npmjs.com/package/kysely-cache)
[![js-prettier-style](https://img.shields.io/badge/code%20style-prettier-brightgreen.svg?style=flat)](https://prettier.io/)

Plugin de caché para Kysely; con este plugin puedes almacenar una consulta en caché y hacer que las siguientes consultas sean más rápidas, ya que no irán directamente a la base de datos, sino que se obtendrán de la caché.
Este plugin tiene tres implementaciones diferentes **KyselyLRUSQLCache**, **KyselyLRUCache** y **KyselyLRUKeyVCache**.

## Install

```
npm i kysely kysely-cache
```

## Usage

### KyselyLRUSQLCache

**Description**

Esta caché almacena los datos dentro de una base de datos (sqlite, mysql o postgres) y establece un tiempo de vida (ttl) para la consulta en caché (y sus resultados) y un número máximo de consultas (y elementos)

**Options**

- max:  *número máximo de elementos (resultados de consulta) en la caché, por defecto 50*
- ttl:  *tiempo de vida (milisegundos), por defecto: 60000*
- debounceTime:  *tiempo de debounce (ms) para esperar la verificación de elementos caducados después de una sola operación "set" en la caché, si es 0 no se realizará ninguna verificación después del set, por defecto: 1000*
- intervalCheckTime:  *tiempo de intervalo (ms) entre cada verificación de elementos caducados (adicional a la verificación después del "set" en la caché), por defecto: 60000*
- dialect:  *Dialecto de Kysely, por defecto: Dialecto de SQLite con base de datos en memoria*
- queryCompiler:  *sqlite, mysql o postgres, por defecto: sqlite*

**Api**

- clear(): *limpia la caché, devuelve: Promise\<void\>*
- destroy(): *limpia la caché, libera todos los recursos y se desconecta de la base de datos de la caché, devuelve: Promise\<void\>*
- createCache(opts): *crea la caché, devuelve: Promise\<KyselyLRUSQLCache\<DB\>\>*
- execute(queryBuilder: SelectQueryBuilder): *ejecuta la consulta o devuelve los datos desde la caché como una lista de elementos*
- executeTakeFirst(queryBuilder: SelectQueryBuilder): *ejecuta la consulta o devuelve los datos desde la caché, devuelve solo el primer elemento*
- executeTakeFirstOrThrow(queryBuilder: SelectQueryBuilder, errorConstructor:  NoResultErrorConstructor): *ejecuta la consulta o devuelve los datos desde la caché, devuelve solo el primer elemento, si no se encuentra ningún elemento, lanzará un error*

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

Esta caché mantiene los datos en memoria (dentro de un objeto) y establece un tiempo de vida (ttl) para la consulta en caché (y sus resultados) y un número máximo de consultas (y elementos)

**Options**

- max:  *número máximo de elementos (resultados de consulta) en la caché, por defecto 50*
- ttl:  *tiempo de vida (milisegundos), por defecto: 60000*

**Api**

- clear(): *limpia la caché, devuelve: void*
- createCache(opts): *crea la caché, devuelve: KyselyLRUCache\<DB\>*
- execute(queryBuilder: SelectQueryBuilder): *ejecuta la consulta o devuelve los datos desde la caché como una lista de elementos*
- executeTakeFirst(queryBuilder: SelectQueryBuilder): *ejecuta la consulta o devuelve los datos desde la caché, devuelve solo el primer elemento*
- executeTakeFirstOrThrow(queryBuilder: SelectQueryBuilder, errorConstructor:  NoResultErrorConstructor): *ejecuta la consulta o devuelve los datos desde la caché, devuelve solo el primer elemento, si no se encuentra ningún elemento, lanzará un error*

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

Esta caché mantiene los datos utilizando el almacenamiento de KeyV, con esta caché debes utilizar las opciones de KeyV de los diferentes almacenes

***¡Esta caché necesita KeyV!***

    npm i --save keyv

**Options**

- store: *La instancia del adaptador de almacenamiento que será utilizada por KeyV.*
- ttl: *TTL, por defecto: 60000*
- compression: *Habilitar opciones de compresión*

**Api**

- clear(): *limpia la caché, devuelve: void*
- disconnect(): *limpia la caché, libera todos los recursos y se desconecta de la base de datos de la caché, devuelve: Promise\<void\>*
- createCache(opts): *crea la caché, devuelve: KyselyLRUKeyVCache\<DB\>*
- execute(queryBuilder: SelectQueryBuilder): *ejecuta la consulta o devuelve los datos desde la caché como una lista de elementos*
- executeTakeFirst(queryBuilder: SelectQueryBuilder): *ejecuta la consulta o devuelve los datos desde la caché, devuelve solo el primer elemento*
- executeTakeFirstOrThrow(queryBuilder: SelectQueryBuilder, errorConstructor:  NoResultErrorConstructor): *ejecuta la consulta o devuelve los datos desde la caché, devuelve solo el primer elemento, si no se encuentra ningún elemento, lanzará un error*

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

Licenciado bajo [MIT](./LICENSE).
