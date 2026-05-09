// Strategy interface for customizing model/property/relation names.
export interface INamingStrategy {
  modelName(table: string): string
  propertyName(column: string): string
  relationName(table: string, type: string): string
}

// Full config shape expected by the package.
export interface ReliesesConfig {
  outputDir: string
  connection: string
  tableFilter: {
    include: string[]
    exclude: string[]
  }
  withTimestamps: boolean
  withSoftDelete: boolean
  namingStrategy?: INamingStrategy
}
