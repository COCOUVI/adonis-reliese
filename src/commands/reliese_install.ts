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
    const stub = path.join(stubsRoot, 'reliese_config.stub')

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
  }
}
