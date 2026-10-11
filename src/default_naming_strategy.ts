import type { NamingStrategy } from './types.js'

// Nouns with identical singular and plural forms.
const UNCOUNTABLE = new Set([
  'news',
  'series',
  'species',
  'sheep',
  'fish',
  'deer',
  'equipment',
  'information',
])

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

// Small pluralizer, sufficient for common table names.
function pluralizePascal(pascal: string): string {
  if (pascal.length === 0) return pascal
  const lower = pascal.toLowerCase()
  // Uncountable nouns are invariant (news → news, never "new").
  if (UNCOUNTABLE.has(lower)) return pascal
  // Already plural (e.g. "Posts" coming from a "posts" table): leave as-is.
  if (lower.endsWith('s')) return pascal
  if (lower.endsWith('x') || lower.endsWith('z')) return `${pascal}es`
  if (lower.endsWith('ch') || lower.endsWith('sh')) return `${pascal}es`
  if (lower.endsWith('y') && !'aeiou'.includes(lower[lower.length - 2])) {
    return `${pascal.slice(0, -1)}ies`
  }
  return `${pascal}s`
}

// Inverse of pluralizePascal, sufficient for common table names.
function singularizePascal(pascal: string): string {
  if (pascal.length === 0) return pascal
  const lower = pascal.toLowerCase()
  if (UNCOUNTABLE.has(lower)) return pascal
  if (lower.endsWith('ies')) return `${pascal.slice(0, -3)}y`
  if (
    lower.endsWith('ses') ||
    lower.endsWith('xes') ||
    lower.endsWith('zes') ||
    lower.endsWith('ches') ||
    lower.endsWith('shes')
  ) {
    return pascal.slice(0, -2)
  }
  if (lower.endsWith('s') && !lower.endsWith('ss')) return pascal.slice(0, -1)
  return pascal
}

function snakeToCamel(s: string): string {
  const parts = s.split('_').filter(Boolean)
  const camel = parts
    .map((part, i) => (i === 0 ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('')
  return escapeReserved(camel)
}

// Default naming strategy used when the user does not provide one.
export class DefaultNamingStrategy implements NamingStrategy {
  modelName(table: string): string {
    return singularizePascal(snakeToPascal(table))
  }

  propertyName(column: string): string {
    return snakeToCamel(column)
  }

  relationName(table: string, type: string): string {
    const pascal = snakeToPascal(table)
    if (type === 'hasMany' || type === 'manyToMany') {
      return pluralizePascal(pascal)
    }
    return singularizePascal(pascal)
  }

  fileName(table: string): string {
    const singular = singularizePascal(snakeToPascal(table.toLowerCase()))
    return singular.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
  }
}
