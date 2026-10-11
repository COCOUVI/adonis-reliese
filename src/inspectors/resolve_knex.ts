import type { Knex } from 'knex'

// Resolves the knex client from the Lucid connection. Imported lazily so
// that inspector modules can be loaded (and unit-tested with an injected
// client) without a booted Adonis app.
export async function resolveKnex(connectionName?: string): Promise<Knex> {
  const { default: db } = await import('@adonisjs/lucid/services/db')
  return db.connection(connectionName).getWriteClient()
}
