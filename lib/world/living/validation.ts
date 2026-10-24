import {residents,type ResidentId,type DestinationId} from '../profiles';
import {actions,emotions,type Scene,type Snapshot,type Plan,type Beat} from './types';
const ids=['mia','kai','luna'];const locations=['cafe','music','museum'];
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max:number)=>typeof v==='string'&&v.length>0&&v.length<=max;
const finite=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function validateSnapshot(value:unknown):Snapshot{
 if(!object(value)||value.version!==1||!Number.isInteger(value.seed)||!finite(value.seed,0,4294967295)||!Number.isInteger(value.completed)||!finite(value.completed,0,10000)||!Number.isInteger(value.day)||!finite(value.day,1,10000)||!finite(value.hour,0,23)||!['sunny','rain','performance'].includes(String(value.situation)))throw Error('Invalid world clock or context');
 if(!Array.isArray(value.agents)||value.agents.length!==3||new Set(value.agents.map(a=>a?.id)).size!==3)throw Error('Invalid residents');
 for(const a of value.agents){
  if(!object(a)||!ids.includes(String(a.id))||!emotions.includes(a.mood as never)||!finite(a.energy,0,100)||!finite(a.hunger,0,100)||!finite(a.social,0,100)||!text(a.goal,150)||!['square',...locations].includes(String(a.location)))throw Error('Invalid resident state');
  for(const field of ['memories','important']){if(!Array.isArray(a[field])||a[field].length>(field==='memories'?8:4))throw Error('Memory limit exceeded');for(const m of a[field])if(!object(m)||!text(m.id,80)||!text(m.text,240)||!['activity','conversation','discovery','promise','incident'].includes(String(m.kind))||!finite(m.day,1,10000)||!finite(m.scene,0,10000)||!(m.location===null||locations.includes(String(m.location)))||typeof m.positive!=='boolean')throw Error('Invalid memory');}
  if(!Array.isArray(a.recentVisits)||a.recentVisits.length>5||!a.recentVisits.every(d=>locations.includes(String(d))))throw Error('Invalid visits');
  if(!object(a.relationships)||!ids.every(id=>finite((a.relationships as Record<string,unknown>)[id],0,100)))throw Error('Invalid relationships');
  if(!object(a.learned)||Object.entries(a.learned).some(([k,v])=>!['food','music','art','quiet','social','discovery'].includes(k)||!finite(v,0,.2)))throw Error('Invalid learned interests');
 }
 if(!Array.isArray(value.positions)||value.positions.length!==3||!value.positions.every(p=>Array.isArray(p)&&p.length===2&&finite(p[0],0,480)&&finite(p[1],0,320)))throw Error('Invalid positions');
 if(!Array.isArray(value.recentDialogue)||value.recentDialogue.length>8||!value.recentDialogue.every(l=>object(l)&&ids.includes(String(l.speaker))&&text(l.text,220)))throw Error('Dialogue context too large');
 for(const field of ['events','incidents'])if(!Array.isArray(value[field])||value[field].length>8||!value[field].every(t=>text(t,240)))throw Error('Invalid recent events');
 if(!Array.isArray(value.lastParticipants)||value.lastParticipants.length>3||!value.lastParticipants.every(id=>ids.includes(String(id))))throw Error('Invalid participants');
 // Normalize to stable resident order. Extra untrusted fields never reach a prompt.
 const world=value as unknown as Snapshot;
 return {version:1,seed:world.seed,completed:world.completed,day:world.day,hour:world.hour,situation:world.situation,agents:residents.map(r=>{const a=world.agents.find(a=>a.id===r.id)!;return {id:a.id,mood:a.mood,energy:a.energy,hunger:a.hunger,social:a.social,goal:a.goal,location:a.location,recentVisits:a.recentVisits,memories:a.memories,important:a.important,relationships:a.relationships,learned:a.learned};}),positions:world.positions,recentDialogue:world.recentDialogue,events:world.events,incidents:world.incidents,lastParticipants:world.lastParticipants};
}
export function validateScene(value:unknown,plan:Plan):Scene{
 if(!object(value)||!['social_encounter','shared_activity','change_of_plans'].includes(String(value.sceneType))||!text(value.summary,180)||!Array.isArray(value.beats)||value.beats.length<4||value.beats.length>8)throw Error('Invalid scene structure');
 for(const b of value.beats){
  if(!object(b)||!plan.participants.includes(b.speaker as ResidentId)||!text(b.dialogue,220)||!emotions.includes(b.emotion as never)||!actions.includes(b.action as never))throw Error('Invalid scene beat');
  if(/\d|\b(score|scores|affinity|percent|algorithm|Qloo|Gemini|API|compatibility)\b/i.test(b.dialogue as string))throw Error('Technical or numerical speech rejected');
  if(b.targetLocation!==null&&!locations.includes(String(b.targetLocation)))throw Error('Unknown destination');
  if(b.action==='walk_to'&&b.targetLocation!==plan.destinations[b.speaker as ResidentId])throw Error('Movement contradicts engine plan');
  if(b.action!=='walk_to'&&b.action!=='point'&&b.targetLocation!==null)throw Error('Impossible action target');
  if(b.action==='point'&&b.targetLocation===null)throw Error('Pointing needs a valid target');
 }
 if(!plan.participants.every(id=>(value.beats as Beat[]).some(b=>b.speaker===id)))throw Error('Missing participant');
 if(!Array.isArray(value.suggestedMemoryUpdates)||value.suggestedMemoryUpdates.length>3||!Array.isArray(value.suggestedRelationshipChanges)||value.suggestedRelationshipChanges.length>2)throw Error('Too many state suggestions');
 for(const m of value.suggestedMemoryUpdates){if(!object(m)||!Number.isInteger(m.beatIndex)||!finite(m.beatIndex,0,value.beats.length-1)||!plan.participants.includes(m.residentId as ResidentId)||value.beats[m.beatIndex as number].speaker!==m.residentId||!['conversation','promise','discovery'].includes(String(m.kind)))throw Error('Ungrounded memory suggestion');if(m.kind==='promise'&&!/promise|next time|tomorrow|save you|meet you/i.test(value.beats[m.beatIndex as number].dialogue))throw Error('No promise occurred');}
 for(const r of value.suggestedRelationshipChanges)if(!object(r)||!Number.isInteger(r.beatIndex)||!finite(r.beatIndex,0,value.beats.length-1)||!plan.participants.includes(r.from as ResidentId)||!plan.participants.includes(r.to as ResidentId)||r.from===r.to||!Number.isInteger(r.delta)||!finite(r.delta,-2,2)||value.beats[r.beatIndex as number].speaker!==r.from)throw Error('Invalid relationship change');
 return value as unknown as Scene;
}
export const sceneSchema={type:'object',additionalProperties:false,required:['sceneType','summary','beats','suggestedMemoryUpdates','suggestedRelationshipChanges'],properties:{sceneType:{type:'string',enum:['social_encounter','shared_activity','change_of_plans']},summary:{type:'string',maxLength:180},beats:{type:'array',minItems:4,maxItems:8,items:{type:'object',additionalProperties:false,required:['speaker','dialogue','emotion','action','targetLocation'],properties:{speaker:{type:'string',enum:ids},dialogue:{type:'string',maxLength:220},emotion:{type:'string',enum:emotions},action:{type:'string',enum:actions},targetLocation:{type:['string','null'],enum:[...locations,null]}}}},suggestedMemoryUpdates:{type:'array',maxItems:3,items:{type:'object',additionalProperties:false,required:['residentId','beatIndex','kind'],properties:{residentId:{type:'string',enum:ids},beatIndex:{type:'integer',minimum:0,maximum:7},kind:{type:'string',enum:['conversation','promise','discovery']}}}},suggestedRelationshipChanges:{type:'array',maxItems:2,items:{type:'object',additionalProperties:false,required:['from','to','beatIndex','delta'],properties:{from:{type:'string',enum:ids},to:{type:'string',enum:ids},beatIndex:{type:'integer',minimum:0,maximum:7},delta:{type:'integer',minimum:-2,maximum:2}}}}}};
export const isDestination=(value:unknown):value is DestinationId=>locations.includes(String(value));
