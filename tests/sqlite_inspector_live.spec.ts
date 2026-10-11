import { test } from '@japa/runner'
import knex, { type Knex } from 'knex'
import { SqliteInspector } from '../src/inspectors/sqlite_inspector.js'

// Live database via better-sqlite3 (in-memory). Exercises the real
// PRAGMAs through knex instead of stubbed raw() results.
function liveDb(): Knex {
  return knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
  })
}

async function seed(db: Knex): Promise<void> {
  await db.schema.createTable('users', (table) => {
    table.increments('id')
    table.string('name').notNullable()
    table.string('email').notNullable().unique()
    table.boolean('is_active')
    table.dateTime('created_at').notNullable()
    table.dateTime('updated_at').notNullable()
  })
  await db.schema.createTable('posts', (table) => {
    table.increments('id')
    table.integer('user_id').notNullable().references('users.id')
    table.integer('editor_id').nullable().unique().references('users.id')
    table.text('title')
  })
  await db.schema.createTable('tags', (table) => {
    table.increments('id')
    table.string('name').notNullable()
  })
  await db.schema.createTable('post_tag', (table) => {
    table.integer('post_id').notNullable().references('posts.id')
    table.integer('tag_id').notNullable().references('tags.id')
    table.primary(['post_id', 'tag_id'])
  })
}

test.group('SqliteInspector (live)', () => {
  test('inspects tables, columns and foreign keys end to end', async ({ assert }) => {
    const db = liveDb()
    try {
      await seed(db)
      const inspector = new SqliteInspector('default', db)

      const tables = await inspector.getTables()
      assert.deepEqual(tables.sort(), ['post_tag', 'posts', 'tags', 'users'])

      const columns = await inspector.getColumns('users')
      const byName = Object.fromEntries(columns.map((c) => [c.name, c]))

      assert.containsSubset(byName.id, { sqlType: 'int', isPrimary: true, isNullable: false })
      assert.containsSubset(byName.name, { sqlType: 'text', isNullable: false })
      assert.containsSubset(byName.email, { sqlType: 'text', isNullable: false })
      assert.containsSubset(byName.created_at, { sqlType: 'datetime', isNullable: false })

      const fks = await inspector.getForeignKeys('posts')
      const byColumn = Object.fromEntries(fks.map((fk) => [fk.column, fk]))

      assert.containsSubset(byColumn.user_id, {
        foreignTable: 'users',
        foreignColumn: 'id',
        isUnique: false,
      })
      assert.containsSubset(byColumn.editor_id, {
        foreignTable: 'users',
        foreignColumn: 'id',
        isUnique: true,
      })
    } finally {
      await db.destroy()
    }
  })

  test('detects composite primary keys on pivot tables', async ({ assert }) => {
    const db = liveDb()
    try {
      await seed(db)
      const inspector = new SqliteInspector('default', db)

      const columns = await inspector.getColumns('post_tag')
      assert.lengthOf(columns, 2)
      assert.isTrue(columns.every((c) => c.isPrimary && !c.isNullable))

      const fks = await inspector.getForeignKeys('post_tag')
      assert.lengthOf(fks, 2)
    } finally {
      await db.destroy()
    }
  })
})
