import { test } from '@japa/runner'
import type { Knex } from 'knex'
import { SqliteInspector } from '../src/inspectors/sqlite_inspector.js'

// Builds a minimal knex stub routing raw SQL to a responder,
// while recording every statement for escaping assertions.
function fakeKnex(responder: (sql: string) => unknown, seen: string[] = []): Knex {
  return {
    raw: (sql: string) => {
      seen.push(sql)
      return Promise.resolve(responder(sql))
    },
  } as unknown as Knex
}

function tableListRows() {
  return [
    { schema: 'main', name: 'users', type: 'table' },
    { schema: 'main', name: 'posts', type: 'table' },
    { schema: 'main', name: 'user_names', type: 'view' },
    { schema: 'main', name: 'sqlite_sequence', type: 'table' },
  ]
}

function usersInfoRows() {
  return [
    { cid: 0, name: 'id', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 1 },
    { cid: 1, name: 'name', type: 'VARCHAR(255)', notnull: 1, dflt_value: null, pk: 0 },
    { cid: 2, name: 'email', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
    { cid: 3, name: 'score', type: 'REAL', notnull: 0, dflt_value: '0', pk: 0 },
    { cid: 4, name: 'is_active', type: 'TINYINT(1)', notnull: 0, dflt_value: null, pk: 0 },
    { cid: 5, name: 'avatar', type: 'BLOB', notnull: 0, dflt_value: null, pk: 0 },
    { cid: 6, name: 'misc', type: '', notnull: 0, dflt_value: null, pk: 0 },
  ]
}

test.group('SqliteInspector', () => {
  test('getTables lists user tables and skips views and sqlite_ internals', async ({ assert }) => {
    const inspector = new SqliteInspector(
      'default',
      fakeKnex((sql) => (sql.startsWith('PRAGMA table_list') ? tableListRows() : []))
    )

    assert.deepEqual(await inspector.getTables(), ['users', 'posts'])
  })

  test('getTables falls back to sqlite_master when table_list is unavailable', async ({
    assert,
  }) => {
    const seen: string[] = []
    const inspector = new SqliteInspector(
      'default',
      fakeKnex((sql) => {
        if (sql.startsWith('PRAGMA table_list')) throw new Error('no such pragma')
        return [{ name: 'users' }, { name: 'posts' }]
      }, seen)
    )

    assert.deepEqual(await inspector.getTables(), ['users', 'posts'])
    assert.isTrue(seen.some((s) => s.includes('sqlite_master')))
  })

  test('getTables accepts pg-style and mysql-style raw result shapes', async ({ assert }) => {
    const pg = new SqliteInspector(
      'default',
      fakeKnex((sql) => (sql.startsWith('PRAGMA') ? { rows: tableListRows() } : []))
    )
    assert.deepEqual(await pg.getTables(), ['users', 'posts'])

    const mysql = new SqliteInspector(
      'default',
      fakeKnex((sql) => (sql.startsWith('PRAGMA') ? [tableListRows(), []] : []))
    )
    assert.deepEqual(await mysql.getTables(), ['users', 'posts'])
  })

  test('getColumns maps pk, nullability, defaults and normalizes types', async ({ assert }) => {
    const inspector = new SqliteInspector(
      'default',
      fakeKnex((sql) => (sql.startsWith('PRAGMA table_info') ? usersInfoRows() : []))
    )

    const columns = await inspector.getColumns('users')
    const byName = Object.fromEntries(columns.map((c) => [c.name, c]))

    // INTEGER PRIMARY KEY reports notnull=0 but is never nullable.
    assert.containsSubset(byName.id, {
      sqlType: 'int',
      isNullable: false,
      isPrimary: true,
      hasDefault: false,
    })
    assert.containsSubset(byName.name, {
      sqlType: 'text',
      isNullable: false,
      isPrimary: false,
      hasDefault: false,
    })
    assert.containsSubset(byName.score, {
      sqlType: 'float',
      isNullable: true,
      isPrimary: false,
      hasDefault: true,
    })
    assert.containsSubset(byName.is_active, { sqlType: 'boolean' })
    // Unknown affinities are left for the TypeMapper fallback.
    assert.containsSubset(byName.avatar, { sqlType: 'blob' })
    assert.containsSubset(byName.misc, { sqlType: '' })
    for (const column of columns) {
      assert.strictEqual(column.tsType, '')
    }
  })

  test('getColumns marks every composite-PK column as primary', async ({ assert }) => {
    const inspector = new SqliteInspector(
      'default',
      fakeKnex((sql) =>
        sql.startsWith('PRAGMA table_info')
          ? [
              { cid: 0, name: 'post_id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
              { cid: 1, name: 'tag_id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 2 },
            ]
          : []
      )
    )

    const columns = await inspector.getColumns('post_tag')
    assert.isTrue(columns.every((c) => c.isPrimary && !c.isNullable))
  })

  test('getForeignKeys maps from/table/to and flags unique FK columns', async ({ assert }) => {
    const inspector = new SqliteInspector(
      'default',
      fakeKnex((sql) => {
        if (sql.startsWith('PRAGMA foreign_key_list')) {
          return [
            { id: 0, seq: 0, table: 'users', from: 'user_id', to: 'id' },
            { id: 1, seq: 0, table: 'users', from: 'editor_id', to: 'id' },
          ]
        }
        if (sql.startsWith('PRAGMA index_list')) {
          return [{ seq: 0, name: 'posts_editor_uq', unique: 1, origin: 'c', partial: 0 }]
        }
        if (sql.startsWith('PRAGMA index_info')) {
          return [{ seqno: 0, cid: 2, name: 'editor_id' }]
        }
        return []
      })
    )

    assert.deepEqual(await inspector.getForeignKeys('posts'), [
      { column: 'user_id', foreignTable: 'users', foreignColumn: 'id', isUnique: false },
      { column: 'editor_id', foreignTable: 'users', foreignColumn: 'id', isUnique: true },
    ])
  })

  test('unique detection ignores expression indexes with NULL column names', async ({ assert }) => {
    const inspector = new SqliteInspector(
      'default',
      fakeKnex((sql) => {
        if (sql.startsWith('PRAGMA foreign_key_list')) {
          return [{ id: 0, seq: 0, table: 'users', from: 'user_id', to: 'id' }]
        }
        if (sql.startsWith('PRAGMA index_list')) {
          return [
            { seq: 0, name: 'sqlite_autoindex_users_1', unique: 1, origin: 'u', partial: 0 },
            { seq: 1, name: 'users_expr_uq', unique: 1, origin: 'c', partial: 0 },
          ]
        }
        if (sql.includes('sqlite_autoindex_users_1')) {
          return [{ seqno: 0, cid: 2, name: 'email' }]
        }
        return [{ seqno: 0, cid: -2, name: null }]
      })
    )

    assert.deepEqual(await inspector.getForeignKeys('posts'), [
      { column: 'user_id', foreignTable: 'users', foreignColumn: 'id', isUnique: false },
    ])
  })

  test('table names with double quotes are escaped by doubling', async ({ assert }) => {
    const seen: string[] = []
    const inspector = new SqliteInspector(
      'default',
      fakeKnex((sql) => {
        if (sql.startsWith('PRAGMA table_info')) return []
        if (sql.startsWith('PRAGMA foreign_key_list')) return []
        if (sql.startsWith('PRAGMA index_list')) return []
        return []
      }, seen)
    )

    await inspector.getColumns('we"ird')
    await inspector.getForeignKeys('we"ird')

    assert.isTrue(seen.includes('PRAGMA table_info("we""ird")'))
    assert.isTrue(seen.includes('PRAGMA foreign_key_list("we""ird")'))
  })
})
