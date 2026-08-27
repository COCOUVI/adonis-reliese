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
  // True when the FK column carries a UNIQUE index. Used by the
  // RelationDetector to decide between `hasOne` and `hasMany`.
  isUnique?: boolean
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

// ── Relation detection ─────────────────────────────────

export type RelationType = 'belongsTo' | 'hasMany' | 'hasOne' | 'manyToMany'

// A relation inferred for a given model. Consumed by the ModelWriter
// (Feature 7) to emit the matching Lucid decorators.
export interface RelationDef {
  type: RelationType
  // PascalCase model name of the related table (e.g. `User`).
  targetModel: string
  // Raw table name of the related table (used to resolve the import path).
  targetTable: string
  // camelCase property name used on the model (e.g. `user`, `posts`).
  propertyName: string
  // Only for manyToMany: the junction table name.
  pivotTable?: string
  // True when the related table was not part of the inspected tables.
  isRemoteMissing?: boolean
}

// Schema data for a single table, as consumed by the RelationDetector.
export interface TableSchema {
  columns: ColumnDef[]
  foreignKeys: ForeignKeyDef[]
}

// ── Model writer ────────────────────────────────────────

export type WriteStatus = 'created' | 'skipped' | 'error'

export interface WriteResult {
  status: WriteStatus
  modelName: string
  filePath: string
  error?: string
}
