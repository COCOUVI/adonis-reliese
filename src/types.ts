// ── Naming strategy ─────────────────────────────────────

export interface NamingStrategy {
  modelName(table: string): string
  propertyName(column: string): string
  relationName(table: string, type: string): string
}

// ── Package config ──────────────────────────────────────

export interface ReliesesConfig {
  outputDir: string
  connection: string
  tableFilter: {
    include: string[]
    exclude: string[]
  }
  withTimestamps: boolean
  withSoftDelete: boolean
  namingStrategy?: NamingStrategy
}

// ── Schema inspection ───────────────────────────────────

// A single column extracted from the database.
export interface ColumnDef {
  name: string
  sqlType: string
  tsType: string
  isNullable: boolean
  isPrimary: boolean
  hasDefault: boolean
}

// A single foreign key constraint.
export interface ForeignKeyDef {
  column: string
  foreignTable: string
  foreignColumn: string
}

// Common interface all inspectors must implement
// (PostgreSQL, MySQL, SQLite…).
export interface SchemaInspector {
  getTables(): Promise<string[]>
  getColumns(table: string): Promise<ColumnDef[]>
  getForeignKeys(table: string): Promise<ForeignKeyDef[]>
}

// ── Type mapping ────────────────────────────────────────

// A single entry in the static type map.
export interface MappedType {
  tsType: string
  decorator: string
}

// Result of mapping a single column.
export interface MappedColumn {
  name: string
  sqlType: string
  tsType: string
  isNullable: boolean
  isPrimary: boolean
  hasDefault: boolean
  decorator: string
}

// Result of the full TypeMapper.map() call.
export interface TypeMapperOutput {
  columns: MappedColumn[]
  needsDateTimeImport: boolean
  needsSoftDeletes: boolean
}
