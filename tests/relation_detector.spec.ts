import { test } from '@japa/runner'
import { RelationDetector } from '../src/relation_detector.js'
import type { TableSchema } from '../src/types.js'

function schema(columns: string[], fks: TableSchema['foreignKeys'] = []): TableSchema {
  return {
    columns: columns.map((name) => ({
      name,
      sqlType: 'int',
      tsType: 'number',
      isNullable: false,
      isPrimary: name === 'id',
      hasDefault: false,
    })),
    foreignKeys: fks,
  }
}

function fk(column: string, foreignTable: string, foreignColumn = 'id', isUnique = false) {
  return { column, foreignTable, foreignColumn, isUnique }
}

test.group('RelationDetector', () => {
  test('detects belongsTo from an outgoing FK', ({ assert }) => {
    const tables = new Map<string, TableSchema>([
      ['posts', schema(['id', 'user_id', 'title'], [fk('user_id', 'users')])],
      ['users', schema(['id', 'name'])],
    ])

    const relations = new RelationDetector().detect(tables)
    const posts = relations.get('posts')!

    assert.lengthOf(posts, 1)
    assert.containsSubset(posts[0], {
      type: 'belongsTo',
      targetModel: 'User',
      targetTable: 'users',
      propertyName: 'user',
    })
  })

  test('detects hasMany by default and hasOne when the FK is unique', ({ assert }) => {
    const tables = new Map<string, TableSchema>([
      ['users', schema(['id'])],
      [
        'posts',
        schema(['id', 'user_id'], [fk('user_id', 'users'), fk('user_id', 'users', 'id', true)]),
      ],
    ])

    const detector = new RelationDetector()
    const users = detector.detect(tables).get('users')!

    const types = users.map((r) => r.type).sort()
    assert.deepEqual(types, ['hasMany', 'hasOne'])
    const hasOne = users.find((r) => r.type === 'hasOne')!
    assert.equal(hasOne.propertyName, 'post')
    const hasMany = users.find((r) => r.type === 'hasMany')!
    assert.equal(hasMany.propertyName, 'posts')
  })

  test('detects manyToMany from a pivot table', ({ assert }) => {
    const tables = new Map<string, TableSchema>([
      ['posts', schema(['id', 'title'])],
      ['tags', schema(['id', 'name'])],
      [
        'post_tag',
        schema(['id', 'post_id', 'tag_id'], [fk('post_id', 'posts'), fk('tag_id', 'tags')]),
      ],
    ])

    const relations = new RelationDetector().detect(tables)

    assert.isFalse(
      relations.get('post_tag')!.length > 0,
      'pivot table should not get plain relations'
    )

    const posts = relations.get('posts')!
    const tags = relations.get('tags')!

    assert.lengthOf(posts, 1)
    assert.containsSubset(posts[0], {
      type: 'manyToMany',
      targetModel: 'Tag',
      targetTable: 'tags',
      propertyName: 'tags',
      pivotTable: 'post_tag',
    })

    assert.lengthOf(tags, 1)
    assert.containsSubset(tags[0], {
      type: 'manyToMany',
      targetModel: 'Post',
      targetTable: 'posts',
      propertyName: 'posts',
      pivotTable: 'post_tag',
    })
  })

  test('flags relations to non-inspected tables as remote missing', ({ assert }) => {
    const tables = new Map<string, TableSchema>([
      ['posts', schema(['id', 'user_id'], [fk('user_id', 'missing_users')])],
    ])

    const posts = new RelationDetector().detect(tables).get('posts')!
    assert.lengthOf(posts, 1)
    assert.isTrue(posts[0].isRemoteMissing)
    assert.equal(posts[0].targetTable, 'missing_users')
  })

  test('ignores system columns when deciding if a table is a pivot', ({ assert }) => {
    const tables = new Map<string, TableSchema>([
      ['posts', schema(['id'])],
      ['tags', schema(['id'])],
      [
        'post_tag',
        schema(
          ['id', 'post_id', 'tag_id', 'created_at'],
          [fk('post_id', 'posts'), fk('tag_id', 'tags')]
        ),
      ],
    ])

    const relations = new RelationDetector().detect(tables)
    assert.lengthOf(relations.get('posts')!, 1)
    assert.equal(relations.get('posts')![0].type, 'manyToMany')
  })
})
