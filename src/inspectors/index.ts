import db from '@adonisjs/lucid/services/db'
import type { SchemaInspector } from '../types.js'
import { PgInspector } from './pg_inspector.js'
import { MysqlInspector } from './mysql_inspector.js'

export function createInspector(connectionName: string = 'default'): SchemaInspector {
  const client = db.connection(connectionName)
  const dialect = client.dialect.name

  switch (dialect) {
    case 'postgres':
      return new PgInspector(connectionName)
    case 'mysql':
      return new MysqlInspector(connectionName)
    default:
      throw new Error(`Unsupported dialect: ${dialect}`)
  }
}
