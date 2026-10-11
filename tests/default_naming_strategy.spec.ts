import { test } from '@japa/runner'
import { DefaultNamingStrategy } from '../src/default_naming_strategy.js'

test.group('DefaultNamingStrategy', () => {
  test('modelName singularizes snake_case tables to PascalCase', ({ assert }) => {
    const strategy = new DefaultNamingStrategy()

    assert.equal(strategy.modelName('users'), 'User')
    assert.equal(strategy.modelName('blog_posts'), 'BlogPost')
    assert.equal(strategy.modelName('news'), 'News')
  })

  test('propertyName camelCases columns and escapes reserved words', ({ assert }) => {
    const strategy = new DefaultNamingStrategy()

    assert.equal(strategy.propertyName('user_id'), 'userId')
    assert.equal(strategy.propertyName('created_at'), 'createdAt')
    assert.equal(strategy.propertyName('class'), 'class_')
    assert.equal(strategy.propertyName('type'), 'type_')
  })

  test('relationName pluralizes hasMany/manyToMany and singularizes the rest', ({ assert }) => {
    const strategy = new DefaultNamingStrategy()

    assert.equal(strategy.relationName('posts', 'hasMany'), 'Posts')
    assert.equal(strategy.relationName('tags', 'manyToMany'), 'Tags')
    assert.equal(strategy.relationName('users', 'belongsTo'), 'User')
    assert.equal(strategy.relationName('users', 'hasOne'), 'User')
  })

  test('fileName follows the AdonisJS convention: lowercase singular', ({ assert }) => {
    const strategy = new DefaultNamingStrategy()

    assert.equal(strategy.fileName('users'), 'user')
    assert.equal(strategy.fileName('blog_posts'), 'blog_post')
    assert.equal(strategy.fileName('post_tag'), 'post_tag')
    assert.equal(strategy.fileName('news'), 'news')
  })
})
