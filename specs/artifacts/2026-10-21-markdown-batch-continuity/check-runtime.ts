import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21',result:any={at:new Date().toISOString(),maximumRequests:16,stages:[]}
for(const stage of ['before','after']){
 const run=base+'/markdown-batch-continuity-497-'+stage,db=new Database(run+'/runtime/data/opencorvus.db',{readonly:true,create:false})
 try{
  const conversations=[]
  for(const key of stage==='before'?['before']:['after','after-correction']){
   const input=JSON.parse(fs.readFileSync(root+'/'+key+'-request.json','utf8')),output=JSON.parse(fs.readFileSync(root+'/'+key+'-response-private.json','utf8'))
   assert.equal(output.status,200);assert.equal(output.result.info.finish,'stop');assert.equal(output.result.info.sessionID,input.sessionID)
   const row=db.query('SELECT data FROM message WHERE id=? AND session_id=?').get(output.result.info.id,input.sessionID) as any
   const persisted=JSON.parse(row.data);assert.equal(persisted.role,'assistant');assert.equal(persisted.finish,'stop');assert.equal(typeof persisted.time.completed,'number')
   const text=output.result.parts.filter((p:any)=>p.type==='text').map((p:any)=>p.text).join('')
   conversations.push({key,sessionID:input.sessionID,inputID:input.body.messageID,assistantID:output.result.info.id,finish:persisted.finish,completed:persisted.time.completed,textFacts:{length:text.length,paragraphUnits:text.split(/\n\s*\n/).length,referenceDefinitionOffset:text.lastIndexOf('[md497-reference]:'),definitionHasBlankLine:text.includes('\n\n[md497-reference]:'),end:text.slice(-90)},boundary:'Actual model text facts describe formatting;not a UI assertion or replacement for visible link review'})
  }
  const names=fs.readdirSync(run+'/evidence').filter(n=>/^provider-.*-\d+\.json$/.test(n)).sort((a,b)=>Number(a.match(/-(\d+)\.json$/)![1])-Number(b.match(/-(\d+)\.json$/)![1])),audit=JSON.parse(fs.readFileSync(run+'/evidence/'+names.at(-1),'utf8'))
  assert.equal(audit.maxRequests,8);assert(audit.requests.length<=8)
  for(const request of audit.requests){assert.equal(request.model,'gpt-6.1-sol');assert.equal(request.streaming,true);assert.equal(request.status,200);assert.equal(request.response_reader.state,'settled');assert.equal(request.response_reader.terminal.kind,'eof')}
  result.stages.push({stage,conversations,provider:{maximum:8,actual:audit.requests.length,requests:audit.requests.map((r:any)=>({model:r.model,streaming:r.streaming,status:r.status,reader:r.response_reader}))}})
 }finally{db.close(true)}
}
result.actualRequests=result.stages.reduce((n:number,s:any)=>n+s.provider.actual,0)
fs.writeFileSync(root+'/runtime-qualification.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({requests:result.actualRequests,maximum:16,conversations:result.stages.map((s:any)=>({stage:s.stage,actual:s.provider.actual,responses:s.conversations.map((r:any)=>({key:r.key,finish:r.finish,length:r.textFacts.length,paragraphUnits:r.textFacts.paragraphUnits,definitionHasBlankLine:r.textFacts.definitionHasBlankLine}))}))}))
