import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  NamingStrategy,
  RelationDef,
  RelationType,
  TypeMapperOutput,
  WriteResult,
  WriteStatus,
} from './types.js'
import { DefaultNamingStrategy } from './default_naming_strategy.js'

export interface ModelWriterConfig {
  outputDir: string
  // Enables the Laravel Reliese `base_files` parity mode.
  withBaseFiles?: boolean
}

// Maps a relation type to its Lucid decorator and its relation type name.
const RELATION_META: Record<RelationType, { decorator: string; type: string }> = {
  belongsTo: { decorator: 'belongsTo', type: 'BelongsTo' },
  hasMany: { decorator: 'hasMany', type: 'HasMany' },
  hasOne: { decorator: 'hasOne', type: 'HasOne' },
  manyToMany: { decorator: 'manyToMany', type: 'ManyToMany' },
}

// Generates Lucid model files from mapped column definitions and relations.
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
    relations: RelationDef[] = []
  ): Promise<WriteResult> {
    const modelName = this.#strategy.modelName(table)
    const fileName = modelName

    const childPath = path.join(process.cwd(), this.#config.outputDir, `${fileName}.ts`)
    const basePath = this.#config.withBaseFiles
      ? path.join(process.cwd(), this.#config.outputDir, 'base', `${fileName}.ts`)
      : childPath

    const baseClassName = this.#config.withBaseFiles ? `${modelName}Base` : modelName
    const baseContent = this.#buildContent(baseClassName, mapped, relations)

    // Default mode: a single file, always overwritten (Reliese parity).
    if (!this.#config.withBaseFiles) {
      const written = await this.#writeOne(childPath, baseContent)
      return {
        modelName,
        basePath,
        childPath,
        baseStatus: written.status,
        childStatus: 'skipped',
        error: written.error,
      }
    }

    // base_files mode: base is always regenerated, child is created once.
    const baseWrite = await this.#writeOne(basePath, baseContent)
    if (baseWrite.status === 'error') {
      return {
        modelName,
        basePath,
        childPath,
        baseStatus: 'error',
        childStatus: 'skipped',
        error: baseWrite.error,
      }
    }

    let childStatus: WriteStatus = 'skipped'
    if (!existsSync(childPath)) {
      const childContent = this.#childTemplate(modelName, fileName)
      const childWrite = await this.#writeOne(childPath, childContent)
      childStatus = childWrite.status
    }

    return { modelName, basePath, childPath, baseStatus: 'created', childStatus }
  }

  #childTemplate(modelName: string, fileName: string): string {
    return [
      `import ${modelName}Base from './base/${fileName}.js'`,
      '',
      `export default class ${modelName} extends ${modelName}Base {`,
      '  // Ajoutez ici vos relations et méthodes personnalisées.',
      "  // Ce fichier n'est jamais régénéré automatiquement.",
      '}',
      '',
    ].join('\n')
  }

  async #writeOne(
    filePath: string,
    content: string
  ): Promise<{ status: WriteStatus; error?: string }> {
    try {
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, content, 'utf-8')
      return { status: 'created' }
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  #buildContent(className: string, mapped: TypeMapperOutput, relations: RelationDef[]): string {
    const blocks: string[] = []

    // Block 1 — imports
    blocks.push(this.#importsBlock(mapped, relations))

    // Block 2 — empty line + class declaration (columns + relations)
    blocks.push(this.#classBlock(className, mapped, relations))

    return blocks.join('\n\n') + '\n'
  }

  #importsBlock(mapped: TypeMapperOutput, relations: RelationDef[]): string {
    const lucidImports = new Set(['BaseModel', 'column'])
    const relationTypeImports = new Set<string>()
    const modelImports = new Map<string, string>()

    for (const rel of relations) {
      const meta = RELATION_META[rel.type]
      lucidImports.add(meta.decorator)
      relationTypeImports.add(meta.type)
      if (!rel.isRemoteMissing) {
        modelImports.set(
          rel.targetModel,
          `import ${rel.targetModel} from '#models/${rel.targetModel}'`
        )
      }
    }

    const lines = [`import { ${[...lucidImports].join(', ')} } from '@adonisjs/lucid/orm'`]
    if (relationTypeImports.size > 0) {
      lines.push(
        `import type { ${[...relationTypeImports].sort().join(', ')} } from '@adonisjs/lucid/types/relations'`
      )
    }
    if (mapped.needsDateTimeImport) {
      lines.push("import { DateTime } from 'luxon'")
    }
    for (const line of modelImports.values()) {
      lines.push(line)
    }

    return lines.join('\n')
  }

  #classBlock(className: string, mapped: TypeMapperOutput, relations: RelationDef[]): string {
    const lines: string[] = [`export default class ${className} extends BaseModel {`]

    for (const [i, col] of mapped.columns.entries()) {
      const propName = this.#strategy.propertyName(col.name)
      lines.push(`  @${col.decorator}`)
      lines.push(`  declare ${propName}: ${col.tsType}`)

      if (i < mapped.columns.length - 1) {
        lines.push('')
      }
    }

    if (relations.length > 0) {
      lines.push('')
      lines.push(...this.#relationsBlock(relations).split('\n'))
    }

    lines.push('}')

    return lines.join('\n')
  }

  #relationsBlock(relations: RelationDef[]): string {
    const lines: string[] = []

    for (const [i, rel] of relations.entries()) {
      const meta = RELATION_META[rel.type]

      if (rel.isRemoteMissing) {
        // Foreign table was not part of the inspected set: emit a relation
        // typed as `any` and document the missing target.
        lines.push(`  // Table distante non inspectée: ${rel.targetTable}`)
        lines.push(`  @${meta.decorator}()`)
        lines.push(`  declare ${rel.propertyName}: ${meta.type}<any>`)
      } else {
        const args = rel.pivotTable ? `, { pivotTable: '${rel.pivotTable}' }` : ''
        lines.push(`  @${meta.decorator}(() => ${rel.targetModel}${args})`)
        lines.push(`  declare ${rel.propertyName}: ${meta.type}<typeof ${rel.targetModel}>`)
      }

      if (i < relations.length - 1) {
        lines.push('')
      }
    }

    return lines.join('\n')
  }
}
