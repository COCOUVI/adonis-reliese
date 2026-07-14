import type { NamingStrategy } from './types.js'

const RESERVED_TS_KEYWORDS = new Set([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'let',
  'new',
  'null',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
  'type',
  'declare',
  'as',
  'any',
  'unknown',
  'never',
  'object',
  'string',
  'number',
  'boolean',
  'symbol',
  'undefined',
])

function escapeReserved(word: string): string {
  return RESERVED_TS_KEYWORDS.has(word) ? `${word}_` : word
}

function snakeToPascal(s: string): string {
  return s
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function snakeToCamel(s: string): string {
  const parts = s.split('_').filter(Boolean)
  const camel = parts
    .map((part, i) => (i === 0 ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('')
  return escapeReserved(camel)
}

// Default naming strategy used when the user does not provide a custom one.
export class DefaultNamingStrategy implements NamingStrategy {
  modelName(table: string): string {
    return snakeToPascal(table)
  }

  propertyName(column: string): string {
    return snakeToCamel(column)
  }

  relationName(table: string, _type: string): string {
    // Singularize simple table names for belongsTo/hasOne,
    // pluralizing is handled by the RelationDetector later.
    return snakeToPascal(table)
  }
}
