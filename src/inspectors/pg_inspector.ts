import type { ColumnDef, ForeignKeyDef, SchemaInspector } from '../types.js'
import { BaseInspector } from './base_inspector.js'

// PostgreSQL inspector: queries information_schema to extract
// tables, columns and foreign keys from the 'public' schema.
export class PgInspector extends BaseInspector implements SchemaInspector {
  // Returns all BASE TABLE names from the public schema.
  async getTables(): Promise<string[]> {
    const knex = await this.client()
    const result = await knex.raw(
      `SELECT table_name
       FROM   information_schema.tables
       WHERE  table_schema = 'public'
         AND  table_type   = 'BASE TABLE'`
    )

    return this.extractRows<{ table_name: string }>(result).map((r) => r.table_name)
  }

  // Returns column definitions for a given table.
  // Primary key detection uses a sub-query on table_constraints.
  async getColumns(table: string): Promise<ColumnDef[]> {
    const knex = await this.client()
    const pkResult = await knex.raw(
      `SELECT kcu.column_name
       FROM   information_schema.table_constraints tc
       JOIN   information_schema.key_column_usage  kcu USING (constraint_name, table_schema)
       WHERE  tc.constraint_type = 'PRIMARY KEY'
         AND  tc.table_name      = ?
         AND  tc.table_schema    = 'public'`,
      [table]
    )

    const pkSet = new Set(
      this.extractRows<{ column_name: string }>(pkResult).map((r) => r.column_name)
    )

    const colResult = await knex.raw(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM   information_schema.columns
       WHERE  table_name  = ?
         AND  table_schema = 'public'`,
      [table]
    )

    return this.extractRows<{
      column_name: string
      data_type: string
      is_nullable: string
      column_default: string | null
    }>(colResult).map((r) => ({
      name: r.column_name,
      sqlType: r.data_type,
      tsType: '', // filled later by TypeMapper (Feature 4)
      isNullable: r.is_nullable === 'YES',
      isPrimary: pkSet.has(r.column_name),
      hasDefault: r.column_default !== null,
    }))
  }

  // Returns the set of columns carrying a UNIQUE constraint (used by the
  // RelationDetector to tell hasOne apart from hasMany).
  async #getUniqueColumns(table: string): Promise<Set<string>> {
    const knex = await this.client()
    const result = await knex.raw(
      `SELECT kcu.column_name
        FROM   information_schema.table_constraints tc
        JOIN   information_schema.key_column_usage  kcu USING (constraint_name, table_schema)
        WHERE  tc.constraint_type = 'UNIQUE'
          AND  tc.table_name      = ?
          AND  tc.table_schema    = 'public'`,
      [table]
    )

    return new Set(this.extractRows<{ column_name: string }>(result).map((r) => r.column_name))
  }

  // Returns foreign keys via a triple join on
  // table_constraints / key_column_usage / constraint_column_usage.
  async getForeignKeys(table: string): Promise<ForeignKeyDef[]> {
    const knex = await this.client()
    const result = await knex.raw(
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

    return this.extractRows<{ column_name: string; foreign_table: string; foreign_column: string }>(
      result
    ).map((r) => ({
      column: r.column_name,
      foreignTable: r.foreign_table,
      foreignColumn: r.foreign_column,
      isUnique: uniqueColumns.has(r.column_name),
    }))
  }
}
