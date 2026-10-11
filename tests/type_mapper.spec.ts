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
      'tinyint',
      'int2',
      'int8',
      'serial',
      'bigserial',
      'real',
      'double',
      'double precision',
      'decimal',
      'dec',
      'year',
    ])) {
      assert.strictEqual(mapped.tsType, 'number', mapped.sqlType)
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

  test('falls back to unknown with a TODO for unmapped types', ({ assert }) => {
    const [mapped] = mappedTypes(['bytea'])

    assert.strictEqual(mapped.tsType, 'unknown')
    assert.match(mapped.decorator, /TODO: unmapped SQL type: bytea/)
  })
})
