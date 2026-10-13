import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {Database} from 'bun:sqlite'
const scratch=import.meta.dir
const base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14'
const main='ses_-zUS2EY0ezzjFidQwBy1'
const db=new Database(path.join(base,'long-source-reading-406-live/runtime/data/opencorvus.db'),{readonly:true})
function read(sql:string,...args:any[]){const q=db.query(sql);try{return q.all(...args) as any[]}finally{q.finalize()}}
function conversation(sessionID:string){
 const messages=read('SELECT id,data FROM message WHERE session_id=? ORDER BY time_created,id',sessionID).map(m=>({id:m.id,...JSON.parse(m.data)}))
 const parts=read('SELECT p.id,p.message_id AS messageID,p.data FROM part p JOIN message m ON m.id=p.message_id WHERE m.session_id=? ORDER BY m.time_created,m.id,p.time_created,p.id',sessionID).map(p=>({id:p.id,messageID:p.messageID,...JSON.parse(p.data)}))
 const tools=read("SELECT r.id,r.message_id AS messageID,r.data AS request,o.data AS outcome FROM tool_part_request r JOIN message m ON m.id=r.message_id JOIN tool_part_outcome o ON o.request_part_id=r.id WHERE m.session_id=? ORDER BY r.time_created,r.id",sessionID).map(t=>({id:t.id,messageID:t.messageID,request:JSON.parse(t.request),outcome:JSON.parse(t.outcome)}))
 return {messages,parts,tools}
}
function sourcePayloads(parts:any[]){return parts.filter(p=>p.type==='source-file').map(({id,messageID,sessionID,toolPartID,...p})=>p).sort((a,b)=>a.range.startLine-b.range.startLine)}
function qualifyCopy(c:ReturnType<typeof conversation>){
 assert.equal(c.messages.length,38)
 assert.equal(c.messages.filter(m=>m.role==='user').length,1)
 const bodies=c.parts.filter(p=>p.type==='text'&&p.text?.trim()&&c.messages.find(m=>m.id===p.messageID)?.role==='assistant')
 assert.equal(bodies.length,37)
 assert.equal(new Set(bodies.map(p=>p.text)).size,37)
 for(const m of c.messages.filter(m=>m.role==='assistant'))assert.ok(Number.isFinite(m.time.completed)&&m.time.completed>0)
 assert.equal(c.tools.length,36)
 assert.deepEqual(c.tools.map(t=>t.request.input.offset).sort((a,b)=>a-b),Array.from({length:36},(_,i)=>i*4+1))
 for(const t of c.tools){assert.equal(t.request.tool,'read');assert.equal(t.request.input.limit,4);assert.equal(t.outcome.outcome,'completed')}
 const sources=c.parts.filter(p=>p.type==='source-file')
 assert.equal(sources.length,36)
 for(const s of sources){const t=c.tools.find(t=>t.id===s.toolPartID);assert.ok(t);assert.equal(t.messageID,s.messageID);assert.equal(s.range.startLine,t.request.input.offset);assert.equal(s.range.endLine,t.request.input.offset+3)}
 return {messages:38,completedAssistantBodies:37,distinctBodies:37,completedReadTools:36,sources:36}
}
try {
 assert.deepEqual(read('PRAGMA user_version'),[{user_version:1}])
 const original=conversation(main),mainFacts=qualifyCopy(original)
 const sides=read("SELECT id,metadata FROM session WHERE json_extract(metadata,'$.sideChat.sourceSessionID')=? ORDER BY time_created,id",main)
 assert.equal(sides.length,13)
 const sideFacts=sides.map((s,index)=>{
   const inherited=JSON.parse(s.metadata).sideChat.inheritedMessageIDs,copy=conversation(s.id)
   if(index===0)return {sessionID:s.id,inheritedMessages:inherited.length,creationBoundary:'Prior batch: before the first completed source reply'}
   assert.equal(inherited.length,38)
   assert.deepEqual([...inherited].sort(),copy.messages.map(m=>m.id).sort())
   const facts=qualifyCopy(copy);assert.deepEqual(sourcePayloads(copy.parts),sourcePayloads(original.parts))
   return {sessionID:s.id,inheritedMessages:38,...facts,sourcePayloads:'Exact payload equality with message/tool identity remap'}
 })
 const audits=['before','timing','timing-02','after','after-256','commit','wal'].map(name=>{
  const dir=path.join(base,'fork-latency-407-'+name,'evidence')
  const names=fs.readdirSync(dir).filter(n=>/^provider-[0-9]/.test(n)).sort((a,b)=>Number(a.match(/-([0-9]+)\.json$/)![1])-Number(b.match(/-([0-9]+)\.json$/)![1]))
  const audit=JSON.parse(fs.readFileSync(path.join(dir,names.at(-1)!),'utf8'))
  const cleanup=JSON.parse(fs.readFileSync(path.join(dir,'physical-terminal-and-pair-cleanup.json'),'utf8'))
  assert.equal(audit.maxRequests,8)
  for(const r of audit.requests){assert.equal(r.model,'gpt-6.1-sol');assert.equal(r.streaming,true);assert.equal(r.status,200);assert.equal(r.response_reader.state,'settled');assert.equal(r.response_reader.terminal.kind,'eof');assert.ok(r.response_reader.chunkCount>0)}
  assert.equal(cleanup.physicalCompletion,true);assert.equal(cleanup.pairedCleanupComplete,true);assert.equal(cleanup.native.outputDrainComplete,true);assert.equal(cleanup.native.requestCleanupComplete,true)
  assert.equal(cleanup.native.terminal.exitCode,name==='timing'?1:0)
  return {name,requests:audit.requests.length,model:'gpt-6.1-sol',streaming:true,response:'200/EOF for each actual request',physicalExit:cleanup.native.terminal.exitCode,pairCleanup:true}
 })
 const observations=['after','256','commit','wal'].map(name=>{
  const o=JSON.parse(fs.readFileSync(path.join(scratch,'copy-settlement-'+name+'.json'),'utf8'));assert.equal(o.copied.status,200)
  const receipt=o.observations.at(-1).receipt;assert.deepEqual(receipt,{publications:263,phases:789})
  for(const row of o.observations)assert.equal(row.healthy.status,200)
  return {name,target:o.copied.body.id,copyMs:o.copied.durationMs,settledMs:o.settledObservedAfterMs,receipt,healthMaximumMs:Math.max(...o.observations.map((x:any)=>x.healthy.durationMs))}
 })
 const result={databaseVersion:1,mainSessionID:main,main:mainFacts,sides:sideFacts,audits,totalModelRequests:audits.reduce((n,r)=>n+r.requests,0),observations,boundary:'Actual read-only SQLite and public HTTP/source/provider/physical facts. UI screenshots separately establish visual scope. Side copies add no new read executions or sources; total copy latency remains above the 5000ms target.'}
 assert.equal(result.totalModelRequests,21)
 fs.writeFileSync(path.join(scratch,'checked-facts-wal.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({databaseVersion:result.databaseVersion,main:result.main,sides:result.sides.length,realStreams:result.totalModelRequests,allServicesPhysicallySettled:true,observations}))
}finally{db.close(true)}
