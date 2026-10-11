# adonis-reliese

Generate AdonisJS Lucid models from your existing database schema — columns, types, timestamps and relations, all inferred automatically.

## Requirements

- AdonisJS v7 with `@adonisjs/lucid` installed
- Node.js >= 24
- A **MySQL / MariaDB** or **SQLite** (`better-sqlite3`, `sqlite3`, `libsql`) database. PostgreSQL support is planned for v2.

## Installation

Install the package, then run the setup command **once**:

```sh
npm i adonis-reliese
node ace configure adonis-reliese
```

The setup command registers the commands and the provider in your app. Then create the config file:

```sh
node ace reliese:install
```

That's it — you can now run `node ace reliese:models`.

### Regenerating the config file

If you ever delete `config/reliese.ts` (or want a fresh copy), you don't need to redo the whole setup. This command recreates **only** the config file:

```sh
node ace reliese:install
```

If the file already exists, you'll be asked for confirmation — or pass `--force` to overwrite it without asking:

```sh
node ace reliese:install --force
```

## Configuration

```ts
import { defineConfig } from 'adonis-reliese'

export default defineConfig({
  outputDir: 'app/models',
  // connection: 'mysql', // defaults to the app's primary Lucid connection
  tableFilter: {
    include: [], // empty = all tables; supports 'prefix*' wildcards
    exclude: ['adonis_schema', 'adonis_schema_versions'],
  },
  withTimestamps: true, // created_at/updated_at → @column.dateTime with autoCreate/autoUpdate
  withSoftDelete: false, // deleted_at → @column.dateTime() (see note below)
  withBaseFiles: false, // true = base/ file regenerated + child file created once (Reliese style)
})
```

Which connection is inspected, in priority order:

1. `--connection=secondary` flag passed to `reliese:models`
2. `connection` in `config/reliese.ts`
3. the app's primary connection from `config/database.ts` (zero-config default)

> **Soft deletes:** Lucid v7 ships no `SoftDeletes` mixin, so `withSoftDelete` only maps the `deleted_at` column to `@column.dateTime()`. Add your own scopes or a custom base model for the filtering behavior.

## Usage

```sh
node ace reliese:models
```

One model file per table is written to `outputDir`, using the AdonisJS convention (`users` → `app/models/user.ts`, class `User`). **Existing files are overwritten**, except the child file in `withBaseFiles` mode, which is created once and never regenerated.

| Flag | Effect |
|------|--------|
| `--table=users` | Generate a single table only (reads the cache, never rewrites it) |
| `--connection=secondary` | Override the Lucid connection from the config |
| `--dry-run` | Print the generated models without writing files |
| `--no-cache` | Ignore the schema cache and re-inspect the database |

## Example

From a `users` table with `posts.user_id → users.id`, you get:

```ts
// app/models/user.ts
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import Post from '#models/post'

export default class User extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => Post)
  declare posts: HasMany<typeof Post>
}
```

Relations are inferred from foreign keys: outgoing FK → `belongsTo`, incoming FKs → `hasMany` (`hasOne` when the FK column is unique), and a table with exactly two FKs and no extra columns → `manyToMany` on both sides via `pivotTable`. Relation targets outside the inspected tables are typed `any` with an explanatory comment.

## Schema cache

After a successful full inspection, the schema is saved to `.adonis/reliese-schema.json` and reused on the next runs without touching the database. The cache is invalidated automatically when the connection changes. Schema changes require one `node ace reliese:models --no-cache` run to refresh it.

## Custom naming

```ts
import { defineConfig } from 'adonis-reliese'
import type { NamingStrategy } from 'adonis-reliese'

class MyStrategy implements NamingStrategy {
  modelName(table: string): string { /* users → User */ }
  propertyName(column: string): string { /* user_id → userId */ }
  relationName(table: string, type: string): string { /* ... */ }
  fileName(table: string): string { /* users → user */ }
}

export default defineConfig({ namingStrategy: new MyStrategy() })
```

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Run 'node ace reliese:install' first` | `config/reliese.ts` is missing — run the install command |
| `Cannot connect to unregistered connection X` | No Lucid connection named `X` — omit `connection` to use the app's default, or pass a valid `--connection` |
| `Unsupported dialect: X` | Only MySQL/MariaDB and SQLite are supported (PostgreSQL planned for v2) |
| Stale models after a migration | Run once with `--no-cache` to refresh `.adonis/reliese-schema.json` |
| `unknown` type with a TODO comment | The SQL type has no mapping yet — adjust the type or open an issue |

## Development

```sh
npm run quick:test   # tests only
npm test             # lint + tests + coverage
npm run typecheck
npm run build
```

Live SQLite tests run via `better-sqlite3` (dev dependency). MySQL is covered by unit tests — verify against a live server when changing inspectors:

```sh
docker run -d -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=reliese_test -p 3306:3306 mysql:8
```

MIT License.
