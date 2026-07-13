import type { MappedType } from './types.js'

// Static mapping from normalized SQL types to TypeScript types
// and their corresponding Lucid decorator.
export const TYPE_MAP: Record<string, MappedType> = {
  varchar: { tsType: 'string', decorator: 'column' },
  char: { tsType: 'string', decorator: 'column' },
  text: { tsType: 'string', decorator: 'column' },
  int: { tsType: 'number', decorator: 'column' },
  int4: { tsType: 'number', decorator: 'column' },
  bigint: { tsType: 'number', decorator: 'column' },
  float: { tsType: 'number', decorator: 'column' },
  numeric: { tsType: 'number', decorator: 'column' },
  boolean: { tsType: 'boolean', decorator: 'column' },
  json: { tsType: 'object', decorator: 'column' },
  jsonb: { tsType: 'object', decorator: 'column' },
  timestamp: { tsType: 'DateTime', decorator: 'column.dateTime' },
  timestamptz: { tsType: 'DateTime', decorator: 'column.dateTime' },
  datetime: { tsType: 'DateTime', decorator: 'column.dateTime' },
  date: { tsType: 'DateTime', decorator: 'column.date' },
  uuid: { tsType: 'string', decorator: 'column' },
}
