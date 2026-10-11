import { test } from '@japa/runner'
import type { Knex } from 'knex'
import { MysqlInspector } from '../src/inspectors/mysql_inspector.js'

// Minimal knex stub returning mysql-shaped results ([rows, fields]).
function fakeKnex(responder: (sql: string, bindings: unknown[]) => unknown): Knex {
  return {
    raw: (sql: string, bindings: unknown[]) => Promise.resolve([responder(sql, bindings), []]),
  } as unknown as Knex
}

test.group('MysqlInspector', () => {
  test('getTables lists BASE TABLE names from the current database', async ({ assert }) => {
    const inspector = new MysqlInspector(
      'default',
      fakeKnex(() => [{ TABLE_NAME: 'users' }, { TABLE_NAME: 'posts' }])
    )

    assert.deepEqual(await inspector.getTables(), ['users', 'posts'])
  })

  test('getColumns maps PRI keys, nullability, defaults and normalizes types', async ({
    assert,
  }) => {
    const inspector = new MysqlInspector(
      'default',
      fakeKnex(() => [
        {
          COLUMN_NAME: 'id',
          DATA_TYPE: 'int',
          IS_NULLABLE: 'NO',
          COLUMN_DEFAULT: null,
          COLUMN_KEY: 'PRI',
        },
        {
          COLUMN_NAME: 'name',
          DATA_TYPE: 'varchar(255)',
          IS_NULLABLE: 'NO',
          COLUMN_DEFAULT: null,
          COLUMN_KEY: '',
        },
        {
          COLUMN_NAME: 'is_active',
          DATA_TYPE: 'tinyint(1)',
          IS_NULLABLE: 'YES',
          COLUMN_DEFAULT: null,
          COLUMN_KEY: '',
        },
        {
          COLUMN_NAME: 'score',
          DATA_TYPE: 'decimal(10,2)',
          IS_NULLABLE: 'YES',
          COLUMN_DEFAULT: '0.00',
          COLUMN_KEY: '',
        },
      ])
    )

    const columns = await inspector.getColumns('users')
    const byName = Object.fromEntries(columns.map((c) => [c.name, c]))

    assert.containsSubset(byName.id, {
      sqlType: 'int',
      isNullable: false,
      isPrimary: true,
      hasDefault: false,
    })
    assert.containsSubset(byName.name, { sqlType: 'varchar', isNullable: false })
    assert.containsSubset(byName.is_active, { sqlType: 'boolean', isNullable: true })
    assert.containsSubset(byName.score, { sqlType: 'decimal', hasDefault: true })
    for (const column of columns) {
      assert.strictEqual(column.tsType, '')
    }
  })

  test('getForeignKeys maps KEY_COLUMN_USAGE and flags unique FK columns', async ({ assert }) => {
    const inspector = new MysqlInspector(
      'default',
      fakeKnex((sql) => {
        if (sql.includes('KEY_COLUMN_USAGE')) {
          return [
            { COLUMN_NAME: 'user_id', foreign_table: 'users', foreign_column: 'id' },
            { COLUMN_NAME: 'editor_id', foreign_table: 'users', foreign_column: 'id' },
          ]
        }
        return [{ COLUMN_NAME: 'editor_id' }]
      })
    )

    assert.deepEqual(await inspector.getForeignKeys('posts'), [
      { column: 'user_id', foreignTable: 'users', foreignColumn: 'id', isUnique: false },
      { column: 'editor_id', foreignTable: 'users', foreignColumn: 'id', isUnique: true },
    ])
  })
})
