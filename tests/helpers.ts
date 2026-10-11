import { mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Knex } from 'knex'

// Shared test helpers: a minimal knex stub routing raw SQL to a
// responder (recording every statement), and an isolated tmp dir.
export function fakeKnex(
  responder: (sql: string, bindings: unknown[]) => unknown,
  seen: string[] = []
): Knex {
  return {
    raw: (sql: string, bindings: unknown[]) => {
      seen.push(sql)
      return Promise.resolve(responder(sql, bindings))
    },
  } as unknown as Knex
}

export function tmpDir(prefix: string): string {
  const dir = path.join(os.tmpdir(), `${prefix}-` + Math.random().toString(36).slice(2))
  mkdirSync(dir, { recursive: true })
  return dir
}
