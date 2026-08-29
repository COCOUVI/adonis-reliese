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
import RelieseModels from './src/commands/reliese_models.js'
import RelieseInstall from './src/commands/reliese_install.js'
import RelieseProvider from './providers/reliese_provider.js'
export { RelieseModels, RelieseInstall, RelieseProvider }
export const commands = [RelieseModels, RelieseInstall]
export const providers = [RelieseProvider]

export type { ReliesesConfig, NamingStrategy, RelationDef, RelationType } from './src/types.js'
