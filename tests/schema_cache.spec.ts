import { test } from '@japa/runner'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { SCHEMA_CACHE_PATH, SchemaCache, hashConnection } from '../src/schema_cache.js'
import type { TableSchema } from '../src/types.js'
import { tmpDir } from './helpers.js'

function tablesData(): Map<string, TableSchema> {
  return new Map([
    [
      'users',
      {
        columns: [
          {
            name: 'id',
            sqlType: 'int',
            tsType: '',
            isNullable: false,
            isPrimary: true,
            hasDefault: false,
          },
        ],
        foreignKeys: [],
      },
    ],
    [
      'posts',
      {
        columns: [
          {
            name: 'id',
            sqlType: 'int',
            tsType: '',
            isNullable: false,
            isPrimary: true,
            hasDefault: false,
          },
          {
            name: 'user_id',
            sqlType: 'int',
            tsType: '',
            isNullable: false,
            isPrimary: false,
            hasDefault: false,
          },
        ],
        foreignKeys: [{ column: 'user_id', foreignTable: 'users', foreignColumn: 'id' }],
      },
    ],
  ])
}

test.group('SchemaCache', () => {
  test('save then load round-trips the schema', async ({ assert }) => {
    const dir = tmpDir('reliese-cache')
    try {
      await SchemaCache.save(tablesData(), 'default', dir)
      const loaded = await SchemaCache.load('default', dir)

      assert.isNotNull(loaded)
      assert.deepEqual([...loaded!.entries()], [...tablesData().entries()])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('save creates the .adonis directory', async ({ assert }) => {
    const dir = tmpDir('reliese-cache')
    try {
      await SchemaCache.save(tablesData(), 'default', dir)
      assert.isTrue(existsSync(path.join(dir, SCHEMA_CACHE_PATH)))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('load returns null when the cache file is missing', async ({ assert }) => {
    const dir = tmpDir('reliese-cache')
    try {
      assert.isNull(await SchemaCache.load('default', dir))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('load returns null when the connection changed', async ({ assert }) => {
    const dir = tmpDir('reliese-cache')
    try {
      await SchemaCache.save(tablesData(), 'default', dir)
      assert.isNull(await SchemaCache.load('other', dir))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('load returns null for corrupt JSON', async ({ assert }) => {
    const dir = tmpDir('reliese-cache')
    try {
      mkdirSync(path.join(dir, '.adonis'), { recursive: true })
      writeFileSync(path.join(dir, SCHEMA_CACHE_PATH), '{ not json', 'utf-8')
      assert.isNull(await SchemaCache.load('default', dir))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('load returns null for foreign JSON and outdated versions', async ({ assert }) => {
    const dir = tmpDir('reliese-cache')
    try {
      mkdirSync(path.join(dir, '.adonis'), { recursive: true })
      const dest = path.join(dir, SCHEMA_CACHE_PATH)

      writeFileSync(dest, JSON.stringify({ hello: 'world' }), 'utf-8')
      assert.isNull(await SchemaCache.load('default', dir))

      writeFileSync(
        dest,
        JSON.stringify({
          version: 999,
          connection: 'default',
          connectionHash: hashConnection('default'),
          savedAt: new Date().toISOString(),
          tables: {},
        }),
        'utf-8'
      )
      assert.isNull(await SchemaCache.load('default', dir))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('load returns null when the stored hash was tampered with', async ({ assert }) => {
    const dir = tmpDir('reliese-cache')
    try {
      await SchemaCache.save(tablesData(), 'default', dir)
      const dest = path.join(dir, SCHEMA_CACHE_PATH)
      const file = JSON.parse(readFileSync(dest, 'utf-8'))
      file.connectionHash = 'tampered'
      writeFileSync(dest, JSON.stringify(file), 'utf-8')

      assert.isNull(await SchemaCache.load('default', dir))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
