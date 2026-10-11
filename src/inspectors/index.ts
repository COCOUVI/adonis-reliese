import db from '@adonisjs/lucid/services/db'
import type { SchemaInspector } from '../types.js'
import { PgInspector } from './pg_inspector.js'
import { MysqlInspector } from './mysql_inspector.js'
import { SqliteInspector } from './sqlite_inspector.js'

// Factory: detects the dialect from the Lucid connection and
// instantiates the matching inspector (PostgreSQL, MySQL or SQLite).
export function createInspector(connectionName?: string): SchemaInspector {
  const resolved = resolveConnectionName(connectionName)
  const client = db.connection(resolved)
  const dialect = client.dialect.name

  switch (dialect) {
    case 'postgres':
      return new PgInspector(resolved)
    case 'mysql':
      return new MysqlInspector(resolved)
    case 'sqlite3':
    case 'better-sqlite3':
    case 'libsql':
      return new SqliteInspector(resolved)
    default:
      throw new Error(`Unsupported dialect: ${dialect}`)
  }
}

// Resolves the Lucid connection to inspect: an explicit name wins,
// otherwise (omitted or legacy 'default') the app's primary connection
// from config/database.ts is used. Always returns a real connection name
// so 'default' never leaks into db.connection().
export function resolveConnectionName(rawName?: string): string {
  if (rawName && rawName !== 'default') {
    return rawName
  }
  return db.primaryConnectionName
}
