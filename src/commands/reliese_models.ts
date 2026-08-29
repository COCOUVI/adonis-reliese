import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { ConfigLoader } from '../config_loader.js'
import { createInspector } from '../inspectors/index.js'
import { RelationDetector } from '../relation_detector.js'
import { TypeMapper } from '../type_mapper.js'
import { ModelWriter } from '../model_writer.js'
import { DefaultNamingStrategy } from '../default_naming_strategy.js'
import type { ColumnDef, ReliesesConfig, TableSchema } from '../types.js'

/**
 * Main command: orchestrates the full pipeline
 * config → inspect → detect → map → write to generate Lucid models.
 */
export default class RelieseModels extends BaseCommand {
  static commandName = 'reliese:models'
  static description = 'Generate Lucid models from the database schema'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({ description: 'Process a single table only' })
  declare table: string | undefined

  @flags.string({ description: 'Override the Lucid connection to use' })
  declare connection: string | undefined

  @flags.boolean({ description: 'Print the generated content without writing files' })
  declare dryRun: boolean | undefined

  // Applies the config tableFilter (include/exclude, with '*' prefix wildcard).
  #filterTables(tables: string[], config: ReliesesConfig): string[] {
    const filter = config.tableFilter ?? {}
    const include = filter.include ?? []
    const exclude = filter.exclude ?? []

    return tables.filter((table) => {
      const included = include.length === 0 || include.some((p) => this.#match(p, table))
      const excluded = exclude.some((p) => this.#match(p, table))
      return included && !excluded
    })
  }

  #match(pattern: string, table: string): boolean {
    if (pattern === '*') return true
    if (pattern.endsWith('*')) return table.startsWith(pattern.slice(0, -1))
    return pattern === table
  }

  async run() {
    const config = await ConfigLoader.load()
    const connection = this.connection ?? config.connection ?? 'default'
    const naming = config.namingStrategy ?? new DefaultNamingStrategy()
    const inspector = createInspector(connection)

    let tables = await inspector.getTables()
    tables = this.#filterTables(tables, config)

    if (this.table) {
      const target = tables.find((t) => t === this.table)
      if (!target) {
        this.logger.error(`Table "${this.table}" not found or excluded by the config`)
        return
      }
      tables = [target]
    }

    // Preliminary inspection: columns + foreign keys for each table.
    const columnsByTable = new Map<string, ColumnDef[]>()
    const tablesData = new Map<string, TableSchema>()
    for (const table of tables) {
      const [columns, foreignKeys] = await Promise.all([
        inspector.getColumns(table),
        inspector.getForeignKeys(table),
      ])
      columnsByTable.set(table, columns)
      tablesData.set(table, { columns, foreignKeys })
    }

    const detector = new RelationDetector(naming)
    const writer = new ModelWriter(
      { outputDir: config.outputDir, withBaseFiles: config.withBaseFiles ?? false },
      naming
    )
    const mapper = new TypeMapper({
      withTimestamps: config.withTimestamps ?? true,
      withSoftDelete: config.withSoftDelete ?? false,
    })

    const stats = { created: 0, skipped: 0, errors: 0 }
    const errorDetails: string[] = []

    const relationsByTable = detector.detect(tablesData)

    for (const table of tables) {
      try {
        const mapped = mapper.map(columnsByTable.get(table)!)
        const relations = relationsByTable.get(table) ?? []

        if (this.dryRun) {
          const rendered = writer.render(table, mapped, relations)
          if (rendered.baseContent) {
            this.logger.info(`--- [DRY RUN] ${rendered.basePath} ---`)
            this.logger.info(rendered.baseContent)
          }
          if (rendered.childContent) {
            this.logger.info(`--- [DRY RUN] ${rendered.childPath} ---`)
            this.logger.info(rendered.childContent)
          }
          stats.skipped++
          continue
        }

        const result = await writer.write(table, mapped, relations)
        if (result.baseStatus === 'error') {
          throw new Error(result.error ?? 'Failed to write the base file')
        }
        if (result.baseStatus === 'created') stats.created++
        if (result.childStatus === 'created') stats.created++
        else if (result.childStatus === 'skipped') stats.skipped++
      } catch (error) {
        stats.errors++
        errorDetails.push(`${table} : ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    this.logger.info(
      `Done — ${stats.created} created, ${stats.skipped} skipped, ${stats.errors} error(s)`
    )
    errorDetails.forEach((detail) => this.logger.error(detail))
  }
}
