import { test } from '@japa/runner'
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ModelWriter } from '../src/model_writer.js'
import type { RelationDef, TypeMapperOutput } from '../src/types.js'

function tmpDir(): string {
  const dir = path.join(os.tmpdir(), 'reliese-mw-' + Math.random().toString(36).slice(2))
  mkdirSync(dir, { recursive: true })
  return dir
}

const mapped: TypeMapperOutput = {
  columns: [
    {
      name: 'id',
      sqlType: 'int',
      tsType: 'number',
      isNullable: false,
      isPrimary: true,
      hasDefault: false,
      decorator: 'column({ isPrimary: true })',
    },
  ],
  needsDateTimeImport: false,
  needsSoftDeletes: false,
}

test.group('ModelWriter', () => {
  test('default mode always overwrites (no skip, no --force)', async ({ assert }) => {
    const dir = tmpDir()
    const prev = process.cwd()
    process.chdir(dir)
    try {
      const writer = new ModelWriter({ outputDir: 'app/models' })
      const r1 = await writer.write('students', mapped)
      assert.equal(r1.baseStatus, 'created')
      assert.equal(r1.childStatus, 'skipped')
      assert.equal(r1.basePath, r1.childPath)

      const filePath = path.join(dir, 'app/models/Student.ts')
      writeFileSync(filePath, '// MANUAL EDIT')

      await writer.write('students', mapped)
      const content = readFileSync(filePath, 'utf-8')
      assert.notInclude(content, 'MANUAL EDIT', 'file must be overwritten in default mode')
      assert.include(content, 'class Student extends BaseModel')
    } finally {
      process.chdir(prev)
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('base_files mode: base regenerated, child created once', async ({ assert }) => {
    const dir = tmpDir()
    const prev = process.cwd()
    process.chdir(dir)
    try {
      const writer = new ModelWriter({ outputDir: 'app/models', withBaseFiles: true })

      const r1 = await writer.write('students', mapped)
      assert.equal(r1.baseStatus, 'created')
      assert.equal(r1.childStatus, 'created')

      const basePath = path.join(dir, 'app/models/base/Student.ts')
      const childPath = path.join(dir, 'app/models/Student.ts')
      assert.isTrue(existsSync(basePath))
      assert.isTrue(existsSync(childPath))

      const baseContent = readFileSync(basePath, 'utf-8')
      assert.include(baseContent, 'class StudentBase extends BaseModel')
      const childContent = readFileSync(childPath, 'utf-8')
      assert.include(childContent, 'extends StudentBase')

      writeFileSync(childPath, '// CUSTOM RELATION' + '\n')
      const r2 = await writer.write('students', mapped)
      assert.equal(r2.baseStatus, 'created')
      assert.equal(r2.childStatus, 'skipped')

      const childAfter = readFileSync(childPath, 'utf-8')
      assert.include(childAfter, 'CUSTOM RELATION', 'child file must be preserved')
    } finally {
      process.chdir(prev)
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('emits relation decorators and cross-model imports', async ({ assert }) => {
    const dir = tmpDir()
    const prev = process.cwd()
    process.chdir(dir)
    try {
      const writer = new ModelWriter({ outputDir: 'app/models', withBaseFiles: true })
      const relations: RelationDef[] = [
        { type: 'belongsTo', targetModel: 'User', targetTable: 'users', propertyName: 'user' },
        {
          type: 'hasMany',
          targetModel: 'Comment',
          targetTable: 'comments',
          propertyName: 'comments',
        },
        {
          type: 'manyToMany',
          targetModel: 'Tag',
          targetTable: 'tags',
          propertyName: 'tags',
          pivotTable: 'post_tag',
        },
        {
          type: 'hasMany',
          targetModel: 'Other',
          targetTable: 'missing',
          propertyName: 'others',
          isRemoteMissing: true,
        },
      ]
      await writer.write('posts', mapped, relations)

      const baseContent = readFileSync(path.join(dir, 'app/models/base/Post.ts'), 'utf-8')
      assert.include(
        baseContent,
        "import { BaseModel, column, belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'"
      )
      assert.include(
        baseContent,
        "import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'"
      )
      assert.include(baseContent, "import User from '#models/User'")
      assert.include(baseContent, "import Comment from '#models/Comment'")
      assert.include(baseContent, "import Tag from '#models/Tag'")

      assert.include(baseContent, '@belongsTo(() => User)')
      assert.include(baseContent, 'declare user: BelongsTo<typeof User>')
      assert.include(baseContent, 'declare comments: HasMany<typeof Comment>')
      assert.include(baseContent, "@manyToMany(() => Tag, { pivotTable: 'post_tag' })")
      assert.include(baseContent, 'declare tags: ManyToMany<typeof Tag>')

      // Remote (non-inspected) table: typed as any with a comment.
      assert.include(baseContent, '// Remote table not inspected: missing')
      assert.include(baseContent, 'declare others: HasMany<any>')

      // Child stays minimal and extends the base.
      const childContent = readFileSync(path.join(dir, 'app/models/Post.ts'), 'utf-8')
      assert.include(childContent, 'extends PostBase')
    } finally {
      process.chdir(prev)
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('render() returns content without writing files (dry-run)', async ({ assert }) => {
    const dir = tmpDir()
    const prev = process.cwd()
    process.chdir(dir)
    try {
      const writer = new ModelWriter({ outputDir: 'app/models' })
      const rendered = writer.render('students', mapped)

      // Aucun fichier ne doit être créé sur le disque.
      assert.isFalse(existsSync(path.join(dir, 'app/models/Student.ts')))
      assert.include(rendered.baseContent, 'export default class Student extends BaseModel')
      assert.equal(rendered.modelName, 'Student')
      assert.equal(rendered.basePath, path.join(dir, 'app/models/Student.ts'))
    } finally {
      process.chdir(prev)
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
