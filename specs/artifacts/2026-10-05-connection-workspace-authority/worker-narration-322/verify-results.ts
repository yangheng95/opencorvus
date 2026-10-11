import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const base=path.resolve('specs/artifacts/2026-10-05-connection-workspace-authority/worker-narration-322')
const read=(name:string)=>JSON.parse(fs.readFileSync(path.join(base,name),'utf8'))
const canonical=read('live-01/canonical-current-conversations.json')
const observed=read('observed-stream-and-narration-reads.json')
const provider=read('live-01/worker-narration-322-live-01-final-provider-audit.json')
const texts=[]
for(const tool of canonical.tools){
 const input=JSON.parse(tool.data)
 if(input.tool!=='read_agent_message')continue
 const outcome=canonical.outcomes.find((x:any)=>x.requestPartID===tool.id)
 assert.equal(outcome.outcome,'completed')
 const result=JSON.parse(outcome.output)
 for(const chunk of result.evidence_reads){
  if(chunk.field!=='text')continue
  const actual=canonical.parts.find((x:any)=>x.id===chunk.part_id && x.messageID===chunk.message_id)
  assert.equal(actual.type,'text')
  assert.equal(chunk.part_type,'text')
  assert.equal(chunk.source,'message-part-text')
  assert.equal(chunk.content,actual.text.slice(chunk.offset,chunk.end))
  assert.equal(chunk.next_offset,null)
  assert.equal(chunk.total_chars,actual.text.length)
  texts.push({messageID:chunk.message_id,partID:chunk.part_id,characters:chunk.content.length,exactCanonicalText:true})
 }
}
assert.deepEqual(texts.map(x=>x.characters),[487,3037])
assert.equal(observed.dispatches.length,1)
assert.equal(new Set(observed.workerMessages.map((x:any)=>x.parentID)).size,1)
assert.equal(observed.terminal.type,'task.completed')
assert.equal(provider.requests.length,10)
for(const request of provider.requests){
 assert.equal(request.model,'gpt-6.1-sol');assert.equal(request.streaming,true)
 assert.equal(request.status,200);assert.equal(request.response_reader.terminal.kind,'eof')
}
const result={observedAt:new Date().toISOString(),taskID:observed.taskID,readerTextChunks:texts,dispatchCalls:1,acceptedWorkerInputs:1,
 providerRequests:10,actualModel:'gpt-6.1-sol',providerCompletion:'all streaming HTTP 200 EOF',taskCompletion:'completed',
 evidenceScope:'Real Task tool request/outcome Parts compared with the same canonical text Parts; UI is separately documented manual screenshots.'}
const receipt=process.argv[2] ? path.resolve(process.argv[2]) : path.join(base,'real-reader-verification.json')
fs.writeFileSync(receipt,JSON.stringify(result,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify(result))
