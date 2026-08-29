import { ListLoader } from '@adonisjs/core/ace'
import RelieseModels from './reliese_models.js'
import RelieseInstall from './reliese_install.js'

/**
 * Entry point for the `adonis-reliese/commands` subpath. AdonisJS looks for
 * the `getMetaData` / `getCommand` functions here to load commands without
 * having to scan a directory (precomputed manifest).
 */
const loader = new ListLoader([RelieseModels, RelieseInstall])

export function getMetaData() {
  return loader.getMetaData()
}

export function getCommand(metaData: Parameters<typeof loader.getCommand>[0]) {
  return loader.getCommand(metaData)
}
