import { test } from '@japa/runner'
import { TypeMapper } from '../src/type_mapper.js'
import type { ColumnDef } from '../src/types.js'

function column(sqlType: string, overrides: Partial<ColumnDef> = {}): ColumnDef {
  return {
    name: 'c',
    sqlType,
    tsType: '',
    isNullable: true,
    isPrimary: false,
    hasDefault: false,
    ...overrides,
  }
}

function mappedTypes(sqlTypes: string[]) {
  const mapper = new TypeMapper({ withTimestamps: false, withSoftDelete: false })
  return mapper.map(sqlTypes.map((sqlType) => column(sqlType))).columns
}

test.group('TypeMapper', () => {
  test('maps raw information_schema type names directly', ({ assert }) => {
    const byType = Object.fromEntries(mappedTypes(['integer']).map((c) => [c.sqlType, c]))

    assert.containsSubset(byType.integer, { tsType: 'number', decorator: 'column()' })
  })

  test('maps integer and float aliases to number', ({ assert }) => {
    for (const mapped of mappedTypes([
      'smallint',
      'mediumint',
      'int2',
      'int4',
      'serial',
      'smallserial',
      'real',
      'double',
      'double precision',
      'year',
    ])) {
      assert.strictEqual(mapped.tsType, 'number', mapped.sqlType)
      assert.strictEqual(mapped.decorator, 'column()', mapped.sqlType)
    }
  })

  test('maps bigint aliases to bigint | number (Lucid convention)', ({ assert }) => {
    for (const mapped of mappedTypes(['int8', 'bigint', 'bigserial'])) {
      assert.strictEqual(mapped.tsType, 'bigint | number', mapped.sqlType)
      assert.strictEqual(mapped.decorator, 'column()', mapped.sqlType)
    }
  })

  test('maps decimals to string (Lucid convention, no precision loss)', ({ assert }) => {
    for (const mapped of mappedTypes(['numeric', 'decimal', 'dec', 'decimal(10,2)'])) {
      assert.strictEqual(mapped.tsType, 'string', mapped.sqlType)
      assert.strictEqual(mapped.decorator, 'column()', mapped.sqlType)
    }
  })

  test('maps json to any, time to string and blobs to Buffer', ({ assert }) => {
    const byType = Object.fromEntries(
      mappedTypes(['json', 'jsonb', 'time', 'binary', 'varbinary', 'blob']).map((c) => [
        c.sqlType,
        c,
      ])
    )

    assert.containsSubset(byType.json, { tsType: 'any', decorator: 'column()' })
    assert.containsSubset(byType.jsonb, { tsType: 'any', decorator: 'column()' })
    assert.containsSubset(byType.time, { tsType: 'string', decorator: 'column()' })
    assert.containsSubset(byType.binary, { tsType: 'Buffer', decorator: 'column()' })
    assert.containsSubset(byType.varbinary, { tsType: 'Buffer', decorator: 'column()' })
    assert.containsSubset(byType.blob, { tsType: 'Buffer', decorator: 'column()' })
  })

  test('hides password behind serializeAs null (Lucid convention)', ({ assert }) => {
    const mapper = new TypeMapper({ withTimestamps: false, withSoftDelete: false })
    const [result] = mapper.map([column('varchar', { name: 'password' })]).columns

    assert.strictEqual(result.tsType, 'string')
    assert.strictEqual(result.decorator, 'column({ serializeAs: null })')
  })

  test('maps boolean aliases to boolean (incl. MySQL tinyint)', ({ assert }) => {
    for (const mapped of mappedTypes(['boolean', 'bool', 'tinyint', 'tinyint(1)'])) {
      assert.strictEqual(mapped.tsType, 'boolean', mapped.sqlType)
      assert.strictEqual(mapped.decorator, 'column()', mapped.sqlType)
    }
  })

  test('maps string aliases to string', ({ assert }) => {
    for (const mapped of mappedTypes([
      'character varying',
      'character',
      'tinytext',
      'mediumtext',
      'longtext',
      'enum',
      'set',
    ])) {
      assert.strictEqual(mapped.tsType, 'string', mapped.sqlType)
      assert.strictEqual(mapped.decorator, 'column()', mapped.sqlType)
    }
  })

  test('maps timestamp with time zone variants to DateTime', ({ assert }) => {
    const mapper = new TypeMapper({ withTimestamps: false, withSoftDelete: false })
    const out = mapper.map([
      column('timestamp with time zone'),
      column('timestamp without time zone'),
    ])

    assert.isTrue(out.needsDateTimeImport)
    for (const mapped of out.columns) {
      assert.strictEqual(mapped.tsType, 'DateTime')
      assert.strictEqual(mapped.decorator, 'column.dateTime()')
    }
  })

  test('falls back to any with a TODO for unmapped types', ({ assert }) => {
    const [mapped] = mappedTypes(['geometry'])

    assert.strictEqual(mapped.tsType, 'any')
    assert.match(mapped.decorator, /TODO: unmapped SQL type: geometry/)
  })
})
