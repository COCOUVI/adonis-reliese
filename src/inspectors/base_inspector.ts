import type { Knex } from 'knex'
import { resolveKnex } from './resolve_knex.js'

// Shared foundation for all schema inspectors: lazy Lucid client
// resolution (importable without a booted Adonis app) plus a tolerant
// raw-result reader that accepts every knex driver shape.
export abstract class BaseInspector {
  #connectionName: string
  #knex: Knex | undefined

  constructor(connectionName: string = 'default', knex?: Knex) {
    this.#connectionName = connectionName
    this.#knex = knex
  }

  // Returns the injected client, or resolves it from the Lucid connection.
  protected async client(): Promise<Knex> {
    if (!this.#knex) {
      this.#knex = await resolveKnex(this.#connectionName)
    }
    return this.#knex
  }

  // Normalizes knex.raw() results across drivers:
  //   - sqlite3 / better-sqlite3 → row array directly
  //   - pg → { rows }
  //   - mysql → [rows, fields]
  protected extractRows<T>(result: unknown): T[] {
    if (Array.isArray(result)) {
      if (result.length > 0 && Array.isArray(result[0])) return result[0] as T[]
      return result as T[]
    }
    if (result && typeof result === 'object' && Array.isArray((result as { rows: unknown }).rows)) {
      return (result as { rows: T[] }).rows
    }
    return []
  }
}
