import fs from 'node:fs'
import assert from 'node:assert/strict'
import {ownedJSON} from '../source-reconnect-history-535/http-json'
const root=import.meta.dir,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/source-reconnect-observation-535-after'
const host=JSON.parse(fs.readFileSync(run+'/evidence/native-host-ready.json','utf8')),original=JSON.parse(fs.readFileSync(root+'/../source-reconnect-history-535/after-checked-result.json','utf8'))
const parent='ses_-zUS0X33CzzWEKMgCk98',member=original.sessionID,directory='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh/project'
const reads=await Promise.all([parent,member].map(async id=>{
 const url=new URL('http://127.0.0.1:19051/session/'+id+'/conversation');url.searchParams.set('directory',directory);url.searchParams.set('tail_limit','2000')
 const value=await ownedJSON(url,{method:'GET'},host.deadlineAt);assert.equal(value.response.status,200)
 return{id,status:value.response.status,result:value.result}
}))
const payload=reads[1].result,final=payload.transcript.find((row:any)=>row.info.id===original.assistant.at(-1).id)
assert.equal(final.info.finish,'stop');assert.equal(final.info.time.completed,original.assistant.at(-1).completed)
const source=payload.transcript.flatMap((row:any)=>row.parts).find((part:any)=>part.id===original.sourceIdentity.id)
assert.equal(source.sourceId,original.sourceIdentity.sourceId);assert.equal(source.toolPartID,original.sourceIdentity.toolPartID)
const summary={at:new Date().toISOString(),scope:'Real public canonical conversation reads under the new process;not a claim these checker calls were UI recovery calls',parent:reads[0].id,member,reads:reads.map(row=>({id:row.id,status:row.status,messageCount:row.result.transcript.length,sessions:row.result.view.sessions.map((s:any)=>({sessionID:s.sessionID,messageCount:s.messageIDs.length}))})),retainedFinal:{id:final.info.id,finish:final.info.finish,completed:final.info.time.completed},retainedSource:{id:source.id,sourceId:source.sourceId,toolPartID:source.toolPartID,url:source.url}}
fs.writeFileSync(root+'/after-canonical-read.json',JSON.stringify(summary,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify(summary))
