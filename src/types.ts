// ── Naming ──────────────────────────────────────────────

export interface NamingStrategy {
  modelName(table: string): string
  propertyName(column: string): string
  relationName(table: string, type: string): string
}

// ── Config ──────────────────────────────────────────────

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

// ── Schema ──────────────────────────────────────────────

export interface ColumnDef {
  name: string
  sqlType: string
  tsType: string
  isNullable: boolean
  isPrimary: boolean
  hasDefault: boolean
}

export interface ForeignKeyDef {
  column: string
  foreignTable: string
  foreignColumn: string
}

export interface SchemaInspector {
  getTables(): Promise<string[]>
  getColumns(table: string): Promise<ColumnDef[]>
  getForeignKeys(table: string): Promise<ForeignKeyDef[]>
}
