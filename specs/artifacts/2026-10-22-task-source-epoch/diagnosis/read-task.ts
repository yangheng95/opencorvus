import fs from 'node:fs'
import assert from 'node:assert/strict'
import {ownedJSON} from '../source-reconnect-history-535/http-json'
import {parseSubagentConversation,mergeSubagentConversation} from '../../packages/overlay/src/services/subagent-conversation'
import {captureApiAuthority} from '../../packages/overlay/src/services/api'

const stage=process.argv[2];assert(['before','after'].includes(stage))
const root=import.meta.dir,plan=JSON.parse(fs.readFileSync(root+'/plan.json','utf8'))
const run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/task-source-cleanup-536c-'+stage
const host=JSON.parse(fs.readFileSync(run+'/evidence/native-host-ready.json','utf8'))
const target={source:{kind:'task' as const,id:plan.taskID},sessionID:plan.memberSessionID,directory:plan.directory,authority:captureApiAuthority()}
const read=async(path:string,cursor?:{lastLiveSequence:number,liveEpoch:number})=>{
 const url=new URL('http://127.0.0.1:19055/'+path);url.searchParams.set('directory',plan.directory)
 if(cursor){url.searchParams.set('after_live_sequence',String(cursor.lastLiveSequence));url.searchParams.set('after_live_epoch',String(cursor.liveEpoch))}
 const at=new Date().toISOString(),value=await ownedJSON(url,{method:'GET'},host.deadlineAt)
 assert.equal(value.response.status,200)
 return{at,path: url.pathname+url.search,result:value.result,status:value.response.status}
}
const board=await read('task/'+plan.taskID+'/board')
assert.equal(board.result.task.id,plan.taskID);assert.equal(board.result.task.status,'completed')
const path='task/'+plan.taskID+'/conversation/session/'+plan.memberSessionID
const initial=await read(path),snapshot=parseSubagentConversation(target,initial.result)
assert.equal(snapshot.transcriptMode,'snapshot')
const final=snapshot.messages.find(m=>m.messageID==='msg_g0VYhrsOH00hjUPFf8uK');assert(final)
assert.equal(final.info.finish,'stop')
const prose=final.parts.find(p=>p.id==='prt_g0VYhrto600RdxDOvFYd');assert.equal(prose.text.length,5542)
const sources=snapshot.messages.flatMap(m=>m.parts).filter(p=>['source-url','source-document','source-file'].includes(p.type))
assert(sources.length>0);const acl=sources.find(p=>String(p.url).startsWith('https://aclanthology.org/'));assert(acl)
const old=stage==='after'?JSON.parse(fs.readFileSync(root+'/before-snapshot-private.json','utf8')):initial.result
const prior=parseSubagentConversation(target,old)
const resumed=await read(path,prior),delta=parseSubagentConversation(target,resumed.result)
assert.equal(delta.transcriptMode,stage==='before'?'delta':'snapshot')
if(stage==='after')assert(delta.liveEpoch>prior.liveEpoch)
const merged=mergeSubagentConversation(prior,delta)
assert.deepEqual(merged.messages,snapshot.messages)
const summary={stage,at:new Date().toISOString(),scope:'Actual Task HTTP reads and current production parser/merge;separate from manual UI requests',board:{at:board.at,id:board.result.task.id,title:board.result.task.title,status:board.result.task.status},reads:[initial,resumed].map(r=>({at:r.at,path:r.path,status:r.status,mode:r.result.transcriptMode,epoch:r.result.liveEpoch,sequence:r.result.lastLiveSequence,messages:r.result.transcript.length})),prior:{epoch:prior.liveEpoch,sequence:prior.lastLiveSequence},retained:{messages:merged.messages.length,messageID:final.messageID,finish:final.info.finish,completed:(final.info.time as any).completed,proseID:prose.id,proseLength:prose.text.length,sources:sources.map(p=>({id:p.id,sourceId:p.sourceId,toolPartID:p.toolPartID,url:p.url}))},merge:'Exact complete current messages/Part membership/fields retained'}
fs.writeFileSync(root+'/'+stage+'-snapshot-private.json',JSON.stringify(initial.result)+'\n',{flag:'wx'})
fs.writeFileSync(root+'/'+stage+'-task-read.json',JSON.stringify(summary,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify(summary))
