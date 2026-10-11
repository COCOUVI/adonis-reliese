import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import fs from 'node:fs/promises'
import path from 'node:path'
import { stubsRoot } from '../../stubs/main.js'

/**
 * Generates config/reliese.ts in the user project from an embedded stub.
 */
export default class RelieseInstall extends BaseCommand {
  static commandName = 'reliese:install'
  static description = 'Create the config/reliese.ts file in the project'

  static options: CommandOptions = {
    startApp: false,
  }

  @flags.boolean({ description: 'Overwrite without asking for confirmation' })
  declare force: boolean | undefined

  async run() {
    const dest = path.join(process.cwd(), 'config', 'reliese.ts')
    const stub = await this.#resolveStub()

    let exists = false
    try {
      await fs.access(dest)
      exists = true
    } catch {
      exists = false
    }

    if (exists && !this.force) {
      const overwrite = await this.prompt.confirm('Overwrite existing config/reliese.ts?')
      if (!overwrite) {
        this.logger.info('Installation cancelled.')
        return
      }
    }

    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.copyFile(stub, dest)
    this.logger.success('✓ config/reliese.ts created')
    this.logger.info('Next: run "node ace reliese:models" to generate your models')
  }

  /**
   * Resolves the stub path both in development (stubsRoot = "<pkg>/stubs")
   * and in the built package, where tsdown bundles this command into
   * "build/reliese_install-*.js" (stubsRoot = "<pkg>/build") while the
   * stub is copied to "build/stubs/reliese_config.stub".
   */
  async #resolveStub(): Promise<string> {
    const candidates = [
      path.join(stubsRoot, 'reliese_config.stub'),
      path.join(stubsRoot, 'stubs', 'reliese_config.stub'),
    ]
    for (const candidate of candidates) {
      try {
        await fs.access(candidate)
        return candidate
      } catch {
        // try next candidate
      }
    }
    throw new Error(`Could not locate reliese_config.stub. Tried: ${candidates.join(', ')}`)
  }
}
