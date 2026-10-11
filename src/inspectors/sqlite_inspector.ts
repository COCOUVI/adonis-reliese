import type { ColumnDef, ForeignKeyDef, SchemaInspector } from '../types.js'
import { BaseInspector } from './base_inspector.js'

// Raw row shapes returned by the SQLite PRAGMAs.
interface TableListRow {
  schema: string
  name: string
  type: string
}

interface TableInfoRow {
  cid: number
  name: string
  type: string
  notnull: 0 | 1
  dflt_value: string | null
  pk: number
}

interface ForeignKeyListRow {
  id: number
  seq: number
  table: string
  from: string
  to: string
}

interface IndexListRow {
  seq: number
  name: string
  unique: 0 | 1
  origin: string
  partial: 0 | 1
}

interface IndexInfoRow {
  seqno: number
  cid: number
  name: string | null
}

// SQLite inspector: uses PRAGMAs since SQLite has no information_schema.
//   - PRAGMA table_list              → table names
//   - PRAGMA table_info(table)      → columns
//   - PRAGMA foreign_key_list(table) → foreign keys
//   - PRAGMA index_list / index_info → UNIQUE columns (for hasOne detection)
export class SqliteInspector extends BaseInspector implements SchemaInspector {
  // Returns all user table names, excluding SQLite internal tables.
  async getTables(): Promise<string[]> {
    try {
      const rows = await this.#pragma<TableListRow>('table_list')
      return rows
        .filter((r) => r.type === 'table' && !r.name.startsWith('sqlite_'))
        .map((r) => r.name)
    } catch {
      // PRAGMA table_list needs SQLite 3.37+. Fall back to sqlite_master.
      const knex = await this.client()
      const rows = this.extractRows<{ name: string }>(
        await knex.raw(
          `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
        )
      )
      return rows.map((r) => r.name)
    }
  }

  // Returns column definitions for a given table.
  // pk > 0 means the column is part of the primary key (1-based order).
  async getColumns(table: string): Promise<ColumnDef[]> {
    const rows = await this.#pragma<TableInfoRow>(`table_info(${this.#escapeId(table)})`)

    return rows.map((r) => {
      const isPrimary = r.pk > 0
      return {
        name: r.name,
        sqlType: this.#normalizeType(r.type),
        tsType: '', // filled later by TypeMapper (Feature 4)
        isNullable: !isPrimary && r.notnull === 0,
        isPrimary,
        hasDefault: r.dflt_value !== null,
      }
    })
  }

  // Returns foreign keys declared on the table.
  async getForeignKeys(table: string): Promise<ForeignKeyDef[]> {
    const rows = await this.#pragma<ForeignKeyListRow>(`foreign_key_list(${this.#escapeId(table)})`)

    const uniqueColumns = await this.#getUniqueColumns(table)

    return rows.map((r) => ({
      column: r.from,
      foreignTable: r.table,
      foreignColumn: r.to,
      isUnique: uniqueColumns.has(r.from),
    }))
  }

  // Returns the set of columns carrying a UNIQUE index (used by the
  // RelationDetector to tell hasOne apart from hasMany).
  async #getUniqueColumns(table: string): Promise<Set<string>> {
    const indexes = await this.#pragma<IndexListRow>(`index_list(${this.#escapeId(table)})`)
    const unique = new Set<string>()

    for (const index of indexes) {
      if (index.unique !== 1) continue
      const cols = await this.#pragma<IndexInfoRow>(`index_info(${this.#escapeId(index.name)})`)
      for (const col of cols) {
        // Expression indexes have a NULL column name — nothing to collect.
        if (col.name !== null) unique.add(col.name)
      }
    }

    return unique
  }

  // Runs a PRAGMA and normalizes the knex raw result into a row array.
  // PRAGMAs take no bindable parameters on every driver, so the table
  // name is interpolated after escaping double quotes.
  async #pragma<T>(pragma: string): Promise<T[]> {
    const knex = await this.client()
    return this.extractRows<T>(await knex.raw(`PRAGMA ${pragma}`))
  }

  // Double-quotes an identifier, doubling embedded quotes.
  #escapeId(name: string): string {
    return `"${name.replace(/"/g, '""')}"`
  }

  // Normalizes a SQLite type for the TypeMapper. SQLite uses type
  // affinity, so declaration variants are folded onto the closest
  // TYPE_MAP entry (e.g. 'INTEGER' → 'int', 'DOUBLE' → 'float').
  // Unknown types (BLOB, empty, ...) are left as-is and handled by
  // the TypeMapper fallback.
  #normalizeType(rawType: string): string {
    const type = rawType.toLowerCase().trim()

    if (type === 'tinyint(1)') {
      return 'boolean'
    }

    const base = type.replace(/\(.*\)/, '')

    if (base.includes('int')) return 'int'
    if (base.includes('char') || base.includes('clob')) return 'text'
    if (base.includes('text')) return 'text'
    if (base === '' || base === 'blob') return base
    if (base.includes('real') || base.includes('floa') || base.includes('doub')) return 'float'
    if (base.includes('decim')) return 'numeric'
    if (base.includes('bool')) return 'boolean'

    return base
  }
}
