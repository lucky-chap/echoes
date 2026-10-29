const {test} = require('node:test')
const assert = require('node:assert/strict')
const ts = require('typescript')
const fs = require('node:fs')
const modules = {}
function load(name) {
  if (modules[name]) return modules[name]
  const exports = {}
  new Function('require', 'exports', ts.transpileModule(fs.readFileSync(`lib/echoes/${name}.ts`, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023}}).outputText)((id) => load(id.replace('./', '')), exports)
  return modules[name] = exports
}
const {createBrowserWorkspaceStorage} = load('browser-storage')
const {createWorkspace} = load('workspace')
const workspace = createWorkspace('fixture', [{id: 'margaret', nickname: 'Margaret'}])
function memory() {
  return {value: null, async read() {return this.value}, async write(value) {this.value = value}, async clear() {this.value = null}}
}
test('Margaret persists across storage instances even when localStorage is blocked', async () => {
  const primary = memory(), fallback = memory()
  fallback.read = fallback.write = async () => {throw new Error('SecurityError')}
  await createBrowserWorkspaceStorage(primary, fallback).write(workspace)
  assert.deepEqual(await createBrowserWorkspaceStorage(primary, fallback).read(), workspace)
})
test('fallback saves survive reload and the newest snapshot wins', async () => {
  const primary = memory(), fallback = memory()
  const store = createBrowserWorkspaceStorage(primary, fallback)
  await store.write(workspace)
  const write = primary.write
  primary.write = async () => {throw new Error('QuotaExceededError')}
  const edited = {...workspace, residents: [{id:'margaret', nickname:'Margaret edited'}]}
  await store.write(edited)
  primary.write = write
  assert.deepEqual(await createBrowserWorkspaceStorage(primary, fallback).read(), edited)
})
test('failed saves reject, and blocked reads cannot silently create an empty workspace', async () => {
  const blocked = {async read() {throw Error('blocked')}, async write() {throw Error('full')}, async clear() {throw Error('blocked')}}
  const store = createBrowserWorkspaceStorage(blocked, blocked)
  await assert.rejects(store.write(workspace))
  await assert.rejects(store.read(), /existing data has not been replaced/)
})
test('queued edits stay ordered and clearing removes both snapshots after pending writes', async () => {
  const primary = memory(), fallback = memory()
  const store = createBrowserWorkspaceStorage(primary, fallback)
  const edited = {...workspace, residents: []}
  await Promise.all([store.write(workspace), store.write(edited)])
  assert.deepEqual(await store.read(), edited)
  fallback.value = {savedAt:0, workspace}
  await store.clear()
  assert.equal(await store.read(), null)
})
