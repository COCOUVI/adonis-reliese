import { test } from '@japa/runner'
import { PgInspector } from '../src/inspectors/pg_inspector.js'
import { fakeKnex } from './helpers.js'

test.group('PgInspector', () => {
  test('getTables lists BASE TABLE names from the public schema', async ({ assert }) => {
    const inspector = new PgInspector(
      'default',
      fakeKnex(() => ({
        rows: [{ table_name: 'users' }, { table_name: 'posts' }],
      }))
    )

    assert.deepEqual(await inspector.getTables(), ['users', 'posts'])
  })

  test('getColumns maps pk, nullability and defaults', async ({ assert }) => {
    const inspector = new PgInspector(
      'default',
      fakeKnex((sql) => {
        if (sql.includes('PRIMARY KEY')) return { rows: [{ column_name: 'id' }] }
        return {
          rows: [
            { column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: null },
            {
              column_name: 'name',
              data_type: 'character varying',
              is_nullable: 'NO',
              column_default: null,
            },
            {
              column_name: 'score',
              data_type: 'numeric',
              is_nullable: 'YES',
              column_default: '0',
            },
          ],
        }
      })
    )

    const columns = await inspector.getColumns('users')
    const byName = Object.fromEntries(columns.map((c) => [c.name, c]))

    assert.containsSubset(byName.id, {
      sqlType: 'integer',
      isNullable: false,
      isPrimary: true,
      hasDefault: false,
    })
    assert.containsSubset(byName.name, { isNullable: false, isPrimary: false })
    assert.containsSubset(byName.score, { isNullable: true, hasDefault: true })
    for (const column of columns) {
      assert.strictEqual(column.tsType, '')
    }
  })

  test('getColumns supports composite primary keys', async ({ assert }) => {
    const inspector = new PgInspector(
      'default',
      fakeKnex((sql) => {
        if (sql.includes('PRIMARY KEY')) {
          return { rows: [{ column_name: 'post_id' }, { column_name: 'tag_id' }] }
        }
        return {
          rows: [
            {
              column_name: 'post_id',
              data_type: 'integer',
              is_nullable: 'NO',
              column_default: null,
            },
            {
              column_name: 'tag_id',
              data_type: 'integer',
              is_nullable: 'NO',
              column_default: null,
            },
          ],
        }
      })
    )

    const columns = await inspector.getColumns('post_tag')
    assert.isTrue(columns.every((c) => c.isPrimary))
  })

  test('getForeignKeys maps the triple join and flags unique FK columns', async ({ assert }) => {
    const inspector = new PgInspector(
      'default',
      fakeKnex((sql) => {
        if (sql.includes('FOREIGN KEY')) {
          return {
            rows: [
              { column_name: 'user_id', foreign_table: 'users', foreign_column: 'id' },
              { column_name: 'editor_id', foreign_table: 'users', foreign_column: 'id' },
            ],
          }
        }
        return { rows: [{ column_name: 'editor_id' }] }
      })
    )

    assert.deepEqual(await inspector.getForeignKeys('posts'), [
      { column: 'user_id', foreignTable: 'users', foreignColumn: 'id', isUnique: false },
      { column: 'editor_id', foreignTable: 'users', foreignColumn: 'id', isUnique: true },
    ])
  })
})
