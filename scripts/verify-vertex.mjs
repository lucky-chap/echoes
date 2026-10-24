import { existsSync } from 'node:fs';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const model=process.env.GEMINI_MODEL||'gemini-3.8-flash';
try {
 const ai=new GoogleGenAI({vertexai:true,project:process.env.GOOGLE_CLOUD_PROJECT,location:process.env.GOOGLE_CLOUD_LOCATION||'global'});
 const response=await ai.models.generateContent({model,contents:'Write one short original line from Mia, a playful cafe-loving resident greeting her distracted musician friend Kai. No numbers. Return JSON with speaker and dialogue.',config:{thinkingConfig:{thinkingLevel:ThinkingLevel.LOW},responseMimeType:'application/json',responseJsonSchema:{type:'object',properties:{speaker:{type:'string',enum:['mia']},dialogue:{type:'string'}},required:['speaker','dialogue'],additionalProperties:false},maxOutputTokens:300,abortSignal:AbortSignal.timeout(15000),httpOptions:{timeout:15000,retryOptions:{attempts:1}}}});
 console.log(JSON.stringify({status:'Vertex AI Live',model,scene:JSON.parse(response.text),usage:response.usageMetadata},null,2));
} catch(error){console.error(JSON.stringify({status:'Vertex AI verification failed',model,message:error.message},null,2));process.exitCode=1;}
