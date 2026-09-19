import {buildSync} from 'esbuild';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
for(const name of ['guidelines','deepseek'])buildSync({entryPoints:[`src/lib/${name}.ts`],bundle:true,format:'esm',outfile:`node_modules/.tmp/check-${name}.mjs`,logLevel:'silent'});
const {gradeBP}=await import(pathToFileURL(resolve('node_modules/.tmp/check-guidelines.mjs')));
const {chatDeepSeek}=await import(pathToFileURL(resolve('node_modules/.tmp/check-deepseek.mjs')));
for(const [s,d,level] of [[119.9,79.9,-1],[139.9,89.9,0],[159.9,99.9,1],[179.9,109.9,2],[180,80,3],[100,110,3]])assert.equal(gradeBP(s,d).level,level);
for(const v of [NaN,Infinity,-1,0])assert.throws(()=>gradeBP(v,80),RangeError);
const original=globalThis.fetch;
const response=(text,type='text/event-stream')=>new Response(text,{headers:{'Content-Type':type}});
try{
 globalThis.fetch=async()=>response('data: {"choices":[{"delta":{"content":"有效回答"}}]}\n\ndata: [DONE]\n\n');
 assert.equal(await chatDeepSeek([],()=>{}),'有效回答');
 for(const [body,type] of [['data: [DONE]\n','text/event-stream'],['data: {"choices":[{"delta":{"content":"截断"}}]}\n','text/event-stream'],['data: {"error":{"message":"failure"}}\n','text/event-stream'],['data: broken\n','text/event-stream'],['<html>200 fallback</html>','text/html'],['data: {"choices":[{"delta":{"content":"partial"},"finish_reason":"length"}]}\n\ndata: [DONE]\n','text/event-stream']]){
  globalThis.fetch=async()=>response(body,type);await assert.rejects(()=>chatDeepSeek([],()=>{}));
 }
}finally{globalThis.fetch=original;}
console.log('PASS: decimal boundaries, invalid vitals, complete stream, empty/truncated/error/malformed/HTML/length rejection (17 checks)');
