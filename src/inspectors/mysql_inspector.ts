import type { ColumnDef, ForeignKeyDef, SchemaInspector } from '../types.js'
import { BaseInspector } from './base_inspector.js'

// MySQL / MariaDB inspector: queries information_schema with
// TABLE_SCHEMA = DATABASE() to target the current database.
export class MysqlInspector extends BaseInspector implements SchemaInspector {
  // Returns all BASE TABLE names from the current database.
  async getTables(): Promise<string[]> {
    const knex = await this.client()
    const result = await knex.raw(
      `SELECT TABLE_NAME
       FROM   information_schema.TABLES
       WHERE  TABLE_SCHEMA = DATABASE()
         AND  TABLE_TYPE   = 'BASE TABLE'`
    )

    return this.extractRows<{ TABLE_NAME: string }>(result).map((r) => r.TABLE_NAME)
  }

  // Returns column definitions. Primary key is identified by COLUMN_KEY = 'PRI'.
  async getColumns(table: string): Promise<ColumnDef[]> {
    const knex = await this.client()
    const result = await knex.raw(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY
       FROM   information_schema.COLUMNS
       WHERE  TABLE_SCHEMA = DATABASE()
         AND  TABLE_NAME   = ?`,
      [table]
    )

    return this.extractRows<{
      COLUMN_NAME: string
      DATA_TYPE: string
      IS_NULLABLE: string
      COLUMN_DEFAULT: string | null
      COLUMN_KEY: string
    }>(result).map((r) => ({
      name: r.COLUMN_NAME,
      sqlType: this.#normalizeType(r.DATA_TYPE),
      tsType: '',
      isNullable: r.IS_NULLABLE === 'YES',
      isPrimary: r.COLUMN_KEY === 'PRI',
      hasDefault: r.COLUMN_DEFAULT !== null,
    }))
  }

  // Returns the set of columns carrying a UNIQUE index (used by the
  // RelationDetector to tell hasOne apart from hasMany).
  async #getUniqueColumns(table: string): Promise<Set<string>> {
    const knex = await this.client()
    const result = await knex.raw(
      `SELECT COLUMN_NAME
        FROM   information_schema.STATISTICS
        WHERE  TABLE_SCHEMA = DATABASE()
          AND  TABLE_NAME   = ?
          AND  NON_UNIQUE   = 0`,
      [table]
    )

    return new Set(this.extractRows<{ COLUMN_NAME: string }>(result).map((r) => r.COLUMN_NAME))
  }

  // Returns foreign keys from KEY_COLUMN_USAGE.
  // No join needed: REFERENCED_TABLE_NAME is directly available.
  async getForeignKeys(table: string): Promise<ForeignKeyDef[]> {
    const knex = await this.client()
    const result = await knex.raw(
      `SELECT COLUMN_NAME, REFERENCED_TABLE_NAME AS foreign_table, REFERENCED_COLUMN_NAME AS foreign_column
        FROM   information_schema.KEY_COLUMN_USAGE
        WHERE  TABLE_SCHEMA = DATABASE()
          AND  TABLE_NAME   = ?
          AND  REFERENCED_TABLE_NAME IS NOT NULL`,
      [table]
    )

    const uniqueColumns = await this.#getUniqueColumns(table)

    return this.extractRows<{ COLUMN_NAME: string; foreign_table: string; foreign_column: string }>(
      result
    ).map((r) => ({
      column: r.COLUMN_NAME,
      foreignTable: r.foreign_table,
      foreignColumn: r.foreign_column,
      isUnique: uniqueColumns.has(r.COLUMN_NAME),
    }))
  }

  // Normalizes a MySQL type for the TypeMapper:
  //   - tinyint(1) → boolean
  //   - varchar(255) → varchar (strip precision)
  #normalizeType(rawType: string): string {
    const type = rawType.toLowerCase()

    if (type === 'tinyint(1)') {
      return 'boolean'
    }

    return type.replace(/\(.*\)/, '')
  }
}
