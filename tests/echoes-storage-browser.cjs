// Real IndexedDB reload regression; uses an isolated browser context and fictional data.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const ts = require(process.cwd()+'/node_modules/typescript')
const fs = require('node:fs')
const assert = require('node:assert/strict')
const sources = Object.fromEntries(['workspace','browser-storage'].map(name => [name,ts.transpileModule(fs.readFileSync(`lib/echoes/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText]))
;(async()=>{
 const browser = await chromium.launch({...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}),headless:true,args:['--no-sandbox']})
 try {
 const context=await browser.newContext()
 await context.route('http://echoes-storage.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Storage regression</title>'}))
 const page=await context.newPage()
 await page.goto('http://echoes-storage.test/')
 async function setup(blockLocal=false) {
  await page.evaluate(({sources,blockLocal})=>{
   const modules={}
   function load(name){if(modules[name])return modules[name];const exports={};new Function('require','exports',sources[name])(id=>load(id.replace('./','')),exports);return modules[name]=exports}
   window.store=load('browser-storage').browserWorkspaceStorage
   if(blockLocal) Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked for regression test','SecurityError')}})
  },{sources,blockLocal})
 }
 await setup()
 await page.evaluate(()=>localStorage.setItem('echoes-active-workspace','legacy'))
 await page.evaluate(()=>localStorage.setItem('echoes-workspace-v2:legacy',JSON.stringify({version:1,secret:'legacy',residents:[{id:'margaret',nickname:'Margaret'}],sessions:[],feedback:[],traces:[]})))
 assert.equal(await page.evaluate(async()=>(await store.read()).residents[0].nickname),'Margaret')
 await page.evaluate(async()=>{const data=await store.read();data.traces=[{output:'x'.repeat(8*1024*1024)}];await store.write(data)})
 await page.reload()
 await setup(true)
 assert.equal(await page.evaluate(async()=>(await store.read()).residents[0].nickname),'Margaret')
 await page.evaluate(async()=>{const data=await store.read();data.residents[0].nickname='Margaret saved with localStorage blocked';await store.write(data)})
 await page.reload()
 await setup(true)
 assert.equal(await page.evaluate(async()=>(await store.read()).residents[0].nickname),'Margaret saved with localStorage blocked')
 await page.reload();await setup();await page.evaluate(()=>store.clear())
 assert.equal(await page.evaluate(()=>store.read()),null)
 console.log('PASS: legacy save loaded, 8 MiB workspace saved, Margaret survived reload with localStorage blocked, subsequent edit persisted, both stores cleared.')
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
