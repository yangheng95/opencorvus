import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/task-member-stream-504-before',origin='http://127.0.0.1:18909'
const accepted=JSON.parse(fs.readFileSync(root+'/task-create-response.json','utf8')).result
const boardResponse=await fetch(origin+'/task/'+accepted.task_id+'/board?directory='+encodeURIComponent(accepted.directory)),board=await boardResponse.json() as any
assert.equal(boardResponse.status,200);assert.equal(board.task.status,'completed');assert.equal(board.task.executionLifecycle.epoch,1)
const db=new Database(run+'/runtime/data/opencorvus.db',{readonly:true,create:false})
try{
 const sessions=db.query(`WITH RECURSIVE owned(id) AS (SELECT ? UNION SELECT s.id FROM session s JOIN owned o ON s.parent_id=o.id) SELECT s.id,s.kind,s.parent_id,s.project_id,s.directory FROM session s JOIN owned o ON o.id=s.id`).all(board.task.sessionID) as any[]
 assert.deepEqual(sessions.map(row=>row.kind).sort(),['explore','orchestrator','root'])
 const worker=sessions.find(row=>row.kind==='explore'),scheduler=sessions.find(row=>row.kind==='orchestrator')
 assert.equal(worker.parent_id,scheduler.id);assert.equal(scheduler.parent_id,board.task.sessionID)
 for(const session of sessions){assert.equal(session.project_id,accepted.project_id);assert.equal(session.directory,accepted.directory)}
 const descriptors=db.query('SELECT * FROM worker_turn_descriptor WHERE session_id=?').all(worker.id)
 assert.equal(descriptors.length,1)
 const messages=(db.query('SELECT id,data FROM message WHERE session_id=? ORDER BY time_created,id').all(worker.id) as any[]).map(row=>({id:row.id,...JSON.parse(row.data)}))
 const assistants=messages.filter(message=>message.role==='assistant')
 assert.deepEqual(assistants.map(message=>message.finish),['tool-calls','tool-calls','stop'])
 for(const message of assistants)assert.equal(typeof message.time.completed,'number')
 const sourceParts=(db.query("SELECT p.id,p.message_id,p.data FROM part p JOIN message m ON m.id=p.message_id WHERE m.session_id=? AND json_extract(p.data,'$.type')='source-url' ORDER BY p.time_created,p.id").all(worker.id) as any[]).map(row=>({id:row.id,messageID:row.message_id,...JSON.parse(row.data)}))
 const urls=['https://arxiv.org/abs/2509.11035v1','https://aclanthology.org/2025.naacl-long.475/']
 assert.deepEqual(sourceParts.map(source=>source.url),urls)
 const tools=(db.query('SELECT r.id,r.message_id,r.data request,o.id outcome_id,o.data outcome FROM tool_part_request r JOIN message m ON m.id=r.message_id LEFT JOIN tool_part_outcome o ON o.request_part_id=r.id WHERE m.session_id=? ORDER BY r.time_created,r.id').all(worker.id) as any[]).map(row=>({id:row.id,messageID:row.message_id,request:JSON.parse(row.request),outcomeID:row.outcome_id,outcome:JSON.parse(row.outcome)}))
 assert.deepEqual(tools.map(tool=>({tool:tool.request.tool,url:tool.request.input.url,outcome:tool.outcome.outcome})),urls.map(url=>({tool:'webfetch',url,outcome:'completed'})))
 const publicMessages=[]
 for(const message of assistants){const response=await fetch(origin+'/session/'+worker.id+'/message/'+message.id+'?directory='+encodeURIComponent(accepted.directory));assert.equal(response.status,200);const value=await response.json() as any;publicMessages.push({status:response.status,info:value.info,parts:value.parts.map((part:any)=>({id:part.id,messageID:part.messageID,sessionID:part.sessionID,type:part.type,...(part.type==='text'?{textCodeUnits:part.text.length}:{}),...(part.type==='source-url'?{url:part.url,title:part.title}:{}),...(part.type==='tool'?{tool:part.tool,callID:part.callID,state:{status:part.state.status,input:part.state.input,title:part.state.title,time:part.state.time,outputCodeUnits:part.state.output?.length}}:{})}))})}
 const final=assistants.at(-1),text=(db.query("SELECT id,data FROM part WHERE message_id=? AND json_extract(data,'$.type')='text' ORDER BY time_created,id").all(final.id) as any[]).map(row=>({id:row.id,...JSON.parse(row.data)}))
 const body=text.at(-1).text
 fs.writeFileSync(root+'/before-final-response-private.json',JSON.stringify({info:final,text},null,2)+'\n',{flag:'wx'})
 const auditName=fs.readdirSync(run+'/evidence').filter(name=>/^provider-.*-\d+\.json$/.test(name)).sort((a,b)=>Number(a.match(/-(\d+)\.json$/)![1])-Number(b.match(/-(\d+)\.json$/)![1])).at(-1)!
 const audit=JSON.parse(fs.readFileSync(run+'/evidence/'+auditName,'utf8'));assert.equal(audit.maxRequests,24);assert(audit.requests.length<=24)
 for(const request of audit.requests){assert.equal(request.model,'gpt-6.1-sol');assert.equal(request.streaming,true);assert.equal(request.status,200);assert.equal(request.response_reader.state,'settled');assert.equal(request.response_reader.terminal.kind,'eof')}
 const permissions=db.query('SELECT id,request_id,event_type,task_id,session_id,time_created FROM permission_ledger WHERE task_id=? ORDER BY rowid').all(accepted.task_id)
 const promptOwners=db.query('SELECT * FROM session_prompt_owner WHERE session_id IN (SELECT id FROM session WHERE project_id=?)').all(accepted.project_id)
 const result={at:new Date().toISOString(),owner:accepted,board,sessions,workerDescriptors:descriptors,publicMessages,sources:sourceParts,tools:tools.map(tool=>({id:tool.id,messageID:tool.messageID,request:tool.request,outcomeID:tool.outcomeID,outcome:{...tool.outcome,output:undefined,outputCodeUnits:tool.outcome.output?.length}})),actualTextDescription:{messageID:final.id,textParts:text.map(part=>({id:part.id,textCodeUnits:part.text.length})),sectionCount:(body.match(/^## 第[^\n]+节/gm)??[]).length,referenceDefinitionOffset:body.indexOf('[member504-reference]: https://example.com/'),tail:body.slice(-140),boundary:'Actual backend response format description only; links/layout verified separately in manual screenshots'},permissions,promptOwners,provider:{actual:audit.requests.length,maximum:24,requests:audit.requests.map((request:any)=>({model:request.model,streaming:request.streaming,status:request.status,sourceReader:request.response_reader}))},diagnosticCorrection:'Earlier snapshot.ts read Tool outcome.status although immutable outcome uses outcome completed/failed. Those earlier metadata omit status; current checker reads true outcome contract and canonical public state.'}
 fs.writeFileSync(root+'/before-completion-qualification.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({task:board.task.status,epoch:board.task.executionLifecycle.epoch,worker:worker.id,final:final.id,textParts:result.actualTextDescription.textParts,sections:result.actualTextDescription.sectionCount,tools:result.tools.map(tool=>({tool:tool.request.tool,input:tool.request.input,outcome:tool.outcome.outcome})),taskPromptOwners:promptOwners.length,requests:audit.requests.length,maximum:24}))
}finally{db.close(true)}
