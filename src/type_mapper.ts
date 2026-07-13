import type { ColumnDef, MappedColumn, TypeMapperOutput } from './types.js'
import { TYPE_MAP } from './type_map.js'

export interface TypeMapperOptions {
  withTimestamps: boolean
  withSoftDelete: boolean
}

// Converts ColumnDef[] (from a SchemaInspector) into MappedColumn[]
// with proper TypeScript types and Lucid decorator strings.
export class TypeMapper {
  #options: TypeMapperOptions

  constructor(options: TypeMapperOptions) {
    this.#options = options
  }

  map(columns: ColumnDef[]): TypeMapperOutput {
    const mapped: MappedColumn[] = []
    let needsDateTimeImport = false
    let needsSoftDeletes = false

    for (const col of columns) {
      mapped.push(
        this.#mapColumn(
          col,
          () => {
            needsDateTimeImport = true
          },
          () => {
            needsSoftDeletes = true
          }
        )
      )
    }

    return { columns: mapped, needsDateTimeImport, needsSoftDeletes }
  }

  #mapColumn(
    col: ColumnDef,
    onNeedsDateTime: () => void,
    onNeedsSoftDeletes: () => void
  ): MappedColumn {
    const normalizedType = this.#normalizeType(col.sqlType)
    const entry = TYPE_MAP[normalizedType]

    if (!entry) {
      return {
        name: col.name,
        sqlType: col.sqlType,
        tsType: 'unknown',
        isNullable: col.isNullable,
        isPrimary: col.isPrimary,
        hasDefault: col.hasDefault,
        decorator: `column() // TODO: type SQL non mappé : ${col.sqlType}`,
      }
    }

    let tsType = entry.tsType
    let decorator = entry.decorator

    if (tsType === 'DateTime') {
      onNeedsDateTime()
    }

    // Timestamps / soft-delete take precedence over other options.
    // We force column.dateTime regardless of the SQL type.
    const tsResult = this.#handleTimestampColumn(col)
    if (tsResult) {
      return tsResult
    }

    const sdResult = this.#handleSoftDeleteColumn(col, onNeedsSoftDeletes)
    if (sdResult) {
      return sdResult
    }

    // Primary key
    if (col.isPrimary) {
      decorator = `${decorator}({ isPrimary: true })`
    } else {
      decorator = `${decorator}()`
    }

    return {
      name: col.name,
      sqlType: col.sqlType,
      tsType,
      isNullable: col.isNullable,
      isPrimary: col.isPrimary,
      hasDefault: col.hasDefault,
      decorator,
    }
  }

  #handleTimestampColumn(col: ColumnDef): MappedColumn | null {
    if (!this.#options.withTimestamps) return null

    switch (col.name) {
      case 'created_at':
        return {
          name: col.name,
          sqlType: col.sqlType,
          tsType: 'DateTime',
          isNullable: col.isNullable,
          isPrimary: false,
          hasDefault: true,
          decorator: 'column.dateTime({ autoCreate: true })',
        }
      case 'updated_at':
        return {
          name: col.name,
          sqlType: col.sqlType,
          tsType: 'DateTime',
          isNullable: col.isNullable,
          isPrimary: false,
          hasDefault: true,
          decorator: 'column.dateTime({ autoCreate: true, autoUpdate: true })',
        }
      default:
        return null
    }
  }

  #handleSoftDeleteColumn(col: ColumnDef, onNeedsSoftDeletes: () => void): MappedColumn | null {
    if (!this.#options.withSoftDelete) return null
    if (col.name !== 'deleted_at') return null

    onNeedsSoftDeletes()

    return {
      name: col.name,
      sqlType: col.sqlType,
      tsType: 'DateTime',
      isNullable: col.isNullable,
      isPrimary: false,
      hasDefault: false,
      decorator: 'column.dateTime()',
    }
  }

  // Strips precision from a SQL type and lowercases it.
  // Examples: 'VARCHAR(255)' → 'varchar', 'TINYINT(1)' → 'tinyint(1)'
  #normalizeType(sqlType: string): string {
    return sqlType.toLowerCase().replace(/\(.*\)/, '')
  }
}
