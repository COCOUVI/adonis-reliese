import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { TableSchema } from './types.js'

// Version of the cache file format. Bump when the serialized
// shape changes so stale files are ignored instead of misread.
export const SCHEMA_CACHE_VERSION = 1

// Location of the cache file, relative to the project root.
export const SCHEMA_CACHE_PATH = '.adonis/reliese-schema.json'

interface SchemaCacheFile {
  version: number
  connection: string
  connectionHash: string
  savedAt: string
  tables: Record<string, TableSchema>
}

// Hashes the connection name. Stored in the cache file so a
// connection change automatically invalidates the cache.
export function hashConnection(connection: string): string {
  return createHash('sha256').update(connection).digest('hex')
}

// Persists the inspected schema to `.adonis/reliese-schema.json`
// so subsequent runs can skip hitting the database.
export class SchemaCache {
  static path(cwd: string = process.cwd()): string {
    return path.join(cwd, SCHEMA_CACHE_PATH)
  }

  // Returns the cached schema when the file exists, is well-formed
  // and was saved for the same connection. Otherwise null.
  static async load(
    connection: string,
    cwd: string = process.cwd()
  ): Promise<Map<string, TableSchema> | null> {
    let raw: string
    try {
      raw = await readFile(this.path(cwd), 'utf-8')
    } catch {
      return null
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return null
    }

    if (!this.#isCacheFile(parsed)) {
      return null
    }

    if (parsed.connectionHash !== hashConnection(connection)) {
      return null
    }

    return new Map(Object.entries(parsed.tables))
  }

  // Serializes the full inspected schema for the next run.
  static async save(
    tables: Map<string, TableSchema>,
    connection: string,
    cwd: string = process.cwd()
  ): Promise<void> {
    const file: SchemaCacheFile = {
      version: SCHEMA_CACHE_VERSION,
      connection,
      connectionHash: hashConnection(connection),
      savedAt: new Date().toISOString(),
      tables: Object.fromEntries(tables),
    }

    const dest = this.path(cwd)
    await mkdir(path.dirname(dest), { recursive: true })
    await writeFile(dest, JSON.stringify(file, null, 2), 'utf-8')
  }

  // Narrow guard: rejects corrupt files, foreign JSON and outdated formats.
  static #isCacheFile(parsed: unknown): parsed is SchemaCacheFile {
    if (!parsed || typeof parsed !== 'object') {
      return false
    }

    const file = parsed as Partial<SchemaCacheFile>
    return (
      file.version === SCHEMA_CACHE_VERSION &&
      typeof file.connectionHash === 'string' &&
      !!file.tables &&
      typeof file.tables === 'object'
    )
  }
}
