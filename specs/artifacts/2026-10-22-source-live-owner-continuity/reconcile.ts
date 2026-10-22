import fs from 'node:fs'
import assert from 'node:assert/strict'
import {ownedJSON} from './http-json'
const root=import.meta.dir,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/source-live-owner-continuity-529-after'
const request=JSON.parse(fs.readFileSync(root+'/after-request.json','utf8')),host=JSON.parse(fs.readFileSync(run+'/evidence/native-host-ready.json','utf8'))
const url=new URL(request.url);url.pathname='/session/'+request.sessionID+'/conversation';url.searchParams.set('tail_limit','2000')
const {response,result}=await ownedJSON(url,{method:'GET'},host.deadlineAt)
assert.equal(response.status,200)
const transcript=result.transcript as any[],input=transcript.find(row=>row.info.id===request.body.messageID)
assert.equal(input.info.sessionID,request.sessionID);assert.equal(input.info.role,'user')
const replies=transcript.filter(row=>row.info.role==='assistant'&&row.info.parentID===input.info.id)
const final=replies.findLast(row=>row.info.finish==='stop')
assert.equal(final.info.sessionID,request.sessionID);assert.equal(typeof final.info.time.completed,'number')
const text=final.parts.filter((p:any)=>p.type==='text').map((p:any)=>p.text).join('\n')
assert.equal((text.match(/^### 来源阅读第\d{2}节/gm)??[]).length,24)
const pendingURL=new URL(request.url);pendingURL.pathname='/permission'
const pending=await ownedJSON(pendingURL,{method:'GET'},host.deadlineAt)
assert.equal(pending.response.status,200)
const resultObservation={at:new Date().toISOString(),status:response.status,input:{messageID:input.info.id,sessionID:input.info.sessionID,role:input.info.role},replies:replies.map(row=>({messageID:row.info.id,parentID:row.info.parentID,finish:row.info.finish,time:row.info.time,parts:row.parts.map((p:any)=>({id:p.id,type:p.type,tool:p.tool,state:p.state?{status:p.state.status,time:p.state.time}:undefined,url:p.type==='source-url'?p.url:undefined}))})),final:{messageID:final.info.id,finish:final.info.finish,textLength:text.length,headings:24,starts:text.slice(0,32),ends:text.slice(-40)},pendingPermissions:pending.result.map((p:any)=>({id:p.id,sessionID:p.sessionID,toolName:p.toolName})),originalPost:{handle:63551,exit:1,outcome:'Bun default socket idle TimeoutError during real pending permission;not redispatched',preservation:'Original input identity accepted once,real persisted final message read by public checker'},transport:'Same bounded ownedJSON implementation for public GETs;POST idle option repaired for future runs,original POST not rerun'}
fs.writeFileSync(root+'/after-reconciled-result.json',JSON.stringify(resultObservation,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify(resultObservation.final));console.log(JSON.stringify({http:response.status,pending:resultObservation.pendingPermissions,inputMessageID:input.info.id,completedAt:final.info.time.completed}))
