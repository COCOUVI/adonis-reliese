# adonis-reliese — Guide d'implémentation

> Ordre de développement, dépendances & détail technique

---

## Vue d'ensemble des dépendances

| # | Feature | Dépend de | Priorité |
|---|---------|-----------|----------|
| 1 | ConfigLoader | — | Haute |
| 2 | SchemaInspector — PostgreSQL | 1 | Haute |
| 3 | SchemaInspector — MySQL | 1 | Haute |
| 4 | TypeMapper | 2 ou 3 | Haute |
| 5 | ModelWriter (colonnes, sans relations) | 4 | Haute |
| 6 | RelationDetector | 2 ou 3 | Haute |
| 7 | ModelWriter (avec relations) | 5 + 6 | Haute |
| 8 | Commande `reliese:models` | 5 + 6 + 7 | Haute |
| 9 | Commande `reliese:install` | 1 | Haute |
| 10 | NamingStrategy personnalisée | 1 | Moyenne |
| 11 | SchemaInspector — SQLite | 1 | Moyenne |
| 12 | Cache schéma | 2 ou 3 | Basse |

---

## Feature 1 — ConfigLoader

**Sprint 1 | Statut : À faire | Dépend de : Aucune**

### Objectif

Lire et valider `config/reliese.ts`. Aucune dépendance — c'est le point de départ de tout le package.

### Étapes d'implémentation

| Étape | Détail |
|-------|--------|
| 1. Interface config | Créer `src/types.ts` avec `ReliesesConfig` : `{ outputDir: string, connection: string, tableFilter: { include: string[], exclude: string[] }, withTimestamps: boolean, withSoftDelete: boolean, namingStrategy?: INamingStrategy }`. |
| 2. defineConfig() | Exporter `defineConfig(cfg: Partial<ReliesesConfig>): ReliesesConfig`. Fusionne avec les defaults. Retourne `cfg` tel quel — pattern AdonisJS standard. |
| 3. Defaults | `outputDir='app/models'`, `tableFilter.exclude=['adonis_schema','adonis_schema_versions']`, `withTimestamps=true`, `withSoftDelete=false`. |
| 4. ConfigLoader.load() | `import()` dynamique de `config/reliese.ts` via `process.cwd()`. Lancer une erreur claire si le fichier est absent : `"Run 'node ace reliese:install' first"`. |

### Code clé

```typescript
// src/define_config.ts
const defaults: ReliesesConfig = {
  outputDir: 'app/models',
  connection: 'default',
  tableFilter: { include: [], exclude: ['adonis_schema', 'adonis_schema_versions'] },
  withTimestamps: true,
  withSoftDelete: false,
}

export function defineConfig(cfg: Partial<ReliesesConfig>): ReliesesConfig {
  return {
    ...defaults,
    ...cfg,
    tableFilter: { ...defaults.tableFilter, ...cfg.tableFilter },
  }
}
```

---

## Feature 2 — SchemaInspector (PostgreSQL)

**Sprint 2 | Statut : À faire | Dépend de : Feature 1**

### Objectif

Extraire colonnes, types, nullabilité, PK et FK depuis PostgreSQL via `information_schema`. Définir l'interface `ISchemaInspector` commune.

### Étapes d'implémentation

| Étape | Détail |
|-------|--------|
| 1. Interface commune | `src/types.ts` — `ISchemaInspector` : `{ getTables(): Promise<string[]>, getColumns(t: string): Promise<ColumnDef[]>, getForeignKeys(t: string): Promise<ForeignKeyDef[]> }`. |
| 2. Types ColumnDef / ForeignKeyDef | `ColumnDef` : `{ name, sqlType, tsType, isNullable, isPrimary, hasDefault }`. `ForeignKeyDef` : `{ column, foreignTable, foreignColumn }`. |
| 3. Accès DB brut | Récupérer le knex client via `db.connection(cfg.connection).getWriteClient()`. Ne pas utiliser Lucid QueryBuilder — `information_schema` nécessite du SQL brut. |
| 4. getTables() | `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`. Appliquer `tableFilter` après. |
| 5. getColumns() | `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name=$1 AND table_schema='public'`. Pour la PK : sous-requête sur `table_constraints + key_column_usage` filtré sur `'PRIMARY KEY'`. |
| 6. getForeignKeys() | Jointure `table_constraints + key_column_usage + constraint_column_usage` WHERE `constraint_type='FOREIGN KEY' AND table_name=$1`. |
| 7. Factory | `src/inspectors/index.ts` — lire le driver (`pg` \| `mysql2` \| `sqlite3`) depuis la config knex et instancier la bonne classe. `PgInspector` pour ce sprint. |

