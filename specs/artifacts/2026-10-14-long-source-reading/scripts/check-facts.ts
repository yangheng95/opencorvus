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
try{
 assert.deepEqual(read('PRAGMA user_version'),[{user_version:1}])
 const original=conversation(main)
 const mainFacts=qualifyCopy(original)
 const sides=read("SELECT id,metadata FROM session WHERE json_extract(metadata,'$.sideChat.sourceSessionID')=? ORDER BY time_created,id",main)
 assert.equal(sides.length,4)
 const sideFacts=sides.map((s,index)=>{
  const inherited=JSON.parse(s.metadata).sideChat.inheritedMessageIDs
  const copy=conversation(s.id)
  if(index===0){assert.deepEqual(inherited,[]);assert.deepEqual(copy,{messages:[],parts:[],tools:[]});return {sessionID:s.id,inheritedMessages:0,creationBoundary:'Source had no completed reply yet'}}
  assert.equal(inherited.length,38)
  assert.deepEqual([...inherited].sort(),copy.messages.map(m=>m.id).sort())
  const facts=qualifyCopy(copy)
  assert.deepEqual(sourcePayloads(copy.parts),sourcePayloads(original.parts))
  return {sessionID:s.id,inheritedMessages:38,...facts,sourcePayloads:'exact canonical equality with message/tool identity remap'}
 })
 const audited=[
  {name:'original-406',file:path.join(scratch,'long-source-reading-406-final-provider-audit.json'),cleanup:path.join(scratch,'long-source-reading-406-physical-terminal-and-pair-cleanup.json'),expected:41,budget:56},
  ...['long-source-reading-406-diagnostic-04','long-source-reading-406-after-05'].map(name=>{
   const dir=path.join(base,name,'evidence')
   const latest=fs.readdirSync(dir).filter(n=>/^provider-.*\.json$/.test(n)).map(n=>({n,time:fs.statSync(path.join(dir,n)).mtimeMs})).sort((a,b)=>b.time-a.time)[0]
   return {name,file:path.join(dir,latest.n),cleanup:path.join(dir,'physical-terminal-and-pair-cleanup.json'),budget:20}
  })
 ]
 const audits=audited.map(run=>{
  const audit=JSON.parse(fs.readFileSync(run.file,'utf8'))
  const cleanup=JSON.parse(fs.readFileSync(run.cleanup,'utf8'))
  assert.equal(audit.maxRequests,run.budget)
  if('expected' in run)assert.equal(audit.requests.length,run.expected)
  assert.ok(audit.requests.length>0&&audit.requests.length<=run.budget)
  for(const request of audit.requests){assert.equal(request.model,'gpt-6.1-sol');assert.equal(request.streaming,true);assert.equal(request.status,200);assert.equal(request.response_reader.state,'settled');assert.equal(request.response_reader.terminal.kind,'eof');assert.ok(request.response_reader.chunkCount>0)}
  assert.equal(cleanup.physicalCompletion,true);assert.equal(cleanup.pairedCleanupComplete,true)
  const native=cleanup.nativeSettlement??cleanup.native
  assert.equal(native.terminal.reason,'exited');assert.equal(native.terminal.exitCode,0)
  return {name:run.name,file:run.file,requests:audit.requests.length,budget:run.budget,model:'gpt-6.1-sol',streaming:true,response:'200/EOF',physicalExit:0,pairCleanup:true}
 })
 const result={databaseVersion:1,mainSessionID:main,main:mainFacts,sides:sideFacts,audits,totalModelRequests:audits.reduce((n,r)=>n+r.requests,0),boundary:'Backend identity/output/source/provider/physical evidence only. Manual screenshots own visual acceptance. The 36 ranges are from one document; side copies add no executed tools or new research sources.'}
 fs.writeFileSync(path.join(scratch,'checked-facts.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify(result))
}finally{db.close(true)}
