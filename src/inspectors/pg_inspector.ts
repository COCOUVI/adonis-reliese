import db from '@adonisjs/lucid/services/db'
import type { Knex } from 'knex'
import type { ColumnDef, ForeignKeyDef, SchemaInspector } from '../types.js'

// PostgreSQL inspector: queries information_schema to extract
// tables, columns and foreign keys from the 'public' schema.
export class PgInspector implements SchemaInspector {
  #knex: Knex

  constructor(connectionName: string = 'default') {
    this.#knex = db.connection(connectionName).getWriteClient()
  }

  // Returns all BASE TABLE names from the public schema.
  async getTables(): Promise<string[]> {
    const result = await this.#knex.raw(
      `SELECT table_name
       FROM   information_schema.tables
       WHERE  table_schema = 'public'
         AND  table_type   = 'BASE TABLE'`
    )

    return result.rows.map((r: { table_name: string }) => r.table_name)
  }

  // Returns column definitions for a given table.
  // Primary key detection uses a sub-query on table_constraints.
  async getColumns(table: string): Promise<ColumnDef[]> {
    const pkResult = await this.#knex.raw(
      `SELECT kcu.column_name
       FROM   information_schema.table_constraints tc
       JOIN   information_schema.key_column_usage  kcu USING (constraint_name, table_schema)
       WHERE  tc.constraint_type = 'PRIMARY KEY'
         AND  tc.table_name      = ?
         AND  tc.table_schema    = 'public'`,
      [table]
    )

    const pkSet = new Set(pkResult.rows.map((r: { column_name: string }) => r.column_name))

    const colResult = await this.#knex.raw(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM   information_schema.columns
       WHERE  table_name  = ?
         AND  table_schema = 'public'`,
      [table]
    )

    return colResult.rows.map(
      (r: {
        column_name: string
        data_type: string
        is_nullable: string
        column_default: string | null
      }) => ({
        name: r.column_name,
        sqlType: r.data_type,
        tsType: '', // filled later by TypeMapper (Feature 4)
        isNullable: r.is_nullable === 'YES',
        isPrimary: pkSet.has(r.column_name),
        hasDefault: r.column_default !== null,
      })
    )
  }

  // Returns the set of columns carrying a UNIQUE constraint (used by the
  // RelationDetector to tell hasOne apart from hasMany).
  async #getUniqueColumns(table: string): Promise<Set<string>> {
    const result = await this.#knex.raw(
      `SELECT kcu.column_name
        FROM   information_schema.table_constraints tc
        JOIN   information_schema.key_column_usage  kcu USING (constraint_name, table_schema)
        WHERE  tc.constraint_type = 'UNIQUE'
          AND  tc.table_name      = ?
          AND  tc.table_schema    = 'public'`,
      [table]
    )

    return new Set(result.rows.map((r: { column_name: string }) => r.column_name))
  }

  // Returns foreign keys via a triple join on
  // table_constraints / key_column_usage / constraint_column_usage.
  async getForeignKeys(table: string): Promise<ForeignKeyDef[]> {
    const result = await this.#knex.raw(
      `SELECT kcu.column_name,
               ccu.table_name  AS foreign_table,
               ccu.column_name AS foreign_column
        FROM   information_schema.table_constraints       tc
        JOIN   information_schema.key_column_usage        kcu USING (constraint_name, table_schema)
        JOIN   information_schema.constraint_column_usage ccu USING (constraint_name, table_schema)
        WHERE  tc.constraint_type = 'FOREIGN KEY'
          AND  tc.table_name      = ?
          AND  tc.table_schema    = 'public'`,
      [table]
    )

    const uniqueColumns = await this.#getUniqueColumns(table)

    return result.rows.map(
      (r: { column_name: string; foreign_table: string; foreign_column: string }) => ({
        column: r.column_name,
        foreignTable: r.foreign_table,
        foreignColumn: r.foreign_column,
        isUnique: uniqueColumns.has(r.column_name),
      })
    )
  }
}
