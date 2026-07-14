import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { NamingStrategy, TypeMapperOutput, WriteResult } from './types.js'
import { DefaultNamingStrategy } from './default_naming_strategy.js'

export interface ModelWriterConfig {
  outputDir: string
}

// Generates Lucid model files from mapped column definitions.
export class ModelWriter {
  #config: ModelWriterConfig
  #strategy: NamingStrategy

  constructor(config: ModelWriterConfig, strategy?: NamingStrategy) {
    this.#config = config
    this.#strategy = strategy ?? new DefaultNamingStrategy()
  }

  async write(
    table: string,
    mapped: TypeMapperOutput,
    options?: { force?: boolean }
  ): Promise<WriteResult> {
    const modelName = this.#strategy.modelName(table)
    const filePath = path.join(process.cwd(), this.#config.outputDir, `${modelName}.ts`)

    // Check if file already exists.
    if (existsSync(filePath) && !options?.force) {
      return { status: 'skipped', modelName, filePath }
    }

    const content = this.#buildContent(modelName, mapped)

    try {
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, content, 'utf-8')
      return { status: 'created', modelName, filePath }
    } catch (error) {
      return {
        status: 'error',
        modelName,
        filePath,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  #buildContent(modelName: string, mapped: TypeMapperOutput): string {
    const blocks: string[] = []

    // Block 1 — imports
    blocks.push(this.#importsBlock(mapped))

    // Block 2 — empty line + class declaration
    blocks.push(this.#classBlock(modelName, mapped))

    return blocks.join('\n\n') + '\n'
  }

  #importsBlock(mapped: TypeMapperOutput): string {
    const imports: string[] = ["import { BaseModel, column } from '@adonisjs/lucid/orm'"]

    if (mapped.needsDateTimeImport) {
      imports.push("import { DateTime } from 'luxon'")
    }

    return imports.join('\n')
  }

  #classBlock(modelName: string, mapped: TypeMapperOutput): string {
    const lines: string[] = [`export default class ${modelName} extends BaseModel {`]

    for (const [i, col] of mapped.columns.entries()) {
      const propName = this.#strategy.propertyName(col.name)
      lines.push(`  @${col.decorator}`)
      lines.push(`  declare ${propName}: ${col.tsType}`)

      if (i < mapped.columns.length - 1) {
        lines.push('')
      }
    }

    lines.push('}')

    return lines.join('\n')
  }
}
