require('./echoes-runtime.cjs')
const fs = require('node:fs')
const { generateSessionKit } = require('../lib/echoes/pipeline.ts')
const { extractIntake } = require('../lib/echoes/prose.ts')
const { reliabilityDemoProfiles } = require('../lib/echoes/demo-profiles.ts')
const { historyImportSchema, emptyPreferences } = require('../lib/echoes/preferences.ts')
const { sessionKitSchema } = require('../lib/echoes/storage-validation.ts')
const offline = process.argv.includes('--offline')
process.env.DEMO_MODE = offline ? 'true' : 'false'
process.env.ECHOES_WARM_DEMO = 'true'
let networkCalls = 0
if (offline) { process.env.ECHOES_OFFLINE = 'true'; global.fetch = async () => { networkCalls++; throw Error('Unexpected live request in offline verification') } }
const notes = 'Seamstress near Makola market. Loved dancing at weddings with her sister Abena. Sings along to call-and-response. Prefers short items with pauses. Sit on her right.'
;(async () => {
 const results = []
 const extracted = offline ? null : await extractIntake(notes)
 const history = historyImportSchema.parse([
  {item:'Osibisa',domain:'music',traits:['dance','upbeat'],response:'sparked',note:'User-supplied test history',session:'test-history'},
  {item:'E.T. Mensah',domain:'music',traits:['highlife','call-and-response'],response:'sparked',note:'User-supplied test history',session:'test-history'},
  {item:'Jim Reeves ballad (unspecified)',domain:'music',traits:['slow ballad'],response:'not_for_us',note:'No particular recording was supplied; do not exclude the artist',session:'test-history'},
 ])
 const confirmed = { ...emptyPreferences(), liked_traits:['Loved dancing at weddings','Sings along to call-and-response'], format_prefs:['Prefers short items with pauses'], logistics:['Sit on her right'], people:['Abena'], places:['Makola market'], sourceNotes: notes, confirmed:true }
 for (const base of reliabilityDemoProfiles) {
  const resident = base.id === 'demo-efua' ? {...base,nickname:'Baaba',notes,preferences:confirmed,responseHistory:history} : base
  const kit = await generateSessionKit({residents:[resident],feedback:[]})
  const parsed = sessionKitSchema.safeParse(kit)
  let longest = 0, current = 0
  for(const a of kit.activities){current=a.kind==='media'?current+a.minutes:0;longest=Math.max(longest,current)}
  const report = {profile:resident.nickname,extraction:resident.nickname==='Baaba'?extracted:undefined,
   schemaValid:parsed.success,schemaErrors:parsed.success?undefined:parsed.error.issues,
   totalMinutes:kit.activities.reduce((n,a)=>n+a.minutes,0),longestConsecutiveMedia:longest,
   notesUsed:kit.agentTrace.some(t=>t.summary==='Notes used: yes'),
   items:kit.items.map(i=>({name:i.name,traits:i.traits,seed:i.seed,namedFavorite:i.namedFavorite,eraLabel:i.eraLabel,year:i.yearEvidence.year,source:i.yearEvidence.source,reason:i.whyItFits})),
   promptSource:kit.agentTrace.find(t=>t.summary.startsWith('Media prompts:'))?.summary,
   activities:kit.activities,notes:kit.notes,dates:kit.dateChecks,networkCalls:offline?networkCalls:undefined,diagnostics:kit.diagnostics,kit}
  results.push(report)
  fs.writeFileSync(offline?'/tmp/echoes-personalization-offline.json':'/tmp/echoes-personalization-live.json',JSON.stringify(results,null,2))
  console.log(JSON.stringify({...report,kit:undefined,dates:report.dates.map(d=>({name:d.entity.name,status:d.status,reason:d.reason})),activities:undefined},null,2))
  if(!parsed.success || report.totalMinutes!==30 || longest>8 || (offline&&networkCalls)) process.exitCode=1
 }
})().catch(error=>{console.error(error);process.exitCode=1})