### Requête getForeignKeys (PostgreSQL)

```sql
SELECT kcu.column_name,
       ccu.table_name  AS foreign_table,
       ccu.column_name AS foreign_column
FROM   information_schema.table_constraints       tc
JOIN   information_schema.key_column_usage        kcu USING (constraint_name, table_schema)
JOIN   information_schema.constraint_column_usage ccu USING (constraint_name)
WHERE  tc.constraint_type = 'FOREIGN KEY'
  AND  tc.table_name      = $1
  AND  tc.table_schema    = 'public';
```

---

## Feature 3 — SchemaInspector (MySQL / MariaDB)

**Sprint 3 | Statut : À faire | Dépend de : Feature 1 (parallèle à Feature 2)**

### Objectif

Implémenter `ISchemaInspector` pour MySQL. Peut se développer en parallèle de la Feature 2 car l'interface est définie dans la Feature 1.

### Étapes d'implémentation

| Étape | Détail |
|-------|--------|
| 1. getTables() MySQL | `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`. |
| 2. getColumns() MySQL | `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?`. `COLUMN_KEY='PRI'` identifie la clé primaire. |
| 3. getForeignKeys() MySQL | `SELECT COLUMN_NAME, REFERENCED_TABLE_NAME AS foreign_table, REFERENCED_COLUMN_NAME AS foreign_column FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND REFERENCED_TABLE_NAME IS NOT NULL`. |
| 4. Normalisation types | MySQL retourne `'int'`, `'tinyint'`, `'varchar'`, `'datetime'`. `tinyint(1)` → normaliser en `'boolean'`. Retirer la précision : `varchar(255)` → `varchar`. Tous les `ColumnDef` doivent avoir le même format qu'en PostgreSQL pour le TypeMapper. |
| 5. Enregistrer dans la factory | Dans `src/inspectors/index.ts`, ajouter le cas `'mysql'` / `'mysql2'` → `MysqlInspector`. |

---

## Feature 4 — TypeMapper

**Sprint 4 | Statut : À faire | Dépend de : Feature 2 ou 3**

### Objectif

Convertir un type SQL normalisé en type TypeScript et en décorateur Lucid. Alimenté par les `ColumnDef` du SchemaInspector.

### Étapes d'implémentation

| Étape | Détail |
|-------|--------|
| 1. Map statique | `src/typeMap.ts` — `Record<string, { tsType: string, decorator: string }>`. Couvrir : `varchar/text/char → string`, `int/bigint/float/numeric → number`, `boolean/tinyint(1) → boolean`, `json/jsonb → object`, `timestamp/timestamptz/datetime → DateTime`, `date → DateTime`, `uuid → string`. |
| 2. Normalisation input | Avant lookup : `toLowerCase()` + retirer la précision avec `/\(.*\)/` → `''`. Exemples : `'varchar(255)'→'varchar'`, `'int4'→'int4'` (alias pg → ajouter `int4→number`). |
| 3. PK | Si `isPrimary=true` → décorateur devient `@column({ isPrimary: true })`. |
| 4. created_at / updated_at | Si `withTimestamps=true` et nom dans `['created_at','updated_at']` → utiliser `@column.dateTime` avec `autoCreate`/`autoUpdate`. Ne pas les générer comme simples `@column()`. |
| 5. deleted_at | Si `withSoftDelete=true` et nom = `'deleted_at'` → `@column.dateTime()`. Signaler au ModelWriter d'ajouter le mixin `SoftDeletes`. |
| 6. Type inconnu | Fallback : `tsType='unknown'`, `decorator='@column()'` + commentaire `// TODO: type SQL non mappé : <sqlType>`. |
| 7. Flag needsDateTimeImport | Le TypeMapper retourne aussi un booléen indiquant si au moins une colonne nécessite l'import de `DateTime` (luxon). |

