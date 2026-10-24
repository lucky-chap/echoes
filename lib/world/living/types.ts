import type { DestinationId, Point, ResidentId, Situation, Taste } from '../profiles';
export const actions=['talk','laugh','shrug','wave','point','walk_to','sit','observe','sketch','dance','react'] as const;
export type Action=typeof actions[number];
export const emotions=['content','curious','excited','thoughtful','tired','annoyed','embarrassed','amused'] as const;
export type Emotion=typeof emotions[number];
export interface Memory {id:string;kind:'activity'|'conversation'|'discovery'|'promise'|'incident';text:string;day:number;scene:number;location:DestinationId|null;positive:boolean;}
export interface Agent {id:ResidentId; mood:Emotion; energy:number; hunger:number; social:number; goal:string; location:DestinationId|'square'; recentVisits:DestinationId[]; memories:Memory[]; important:Memory[]; relationships:Record<ResidentId,number>; learned:Partial<Taste>;}
export interface Snapshot {version:1;seed:number;completed:number;day:number;hour:number;situation:Situation;agents:Agent[];positions:Point[];recentDialogue:{speaker:ResidentId;text:string}[];events:string[];incidents:string[];lastParticipants:ResidentId[];}
export interface CulturalSignal {residentId:ResidentId;name:string;category:'movie'|'artist'|'art';entityId:string|null;affinity:number|null;source:'MOCK'|'LIVE Qloo';}
export interface Score {residentId:ResidentId;destinationId:DestinationId;total:number;factors:Record<'culture'|'mood'|'energy'|'goal'|'social'|'relationships'|'experience'|'recency'|'novelty'|'event'|'variation',number>;}
export interface Incident {id:string;actor:ResidentId;description:string;emotion:Emotion;destination:DestinationId|null;}
export interface Plan {number:number;participants:ResidentId[];destinations:Record<ResidentId,DestinationId>;scores:Score[];incident:Incident|null;summary:string;}
export interface Beat {speaker:ResidentId;dialogue:string;emotion:Emotion;action:Action;targetLocation:DestinationId|null;}
export interface Scene {sceneType:'social_encounter'|'shared_activity'|'change_of_plans';summary:string;beats:Beat[];suggestedMemoryUpdates:{residentId:ResidentId;beatIndex:number;kind:'conversation'|'promise'|'discovery'}[];suggestedRelationshipChanges:{from:ResidentId;to:ResidentId;beatIndex:number;delta:number}[];}
export interface SceneDiagnostics {llm:'Vertex AI Live'|'Mock Fallback';model:string;taste:'Qloo Mock'|'Qloo Live';reason:string|null;tasteReason:string|null;calls:number;limit:number;signals:CulturalSignal[];inputTokens?:number;outputTokens?:number;}
export interface SceneBundle {scene:Scene;plan:Plan;diagnostics:SceneDiagnostics;}
