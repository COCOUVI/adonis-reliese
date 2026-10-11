// ── Naming strategy ─────────────────────────────────────

export interface NamingStrategy {
  modelName(table: string): string
  propertyName(column: string): string
  relationName(table: string, type: string): string
  // File base name (without extension) for the generated model,
  // following the AdonisJS convention: lowercase singular (users → user).
  fileName(table: string): string
}

// ── Package configuration ───────────────────────────────

export interface ReliesesConfig {
  outputDir: string
  // Lucid connection to inspect. When omitted (or the legacy value
  // 'default'), the app's primary connection from config/database.ts is used.
  connection?: string
  tableFilter: {
    include: string[]
    exclude: string[]
  }
  withTimestamps: boolean
  withSoftDelete: boolean
  // When true, each table generates a base/ file always regenerated
  // plus a child file created only once.
  withBaseFiles: boolean
  namingStrategy?: NamingStrategy
}

// ── Schema inspection ─────────────────────────────────

// A column extracted from the database.
export interface ColumnDef {
  name: string
  sqlType: string
  tsType: string
  isNullable: boolean
  isPrimary: boolean
  hasDefault: boolean
}

// A foreign key constraint.
export interface ForeignKeyDef {
  column: string
  foreignTable: string
  foreignColumn: string
  // True when the FK column carries a UNIQUE index. Used by the
  // RelationDetector to choose between `hasOne` and `hasMany`.
  isUnique?: boolean
}

// Common interface for all inspectors (PostgreSQL, MySQL, SQLite...).
export interface SchemaInspector {
  getTables(): Promise<string[]>
  getColumns(table: string): Promise<ColumnDef[]>
  getForeignKeys(table: string): Promise<ForeignKeyDef[]>
}

// ── Type mapping ───────────────────────────────────────

// An entry of the static mapping table.
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

// Result of a full TypeMapper.map() call.
export interface TypeMapperOutput {
  columns: MappedColumn[]
  needsDateTimeImport: boolean
  needsSoftDeletes: boolean
}

// ── Relation detection ─────────────────────────────────

export type RelationType = 'belongsTo' | 'hasMany' | 'hasOne' | 'manyToMany'

// Relation inferred for a given model. Consumed by the ModelWriter
// (Feature 7) to emit the corresponding Lucid decorators.
export interface RelationDef {
  type: RelationType
  // PascalCase model name of the related table (e.g. `User`).
  targetModel: string
  // Raw table name of the related table (used to resolve the import path).
  targetTable: string
  // camelCase property name used on the model (e.g. user, posts).
  propertyName: string
  // Only for manyToMany: name of the join table.
  pivotTable?: string
  // True when the related table is not among the inspected tables.
  isRemoteMissing?: boolean
}

// Schema data for a table, as consumed by the RelationDetector.
export interface TableSchema {
  columns: ColumnDef[]
  foreignKeys: ForeignKeyDef[]
}

// ── Model generator ───────────────────────────────────

export type WriteStatus = 'created' | 'skipped' | 'error'

// Result of a ModelWriter.write() (or render()) call. In default mode
// (without base_files) the single model file is reported via `baseStatus` /
// `basePath`, and `childStatus` is `'skipped'`. In base_files mode, the
// base file (always regenerated) and the child file (created once) are
// both reported. `baseContent` / `childContent` are populated by
// `render()` (used by --dry-run) but absent after an actual write.
export interface WriteResult {
  modelName: string
  basePath: string
  childPath: string
  baseStatus: WriteStatus
  childStatus: WriteStatus
  baseContent?: string
  childContent?: string
  error?: string
}
