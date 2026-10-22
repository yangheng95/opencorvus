import fs from 'node:fs'
import assert from 'node:assert/strict'
import {ownedJSON} from '../source-reconnect-history-535/http-json'
import {captureApiAuthority} from '../../packages/overlay/src/services/api'
import {parseSubagentConversation,mergeSubagentConversation} from '../../packages/overlay/src/services/subagent-conversation'
const root=import.meta.dir,sessionID=process.argv[2],phase=process.argv[3]
assert(/^ses_[A-Za-z0-9_-]+$/.test(sessionID));assert(/^[a-z0-9-]+$/.test(phase))
const stage=process.argv[4]??'before';assert(['before','after'].includes(stage))
const run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/live-task-source-growth-537-'+stage,owner=JSON.parse(fs.readFileSync(root+'/'+stage+'-task-create-response.json','utf8')).result,host=JSON.parse(fs.readFileSync(run+'/evidence/native-host-ready.json','utf8'))
const target={source:{kind:'task' as const,id:owner.task_id},sessionID,directory:owner.directory,authority:captureApiAuthority()},file=root+'/member-'+sessionID+'-cursor-private.json'
const prior=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):undefined
const url=new URL('http://127.0.0.1:'+(stage==='before'?19059:19061)+'/task/'+owner.task_id+'/conversation/session/'+sessionID);url.searchParams.set('directory',owner.directory)
if(prior){url.searchParams.set('after_live_sequence',String(prior.lastLiveSequence));url.searchParams.set('after_live_epoch',String(prior.liveEpoch))}
const startedAt=new Date().toISOString(),read=await ownedJSON(url,{method:'GET'},host.deadlineAt);assert.equal(read.response.status,200)
const received=parseSubagentConversation(target,read.result),merged=prior?mergeSubagentConversation(prior,received):received
const sources=(t:any)=>t.messages.flatMap((m:any)=>m.parts.filter((p:any)=>['source-url','source-document','source-file'].includes(p.type)))
if(prior)for(const source of sources(prior)){assert.deepEqual(sources(merged).find((p:any)=>p.id===source.id),source)}
const summary={phase,startedAt,receivedAt:new Date().toISOString(),sessionID,url:url.pathname+url.search,status:read.response.status,prior:prior?{epoch:prior.liveEpoch,sequence:prior.lastLiveSequence,messages:prior.messages.length}:null,received:{mode:received.transcriptMode,epoch:received.liveEpoch,sequence:received.lastLiveSequence,messages:received.messages.map(m=>({messageID:m.messageID,parts:m.parts.map(p=>({id:p.id,type:p.type,...(p.type==='text'?{textLength:p.text.length}:{} )}))}))},merged:{messages:merged.messages.map(m=>({messageID:m.messageID,role:m.info.role,finish:m.info.finish,time:m.info.time,parts:m.parts.map(p=>({id:p.id,type:p.type,...(p.type==='text'?{textLength:p.text.length}:{} )}))})),sources:sources(merged).map((p:any)=>({id:p.id,messageID:p.messageID,sessionID:p.sessionID,type:p.type,sourceId:p.sourceId,toolPartID:p.toolPartID,url:p.url,title:p.title}))},qualification:'Actual public backend payload parsed/merged by current production contract;prior immutable Source facts retained;not a UI test'}
fs.writeFileSync(root+'/member-'+sessionID+'-'+phase+'-payload-private.json',JSON.stringify(read.result)+'\n',{flag:'wx'})
fs.writeFileSync(root+'/member-'+sessionID+'-'+phase+'.json',JSON.stringify(summary,null,2)+'\n',{flag:'wx'})
fs.writeFileSync(file,JSON.stringify(merged)+'\n')
console.log(JSON.stringify({phase,sessionID,received:{mode:received.transcriptMode,epoch:received.liveEpoch,sequence:received.lastLiveSequence,messages:received.messages.length},mergedMessages:merged.messages.length,sources:summary.merged.sources,unfinished:summary.merged.messages.filter(m=>m.role==="assistant"&&!m.time?.completed).map(m=>({messageID:m.messageID,parts:m.parts}))}))
