import type {
  ForeignKeyDef,
  NamingStrategy,
  RelationDef,
  RelationType,
  TableSchema,
} from './types.js'
import { DefaultNamingStrategy } from './default_naming_strategy.js'

// Columns that never count as "extra" when deciding whether a table is a
// many-to-many pivot (junction) table.
const SYSTEM_COLUMNS = new Set(['id', 'created_at', 'updated_at', 'deleted_at'])

// Infers Lucid relations (belongsTo / hasMany / hasOne / manyToMany) from the
// foreign keys collected across every inspected table.
export class RelationDetector {
  #strategy: NamingStrategy

  constructor(strategy?: NamingStrategy) {
    this.#strategy = strategy ?? new DefaultNamingStrategy()
  }

  detect(tablesData: Map<string, TableSchema>): Map<string, RelationDef[]> {
    const tableNames = [...tablesData.keys()]
    const result = new Map<string, RelationDef[]>()
    for (const name of tableNames) {
      result.set(name, [])
    }

    // Outgoing FKs per table, plus a reverse index of incoming FKs.
    const fksByTable = new Map<string, ForeignKeyDef[]>()
    const refsToTable = new Map<string, { fromTable: string; fk: ForeignKeyDef }[]>()
    for (const [table, data] of tablesData) {
      fksByTable.set(table, data.foreignKeys)
      for (const fk of data.foreignKeys) {
        const list = refsToTable.get(fk.foreignTable) ?? []
        list.push({ fromTable: table, fk })
        refsToTable.set(fk.foreignTable, list)
      }
    }

    // A pivot (junction) table gets manyToMany on both sides instead of plain
    // hasMany/belongsTo relations.
    const pivots = new Set<string>()
    for (const [table, data] of tablesData) {
      if (this.#isPivot(data)) {
        pivots.add(table)
      }
    }

    for (const table of tableNames) {
      const relations = result.get(table)!

      // belongsTo — every outgoing FK points to a parent.
      if (!pivots.has(table)) {
        for (const fk of fksByTable.get(table) ?? []) {
          relations.push(this.#belongsTo(fk, tableNames))
        }
      }

      // hasMany / hasOne  every incoming FK means a child references this table.
      for (const { fromTable, fk } of refsToTable.get(table) ?? []) {
        if (pivots.has(fromTable)) continue
        const isUnique = fk.isUnique === true
        const type: RelationType = isUnique ? 'hasOne' : 'hasMany'
        relations.push({
          type,
          targetModel: this.#strategy.modelName(fromTable),
          targetTable: fromTable,
          propertyName: this.#propertyName(fromTable, type),
          isRemoteMissing: !tableNames.includes(fromTable),
        })
      }
    }

    // manyToMany — add the relation on both sides of each pivot.
    for (const pivot of pivots) {
      const sides = [...new Set((fksByTable.get(pivot) ?? []).map((fk) => fk.foreignTable))].filter(
        (t) => tableNames.includes(t)
      )
      if (sides.length !== 2) continue

      const [sideA, sideB] = sides
      for (const [owner, other] of [
        [sideA, sideB],
        [sideB, sideA],
      ] as const) {
        result.get(owner)!.push({
          type: 'manyToMany',
          targetModel: this.#strategy.modelName(other),
          targetTable: other,
          propertyName: this.#propertyName(other, 'manyToMany'),
          pivotTable: pivot,
        })
      }
    }

    return result
  }

  #belongsTo(fk: ForeignKeyDef, tableNames: string[]): RelationDef {
    const base = fk.column.replace(/_id$/, '')
    return {
      type: 'belongsTo',
      targetModel: this.#strategy.modelName(fk.foreignTable),
      targetTable: fk.foreignTable,
      propertyName: this.#strategy.propertyName(base),
      isRemoteMissing: !tableNames.includes(fk.foreignTable),
    }
  }

  // A pivot table has exactly two FKs to two different tables and no extra
  // columns besides those FKs and the usual system columns.
  #isPivot(data: TableSchema): boolean {
    const fks = data.foreignKeys
    if (fks.length !== 2) return false

    const distinctTargets = new Set(fks.map((fk) => fk.foreignTable))
    if (distinctTargets.size !== 2) return false

    const extraCols = data.columns.filter(
      (c) => !fks.some((fk) => fk.column === c.name) && !SYSTEM_COLUMNS.has(c.name)
    )
    return extraCols.length === 0
  }

  #propertyName(table: string, type: RelationType): string {
    const pascal = this.#strategy.relationName(table, type)
    return pascal.charAt(0).toLowerCase() + pascal.slice(1)
  }
}
