import type { MappedType } from './types.js'

// Static mapping from normalized SQL types to TypeScript types
// and their corresponding Lucid decorator. Includes common aliases
// so raw information_schema / PRAGMA type names resolve directly
// (e.g. PostgreSQL 'character varying', MySQL 'decimal', SQLite 'real').
export const TYPE_MAP: Record<string, MappedType> = {
  'varchar': { tsType: 'string', decorator: 'column' },
  'char': { tsType: 'string', decorator: 'column' },
  'character': { tsType: 'string', decorator: 'column' },
  'character varying': { tsType: 'string', decorator: 'column' },
  'text': { tsType: 'string', decorator: 'column' },
  'tinytext': { tsType: 'string', decorator: 'column' },
  'mediumtext': { tsType: 'string', decorator: 'column' },
  'longtext': { tsType: 'string', decorator: 'column' },
  'enum': { tsType: 'string', decorator: 'column' },
  'set': { tsType: 'string', decorator: 'column' },
  'int': { tsType: 'number', decorator: 'column' },
  'integer': { tsType: 'number', decorator: 'column' },
  'int2': { tsType: 'number', decorator: 'column' },
  'int4': { tsType: 'number', decorator: 'column' },
  'smallint': { tsType: 'number', decorator: 'column' },
  'mediumint': { tsType: 'number', decorator: 'column' },
  'serial': { tsType: 'number', decorator: 'column' },
  'smallserial': { tsType: 'number', decorator: 'column' },
  'float': { tsType: 'number', decorator: 'column' },
  'real': { tsType: 'number', decorator: 'column' },
  'double': { tsType: 'number', decorator: 'column' },
  'double precision': { tsType: 'number', decorator: 'column' },
  'year': { tsType: 'number', decorator: 'column' },
  // Lucid maps BIGINT to `bigint | number` (drivers may return either).
  'int8': { tsType: 'bigint | number', decorator: 'column' },
  'bigint': { tsType: 'bigint | number', decorator: 'column' },
  'bigserial': { tsType: 'bigint | number', decorator: 'column' },
  // Lucid maps DECIMAL to string: drivers return exact decimals as
  // strings and number would silently lose precision.
  'numeric': { tsType: 'string', decorator: 'column' },
  'decimal': { tsType: 'string', decorator: 'column' },
  'dec': { tsType: 'string', decorator: 'column' },
  'boolean': { tsType: 'boolean', decorator: 'column' },
  'bool': { tsType: 'boolean', decorator: 'column' },
  // MySQL has no native boolean: table.boolean() creates tinyint(1).
  // Following Lucid's own schema generator, tinyint always maps to boolean.
  'tinyint': { tsType: 'boolean', decorator: 'column' },
  'json': { tsType: 'any', decorator: 'column' },
  'jsonb': { tsType: 'any', decorator: 'column' },
  // Lucid maps TIME to string (no time-only DateTime support).
  'time': { tsType: 'string', decorator: 'column' },
  // Lucid maps binary columns to Buffer.
  'binary': { tsType: 'Buffer', decorator: 'column' },
  'varbinary': { tsType: 'Buffer', decorator: 'column' },
  'blob': { tsType: 'Buffer', decorator: 'column' },
  'tinyblob': { tsType: 'Buffer', decorator: 'column' },
  'mediumblob': { tsType: 'Buffer', decorator: 'column' },
  'longblob': { tsType: 'Buffer', decorator: 'column' },
  'bytea': { tsType: 'Buffer', decorator: 'column' },
  'timestamp': { tsType: 'DateTime', decorator: 'column.dateTime' },
  'timestamptz': { tsType: 'DateTime', decorator: 'column.dateTime' },
  'timestamp with time zone': { tsType: 'DateTime', decorator: 'column.dateTime' },
  'timestamp without time zone': { tsType: 'DateTime', decorator: 'column.dateTime' },
  'datetime': { tsType: 'DateTime', decorator: 'column.dateTime' },
  'date': { tsType: 'DateTime', decorator: 'column.date' },
  'uuid': { tsType: 'string', decorator: 'column' },
}