### Extrait typeMap.ts

```typescript
export const TYPE_MAP: Record<string, MappedType> = {
  varchar:     { tsType: 'string',   decorator: 'column' },
  text:        { tsType: 'string',   decorator: 'column' },
  int:         { tsType: 'number',   decorator: 'column' },
  int4:        { tsType: 'number',   decorator: 'column' },
  bigint:      { tsType: 'number',   decorator: 'column' },
  boolean:     { tsType: 'boolean',  decorator: 'column' },
  json:        { tsType: 'object',   decorator: 'column' },
  jsonb:       { tsType: 'object',   decorator: 'column' },
  timestamp:   { tsType: 'DateTime', decorator: 'column.dateTime' },
  timestamptz: { tsType: 'DateTime', decorator: 'column.dateTime' },
  date:        { tsType: 'DateTime', decorator: 'column.date' },
  uuid:        { tsType: 'string',   decorator: 'column' },
}
```

---

## Feature 5 — ModelWriter (colonnes, sans relations)

**Sprint 5 | Statut : À faire | Dépend de : Feature 4**

### Objectif

Générer le fichier `.ts` par table avec la classe `BaseModel` et les décorateurs de colonnes. Les relations seront greffées en Feature 7.

### Étapes d'implémentation

| Étape | Détail |
|-------|--------|
| 1. NamingStrategy | Implémenter la conversion basique : table `snake_case` → classe `PascalCase` (`blog_posts → BlogPost`), colonne `snake_case` → propriété `camelCase` (`user_id → userId`). Exposer l'interface `INamingStrategy` pour la Feature 10. |
| 2. Template par blocs | Construire le fichier en 3 blocs via template literals : (a) bloc imports, (b) corps de la classe, (c) `export default`. Pas de moteur de template externe — garder les dépendances minimales. |
| 3. Bloc imports | Toujours : `import { BaseModel, column } from '@adonisjs/lucid/orm'`. Si `needsDateTimeImport` : ajouter `import { DateTime } from 'luxon'`. Collecter les imports nécessaires dynamiquement pendant la génération des colonnes. |
| 4. Bloc colonnes | Pour chaque `ColumnDef` mappé : émettre le décorateur sur une ligne, puis `declare {camelName}: {tsType}` sur la suivante. Séparer les blocs par une ligne vide. |
| 5. Écriture fichier | Résoudre le path : `path.join(process.cwd(), config.outputDir, PascalName+'.ts')`. Si le fichier existe et `--force` absent → logger warn et skiper. Sinon : `await fs.writeFile(path, content, 'utf-8')`. |
| 6. Mots réservés TypeScript | Vérifier chaque nom de propriété contre : `[class, type, delete, import, export, return, ...]`. Si match → ajouter suffixe `_`. |

### Fichier généré — exemple

```typescript
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class BlogPost extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @column()
  declare userId: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
```

---

## Feature 6 — RelationDetector

**Sprint 6 | Statut : À faire | Dépend de : Feature 2 ou 3 (parallèle à Feature 5)**

### Objectif

Déduire `belongsTo`, `hasMany`, `hasOne` et `manyToMany` à partir des FK collectées. Peut être développée en parallèle de la Feature 5 car elle ne dépend pas du ModelWriter.

### Étapes d'implémentation

