import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/permission-focus-dismissal-530-'
const read=(name:string)=>JSON.parse(fs.readFileSync(root+'/'+name,'utf8'))
const stages=[]
for(const stage of ['before','after']){
 const request=read(stage+'-request.json'),response=read(stage+'-response-private.json'),proof=JSON.parse(fs.readFileSync(base+stage+'/evidence/physical-terminal-and-pair-cleanup.json','utf8'))
 assert.equal(response.status,200);assert.equal(response.result.info.parentID,request.body.messageID);assert.equal(response.result.info.sessionID,request.sessionID);assert.equal(response.result.info.finish,'stop')
 const text=response.result.parts.filter((p:any)=>p.type==='text').map((p:any)=>p.text).join('\n')
 const db=new Database(base+stage+'/runtime/data/opencorvus.db',{readonly:true,create:false})
 const ledger=db.query("SELECT request_id,event_type,decision_scope,reason,time_created FROM permission_ledger WHERE request_id IN (SELECT request_id FROM permission_ledger WHERE event_type='requested' AND session_id=? AND time_created>=?) ORDER BY time_created,rowid").all(request.sessionID,Date.parse(request.at));db.close(true)
 const snapshots=fs.readdirSync(root).filter(name=>name.startsWith(stage+'-')&&name.endsWith('-pending.json')).map(name=>({name,...read(name)}))
 stages.push({stage,inputMessageID:request.body.messageID,assistantMessageID:response.result.info.id,parentID:response.result.info.parentID,providerID:response.result.info.providerID,modelID:response.result.info.modelID,dispatchAt:request.at,responseAt:response.at,http:response.status,finish:response.result.info.finish,roundTripMs:Date.parse(response.at)-Date.parse(request.at),textLength:text.length,headings:(text.match(/^### 权限阅读第\d{2}节/gm)??[]).length,starts:text.slice(0,36),ends:text.slice(-42),actualRequests:proof.requests,maximum:proof.maximumRequests,provider:proof.provider,pendingSnapshots:snapshots,ledger})
}
const eventMap=new Map()
for(const name of fs.readdirSync(root).filter(name=>name.startsWith('before-console-')&&name.endsWith('.json'))){for(const row of read(name)){const key=JSON.stringify([row.timestamp,row.message,row.url]);eventMap.set(key,{...JSON.parse(row.message.slice(6)),timestamp:row.timestamp,url:row.url})}}
const events=[...eventMap.values()].sort((a,b)=>a.timestamp.localeCompare(b.timestamp))
const wait=read('after-after-budget-wait-pending.json'),initial=read('after-initial-pending.json'),live=read('after-long-wait-handle.json')
assert.equal(wait.pending[0].id,initial.pending[0].id);assert.equal(wait.pending[0].sessionID,initial.pending[0].sessionID);assert(wait.elapsedMs>=315000);assert.equal(live.observation.session_id,86812)
const result={at:new Date().toISOString(),stages,closeObservations:events,closeEventCounts:Object.fromEntries(Object.entries(Object.groupBy(events,(e:any)=>e.kind)).map(([key,rows])=>[key,rows?.length])),longWait:{elapsedBeforeApprovalMs:wait.elapsedMs,samePendingID:wait.pending[0].id,originalHandle:live,originalPostRoundTripMs:stages.find(s=>s.stage==='after')?.roundTripMs,outcome:'Same original POST completed HTTP200/stop after active pending beyond five minutes;no redispatch'},uiBoundary:'Manual real Tab/Escape/pointer screenshots and passive cause events;no automated UI assertions',limits:['Real pending Permissions;Question and Task/Mission producers share the primitive but have no new live qualification','Default Goal modal wraps focus/escapes;close returns BODY and remains a next-iteration issue','Not continuous-frame/all-entry Rendering qualification']}
fs.writeFileSync(root+'/result-observation.json',JSON.stringify(result,null,2)+'\n',{flag:'w'})
console.log(JSON.stringify({stages:stages.map(s=>({stage:s.stage,http:s.http,finish:s.finish,textLength:s.textLength,headings:s.headings,roundTripMs:s.roundTripMs,actualRequests:s.actualRequests,ledger:s.ledger})),closeEventCounts:result.closeEventCounts,longWait:result.longWait.elapsedBeforeApprovalMs},null,2))
