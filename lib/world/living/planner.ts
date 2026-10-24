import {destination,destinations,residents,type DestinationId,type ResidentId,type Taste} from '../profiles';
import type {Agent,CulturalSignal,Incident,Plan,Score,Snapshot} from './types';
export function newWorld():Snapshot{return {version:1,seed:4319,completed:0,day:1,hour:9,situation:'sunny',positions:residents.map(r=>r.start),agents:residents.map((r,i)=>({id:r.id,mood:i===1?'excited':'curious',energy:[72,91,65][i],hunger:[72,33,40][i],social:[82,70,35][i],goal:r.goal,location:'square',recentVisits:[],memories:[],important:[],relationships:{mia:55,kai:60,luna:52},learned:{}})),recentDialogue:[],events:[],incidents:[],lastParticipants:[]};}
export function seeded(seed:number,salt:number){let x=(seed+salt*2654435761)>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;}
const round=(x:number)=>Math.round(x*10)/10;
export function chooseIncident(world:Snapshot):Incident|null{
 const candidates:Incident[]=[];
 const a=(id:ResidentId)=>world.agents.find(a=>a.id===id)!;
 if(a('mia').hunger>55)candidates.push({id:'pastry-trail',actor:'mia',description:'Mia catches the smell of fresh pastries and changes her plans.',emotion:'excited',destination:'cafe'});
 if(a('kai').energy>55||world.situation==='performance')candidates.push({id:'distant-rehearsal',actor:'kai',description:'Kai stops mid-thought: someone is rehearsing down the lane.',emotion:'curious',destination:'music'});
 if(a('luna').energy>30)candidates.push({id:'unexpected-portrait',actor:'luna',description:'Luna starts a tiny portrait of a neighbor, who notices.',emotion:'amused',destination:null});
 if(world.situation==='rain')candidates.unshift({id:'sudden-rain',actor:'mia',description:'Rain catches the neighbors outside. Mia suggests somewhere warm.',emotion:'annoyed',destination:'cafe'});
 return candidates.find(c=>!world.incidents.slice(-3).includes(c.id))??null;
}
export function scoreDestinations(world:Snapshot,signals:CulturalSignal[],incident:Incident|null):Score[]{
 return world.agents.flatMap((agent,i)=>destinations.map((d,j)=>{
  const profile=residents.find(r=>r.id===agent.id)!;
  const keys=Object.keys(profile.taste) as (keyof Taste)[];
  const taste=Object.fromEntries(keys.map(k=>[k,Math.min(1,profile.taste[k]+(agent.learned[k]??0))])) as Taste;
  const culture=keys.reduce((sum,k)=>sum+taste[k]*d.traits[k],0)/keys.reduce((sum,k)=>sum+taste[k],0)*55;
  const affinitySignals=signals.filter(s=>s.residentId===agent.id&&s.source==='LIVE Qloo'&&s.affinity!==null);
  // Qloo's real affinity stays on the signal. This bounded mapping is a simulated activity influence.
  const affinity=affinitySignals.reduce((sum,s)=>sum+(s.affinity??0)*(s.category==='artist'?d.traits.music:s.category==='movie'?d.traits.social:d.traits.art),0)/Math.max(1,affinitySignals.length)*4;
  const factors={culture:round(culture+affinity),mood:agent.mood==='thoughtful'?d.traits.quiet*7:agent.mood==='excited'?d.traits.music*7:agent.mood==='annoyed'?d.traits.quiet*9:0,
   energy:round((100-agent.energy)/100*(d.traits.quiet*14-d.traits.music*5)),goal:round(agent.hunger/100*d.traits.food*25+(agent.id==='luna'?d.traits.art*6:agent.id==='kai'?d.traits.discovery*5:0)),social:round(agent.social/100*d.traits.social*8),relationships:round((Object.values(agent.relationships).reduce((s,n)=>s+n,0)/3-50)/50*d.traits.social*3),
   experience:round(agent.memories.filter(m=>m.location===d.id).reduce((s,m)=>s+(m.positive?1:-2),0)),recency:agent.recentVisits[0]===d.id?-18:agent.recentVisits.slice(1,3).includes(d.id)?-7:0,novelty:agent.recentVisits.includes(d.id)?0:5,event:world.situation==='rain'?(d.id==='cafe'?15:-5):world.situation==='performance'&&d.id==='music'?18:0,variation:round((seeded(world.seed,world.completed*31+i*7+j)-.5)*6)};
  if(incident?.actor===agent.id&&incident.destination===d.id)factors.event+=12;
  return {residentId:agent.id,destinationId:d.id,factors,total:round(Object.values(factors).reduce((a,b)=>a+b,0))};
 }));
}
export function planScene(world:Snapshot,signals:CulturalSignal[]):Plan{
 const incident=chooseIncident(world),scores=scoreDestinations(world,signals,incident);
 const choices=Object.fromEntries(world.agents.map(a=>[a.id,scores.filter(s=>s.residentId===a.id).sort((a,b)=>b.total-a.total||a.destinationId.localeCompare(b.destinationId))[0].destinationId])) as Record<ResidentId,DestinationId>;
 const pairs:[[ResidentId,ResidentId],[ResidentId,ResidentId],[ResidentId,ResidentId]]=[['mia','kai'],['mia','luna'],['kai','luna']];
 const ranked=pairs.map((pair,i)=>{const [a,b]=pair.map(id=>world.agents.find(a=>a.id===id)!);return {pair,score:(a.relationships[b.id]+b.relationships[a.id])/2+(a.social+b.social)/10+(choices[a.id]===choices[b.id]?9:0)-(world.lastParticipants.includes(a.id)&&world.lastParticipants.includes(b.id)?30:0)+seeded(world.seed,world.completed*5+i)*3};}).sort((a,b)=>b.score-a.score);
 const participants=ranked[0].pair;
 // A small willingness-to-compromise window; otherwise they genuinely split up.
 const [first,second]=participants;
 if(choices[first]!==choices[second]){
  const candidates=destinations.map(d=>({id:d.id,loss:participants.map(id=>{const rows=scores.filter(s=>s.residentId===id);return Math.max(...rows.map(s=>s.total))-rows.find(s=>s.destinationId===d.id)!.total;})})).filter(c=>c.loss.every(n=>n<=6));
  if(candidates.length){candidates.sort((a,b)=>a.loss.reduce((s,n)=>s+n,0)-b.loss.reduce((s,n)=>s+n,0));choices[first]=choices[second]=candidates[0].id;}
 }
 return {number:world.completed+1,participants,destinations:choices,scores,incident,summary:`${residents.find(r=>r.id===first)!.name} and ${residents.find(r=>r.id===second)!.name} cross paths. ${choices[first]===choices[second]?`They have time for ${destination(choices[first]).name}.`:'They compare plans before following their own interests.'}`};
}
export function nextGoal(a:Agent){return a.hunger>60?'Find something comforting to eat':a.energy<40?'Take a quiet break':a.social>65?'Catch up with a neighbor':a.id==='kai'?'Follow an unfamiliar melody':a.id==='luna'?'Find a detail worth sketching':'Try something outside the usual routine';}