| Étape | Détail |
|-------|--------|
| 1. Index global FK | Construire deux maps : `fksByTable = Map<table, ForeignKeyDef[]>` (FK sortantes), `refsToTable = Map<table, {fromTable, col}[]>` (FK entrantes, index inverse). |
| 2. belongsTo | Pour chaque FK sortante de A vers B : `A.belongsTo(B)`. Nom de la relation : retirer `_id` du nom de colonne (`user_id → user → User`). |
| 3. hasMany / hasOne | Pour chaque table B ayant des FK entrantes depuis A : `B.hasMany(A)` par défaut. Si la colonne FK dans A a un index UNIQUE → `B.hasOne(A)` à la place. |
| 4. Détection pivot manyToMany | Une table est un pivot si : elle a exactement 2 FK vers des tables différentes et aucune colonne supplémentaire (hors id, timestamps). Si `post_tag` a `post_id→posts` et `tag_id→tags` → `Post.manyToMany(Tag, pivotTable='post_tag')`. |
| 5. Imports circulaires | Toujours utiliser la forme callback dans les décorateurs : `() => ModelClass`. Cela résout les dépendances circulaires au runtime sans changer les imports statiques. |
| 6. Table absente | Si `foreignTable` n'est pas dans les tables inspectées → générer la relation avec type `any` et un commentaire `// Table distante non inspectée`. |

### Logique de détection pivot

```typescript
function isPivot(table: string, cols: ColumnDef[], fks: ForeignKeyDef[]): boolean {
  const SYSTEM_COLS = new Set(['id', 'created_at', 'updated_at', 'deleted_at'])
  const extraCols = cols.filter(
    c => !fks.some(fk => fk.column === c.name) && !SYSTEM_COLS.has(c.name)
  )
  return fks.length === 2 && extraCols.length === 0
}
```

---

## Feature 7 — ModelWriter (avec relations)

**Sprint 7 | Statut : À faire | Dépend de : Feature 5 + Feature 6**

### Objectif

Étendre le ModelWriter pour injecter les décorateurs de relations et gérer les imports croisés entre modèles.

### Étapes d'implémentation

| Étape | Détail |
|-------|--------|
| 1. Signature ModelWriter | `ModelWriter.write(table, columns: ColumnDef[], relations: RelationDef[])`. `RelationDef` : `{ type: 'belongsTo'|'hasMany'|'hasOne'|'manyToMany', targetModel, propertyName, pivotTable? }`. |
| 2. Imports dynamiques Lucid | Collecter les types de relations utilisés dans le fichier. Import décorateurs : `import { ..., hasMany, belongsTo } from '@adonisjs/lucid/orm'`. Import types : `import type { HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'`. |
| 3. Imports modèles croisés | Pour chaque relation → `import TargetModel from '#models/target_model'`. Résoudre le chemin relatif depuis `outputDir`. Dédupliquer si le même modèle apparaît dans plusieurs relations. |
| 4. Bloc relations | Après les colonnes, émettre pour chaque relation : `@hasMany(() => Comment)\n  declare comments: HasMany<typeof Comment>`. camelCase singulier pour `belongsTo`/`hasOne`, pluriel pour `hasMany`/`manyToMany`. |
| 5. manyToMany | `@manyToMany(() => Tag, { pivotTable: 'post_tag' })\n  declare tags: ManyToMany<typeof Tag>`. |

### Fichier généré — exemple complet

```typescript
import { BaseModel, column, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import User from '#models/user'
import Comment from '#models/comment'

export default class Post extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => Comment)
  declare comments: HasMany<typeof Comment>
}
```

---

## Feature 8 — Commande `reliese:models`

**Sprint 8 | Statut : À faire | Dépend de : Features 5 + 6 + 7**

### Objectif

Commande Ace principale. Orchestre le pipeline complet : config → inspect → detect → map → write.

### Étapes d'implémentation

