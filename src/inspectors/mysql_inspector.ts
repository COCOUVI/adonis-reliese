import db from '@adonisjs/lucid/services/db'
import type { Knex } from 'knex'
import type { ColumnDef, ForeignKeyDef, SchemaInspector } from '../types.js'

// MySQL / MariaDB inspector: queries information_schema with
// TABLE_SCHEMA = DATABASE() to target the current database.
export class MysqlInspector implements SchemaInspector {
  #knex: Knex

  constructor(connectionName: string = 'default') {
    this.#knex = db.connection(connectionName).getWriteClient()
  }

  // Returns all BASE TABLE names from the current database.
  async getTables(): Promise<string[]> {
    const result = await this.#knex.raw(
      `SELECT TABLE_NAME
       FROM   information_schema.TABLES
       WHERE  TABLE_SCHEMA = DATABASE()
         AND  TABLE_TYPE   = 'BASE TABLE'`
    )

    // MySQL returns [rows, fields] from knex.raw() → result[0] holds the rows.
    return result[0].map((r: { TABLE_NAME: string }) => r.TABLE_NAME)
  }

  // Returns column definitions. Primary key is identified by COLUMN_KEY = 'PRI'.
  async getColumns(table: string): Promise<ColumnDef[]> {
    const result = await this.#knex.raw(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY
       FROM   information_schema.COLUMNS
       WHERE  TABLE_SCHEMA = DATABASE()
         AND  TABLE_NAME   = ?`,
      [table]
    )

    return result[0].map(
      (r: {
        COLUMN_NAME: string
        DATA_TYPE: string
        IS_NULLABLE: string
        COLUMN_DEFAULT: string | null
        COLUMN_KEY: string
      }) => ({
        name: r.COLUMN_NAME,
        sqlType: this.#normalizeType(r.DATA_TYPE),
        tsType: '',
        isNullable: r.IS_NULLABLE === 'YES',
        isPrimary: r.COLUMN_KEY === 'PRI',
        hasDefault: r.COLUMN_DEFAULT !== null,
      })
    )
  }

  // Returns foreign keys from KEY_COLUMN_USAGE.
  // No join needed: REFERENCED_TABLE_NAME is directly available.
  async getForeignKeys(table: string): Promise<ForeignKeyDef[]> {
    const result = await this.#knex.raw(
      `SELECT COLUMN_NAME, REFERENCED_TABLE_NAME AS foreign_table, REFERENCED_COLUMN_NAME AS foreign_column
       FROM   information_schema.KEY_COLUMN_USAGE
       WHERE  TABLE_SCHEMA = DATABASE()
         AND  TABLE_NAME   = ?
         AND  REFERENCED_TABLE_NAME IS NOT NULL`,
      [table]
    )

    return result[0].map(
      (r: { COLUMN_NAME: string; foreign_table: string; foreign_column: string }) => ({
        column: r.COLUMN_NAME,
        foreignTable: r.foreign_table,
        foreignColumn: r.foreign_column,
      })
    )
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
