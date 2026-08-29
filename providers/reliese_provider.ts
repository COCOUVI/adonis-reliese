import type { ApplicationService } from '@adonisjs/core/types'

/**
 * Provider for the adonis-reliese package. Commands are discovered
 * automatically via the `adonis-reliese/commands` subpath added to
 * `commands` in the application's adonisrc.ts (see configure.ts).
 */
export default class RelieseProvider {
  constructor(protected app: ApplicationService) {}

  static needsApplication = true

  register() {}

  async boot() {}
}
