import type { ReliesesConfig } from './types.js'

// Default values applied when the user config is partial. `connection`
// is intentionally omitted so the app's primary Lucid connection is used.
const defaults = {
  outputDir: 'app/models',
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
