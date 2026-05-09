import type { ReliesesConfig } from './types.js'

// Loads config/reliese.ts from the project root.
export class ConfigLoader {
  static async load(): Promise<ReliesesConfig> {
    const configPath = `${process.cwd()}/config/reliese.ts`

    try {
      const configModule = await import(configPath)
      return configModule.default as ReliesesConfig
    } catch (error) {
      if (this.#isModuleNotFound(error, configPath)) {
        throw new Error("Run 'node ace reliese:install' first")
      }

      throw error
    }
  }

  // Narrowly detect missing config file without hiding other errors.
  static #isModuleNotFound(error: unknown, configPath: string): boolean {
    if (!error || typeof error !== 'object') {
      return false
    }

    const code = (error as { code?: string }).code
    const message = (error as { message?: string }).message

    return code === 'ERR_MODULE_NOT_FOUND' && typeof message === 'string' && message.includes(configPath)
  }
}
