import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {Database} from 'bun:sqlite'
const scratch=import.meta.dir
const runtime='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/source-reading-405-live/runtime'
const audit=JSON.parse(fs.readFileSync(path.join(scratch,'source-reading-405-final-provider-audit.json'),'utf8'))
const data=JSON.parse(fs.readFileSync(path.join(scratch,'data-facts.json'),'utf8'))
const completion=JSON.parse(fs.readFileSync(path.join(scratch,'source-reading-405-qualified-surface-completion.json'),'utf8'))
const cleanup=JSON.parse(fs.readFileSync(path.join(scratch,'source-reading-405-physical-terminal-and-pair-cleanup.json'),'utf8'))
assert.equal(audit.requests.length,12)
assert.equal(audit.maxRequests,16)
const requestFacts=audit.requests.map((request:any)=>{
 assert.equal(request.model,'gpt-6.1-sol')
 assert.equal(request.streaming,true)
 assert.equal(request.status,200)
 assert.equal(request.response_reader.state,'settled')
 assert.equal(request.response_reader.terminal.kind,'eof')
 assert.ok(request.response_reader.chunkCount>0)
 return {model:request.model,status:request.status,streaming:request.streaming,...request.response_reader}
})
const mainIDs=[...new Set(requestFacts.filter((r:any)=>r.requestContext.streamRequest.agentID==='work').map((r:any)=>r.requestContext.sessionID))]
assert.equal(mainIDs.length,1)
const main=mainIDs[0]
const db=new Database(path.join(runtime,'data/opencorvus.db'),{readonly:true})
function read(sql:string,...args:any[]){const q=db.query(sql);try{return q.all(...args) as any[]}finally{q.finalize()}}
try {
 assert.deepEqual(data.databaseVersion,[{user_version:1}])
 const sides=read("SELECT id,parent_id,metadata FROM session WHERE json_extract(metadata,'$.sideChat.sourceSessionID')=?",main)
 assert.equal(sides.length,1)
 const side=sides[0]
 const inherited=JSON.parse(side.metadata).sideChat.inheritedMessageIDs
 assert.equal(inherited.length,9)
 const identities=[main,side.id]
 for(const session of identities) {
  const messages=data.messages.filter((m:any)=>m.sessionID===session)
  assert.equal(messages.length,9)
  assert.equal(messages.filter((m:any)=>m.role==='user').length,2)
  const assistants=messages.filter((m:any)=>m.role==='assistant')
  assert.equal(assistants.length,7)
  for(const message of assistants) assert.ok(Number.isFinite(message.completed)&&message.completed>0)
  const tools=data.tools.filter((tool:any)=>tool.sessionID===session)
  assert.deepEqual(tools.map((tool:any)=>tool.tool).sort(),['read','webfetch','webfetch','webfetch','websearch'])
  for(const tool of tools) assert.equal(tool.outcome,'completed')
  const sources=data.sources.filter((s:any)=>s.sessionID===session)
  assert.equal(sources.length,7)
  for(const source of sources){
   const tool=tools.find((tool:any)=>tool.id===source.toolPartID)
   assert.ok(tool)
   assert.equal(source.messageID,tool.messageID)
  }
 }
 const payloads=(sessionID:string)=>read("SELECT p.data FROM part p JOIN message m ON m.id=p.message_id WHERE m.session_id=? AND json_extract(p.data,'$.type') IN ('source-url','source-file','source-document')",sessionID)
  .map(row=>{const {toolPartID,...source}=JSON.parse(row.data);return source}).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
 assert.deepEqual(payloads(side.id),payloads(String(main)))
 assert.equal(completion.providerEOFRequests,12)
 assert.equal(cleanup.nativeSettlement.terminal.exitCode,0)
 assert.equal(cleanup.physicalCompletion,true)
 assert.equal(cleanup.pairedCleanupComplete,true)
 assert.deepEqual(cleanup.copiedPair.map((p:any)=>({name:path.basename(p.path),outcome:p.outcome})),[
  {name:'auth.json',outcome:'removed'},{name:'models.json',outcome:'removed'},
 ])
 const result={mainSessionID:main,sideSessionID:side.id,inheritedMessageIDs:inherited,
  modelRequests:requestFacts,actualUserMessages:2,actualToolEffects:5,actualSources:7,
  copiedReferenceMessages:9,copiedReferenceSources:7,referenceSourcePayloads:'exactly equal with canonical Tool binding remap',
  modelAndPhysicalCompletion:completion,boundary:'Actual backend/source/Provider/cleanup facts only. Visual observations remain the separately reviewed screenshots. Reference clones are not additional executed tools or newly gathered sources.'}
 fs.writeFileSync(path.join(scratch,'checked-facts.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({main,side:side.id,requests:12,actualSources:7,actualToolEffects:5,referenceSources:7,result:'passed'}))
} finally {db.close(true)}
