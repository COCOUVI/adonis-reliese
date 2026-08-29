import type { ReliesesConfig } from './types.js'

// Default values applied when user config is partial.
const defaults: ReliesesConfig = {
  outputDir: 'app/models',
  connection: 'default',
  tableFilter: {
    include: [],
    exclude: ['adonis_schema', 'adonis_schema_versions'],
  },
  withTimestamps: true,
  withSoftDelete: false,
  withBaseFiles: false,
}

// Merge defaults with user config while preserving tableFilter sub-keys.
export function defineConfig(cfg: Partial<ReliesesConfig>): ReliesesConfig {
  return {
    ...defaults,
    ...cfg,
    tableFilter: { ...defaults.tableFilter, ...cfg.tableFilter },
  }
}