| Étape | Détail |
|-------|--------|
| 1. Déclarer la commande | `src/commands/reliese_models.ts extends BaseCommand`. Flags : `@flags.string('table')`, `@flags.boolean('force')`, `@flags.string('connection')`, `@flags.boolean('dry-run')`. |
| 2. Pipeline | 1) `ConfigLoader.load()`. 2) Override connection si `--connection` passé. 3) Inspector factory → `getTables()` → filtrer. 4) Si `--table` : restreindre à une table. 5) Pour chaque table : `getColumns() + getForeignKeys()`. 6) `RelationDetector.detect(allFKs)`. 7) `TypeMapper`. 8) `ModelWriter.write()` ou dry-run. |
| 3. --dry-run | Remplacer `fs.writeFile()` par `this.logger.info(content)`. Afficher en tête : `--- [DRY RUN] app/models/Post.ts ---`. |
| 4. Compteur final | Maintenir `{ created, skipped, errors }`. Afficher : `Done — 5 created, 2 skipped, 0 errors` en fin de run. |
| 5. Gestion erreurs | Wrapper chaque table dans un `try/catch`. Logger l'erreur et incrémenter `errors` sans stopper le pipeline. Afficher le détail en fin de run. |

---

## Feature 9 — Commande `reliese:install`

**Sprint 9 | Statut : À faire | Dépend de : Feature 1 (peut se faire dès le Sprint 1)**

### Objectif

Générer `config/reliese.ts` dans le projet utilisateur. Peut être développée en parallèle dès que la Feature 1 est stable.

### Étapes d'implémentation

| Étape | Détail |
|-------|--------|
| 1. Stub embarqué | Créer `src/stubs/reliese.stub` contenant le template de config. Le stub est copié dans le projet utilisateur, pas chargé dynamiquement. |
| 2. Vérifier l'existant | Si `config/reliese.ts` existe → `this.prompt.confirm('Overwrite?')` sauf si `--force`. Si refus → quitter proprement sans erreur. |
| 3. Écrire le fichier | `fs.copyFile(stubPath, destPath)`. Afficher : `✓ config/reliese.ts created`. |
| 4. Enregistrer les commandes | Dans le `ServiceProvider` du package, déclarer `commands: [ReliesesModels, ReliesesInstall]`. L'utilisateur doit ajouter le provider dans `adonisrc.ts`. |

### Contenu du stub

```typescript
import { defineConfig } from 'adonis-reliese'

export default defineConfig({
  outputDir: 'app/models',
  connection: 'default',
  tableFilter: {
    exclude: ['adonis_schema', 'adonis_schema_versions'],
  },
  withTimestamps: true,
  withSoftDelete: false,
})
```

---

## Features secondaires (10–12)

### Feature 10 — NamingStrategy personnalisée

**Dépend de : Feature 1**

Exposer l'interface `INamingStrategy` avec 3 méthodes : `modelName(table: string): string` (table → PascalCase), `propertyName(col: string): string` (col → camelCase), `relationName(table: string, type: RelationType): string`. Permettre à l'utilisateur de passer sa propre classe dans `defineConfig`. `ModelWriter` et `RelationDetector` reçoivent la strategy par injection.

### Feature 11 — SchemaInspector SQLite

**Dépend de : Feature 1**

SQLite n'a pas d'`information_schema`. Utiliser les PRAGMA :
- `PRAGMA table_list` → liste des tables
- `PRAGMA table_info(tableName)` → colonnes (`cid, name, type, notnull, dflt_value, pk`)
- `PRAGMA foreign_key_list(tableName)` → FK (`id, seq, table, from, to`)

Implémenter `SqliteInspector` derrière la même interface `ISchemaInspector` et l'enregistrer dans la factory pour le driver `'sqlite3'` / `'better-sqlite3'`.

### Feature 12 — Cache schéma

**Dépend de : Feature 2 ou 3 — non critique, à implémenter en dernier**

Après une inspection réussie, sérialiser le schéma complet en JSON dans `.adonis/reliese-schema.json`. Au prochain run, si le fichier existe et que `--no-cache` n'est pas passé, charger le cache sans interroger la base. Invalider automatiquement si `config.connection` change (stocker un hash de la config dans le cache).

---

*adonis-reliese — Guide d'implémentation interne — Mai 2026*
