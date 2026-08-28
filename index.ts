/*
|--------------------------------------------------------------------------
| Package entrypoint
|--------------------------------------------------------------------------
|
| Export values from the package entrypoint as you see fit.
|
*/

export { configure } from './configure.ts'
export { stubsRoot } from './stubs/main.ts'
export { defineConfig } from './src/define_config.js'
export { RelationDetector } from './src/relation_detector.js'
export type { ReliesesConfig, NamingStrategy, RelationDef, RelationType } from './src/types.js'
