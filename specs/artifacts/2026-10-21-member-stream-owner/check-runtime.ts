import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,stage=process.argv[2];assert(stage==='before'||stage==='after')
const run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/member-stream-owner-503-'+stage
const input=JSON.parse(fs.readFileSync(root+'/'+stage+'-request.json','utf8')),output=JSON.parse(fs.readFileSync(root+'/'+stage+'-response-private.json','utf8'))
assert.equal(output.status,200);assert.equal(output.result.info.finish,'stop');assert.equal(output.result.info.sessionID,input.sessionID)
const db=new Database(run+'/runtime/data/opencorvus.db',{readonly:true,create:false})
try{
 const row=db.query('SELECT data FROM message WHERE id=? AND session_id=?').get(output.result.info.id,input.sessionID) as any
 const info=JSON.parse(row.data);assert.equal(info.role,'assistant');assert.equal(info.finish,'stop');assert.equal(typeof info.time.completed,'number')
 const messages=db.query('SELECT id FROM message WHERE session_id=? AND time_created>=? ORDER BY time_created,id').all(input.sessionID,Date.parse(input.at)-1000) as {id:string}[]
 const publicFacts=[]
 for(const {id}of messages){const url=new URL('http://127.0.0.1:'+(stage==='before'?18905:18907)+'/session/'+input.sessionID+'/message/'+id);url.searchParams.set('directory','C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh/project');const response=await fetch(url);assert.equal(response.status,200);publicFacts.push(await response.json())}
 const owners=db.query('SELECT * FROM session_prompt_owner WHERE session_id=?').all(input.sessionID) as any[]
 const standby=JSON.parse(fs.readFileSync(root+'/'+stage+'-standby-observation.json','utf8'))
 const ready=JSON.parse(fs.readFileSync(run+'/evidence/preflight-ready.json','utf8'))
 assert.equal(standby.http,200);assert.deepEqual(standby.status,{type:'idle'});assert.equal(owners.length,1)
 assert.equal(owners[0].owner_occurrence_id,ready.owner.occurrenceID);assert.equal(owners[0].owner_pid,ready.owner.pid)
 assert.deepEqual(standby.lifecycle[0].payload,{inputMessageID:input.body.messageID,status:{type:'idle'}})
 assert.equal(standby.standbyLogs.length,1)
 const pairSources=(db.query('SELECT id,data FROM part WHERE message_id IN (SELECT id FROM message WHERE session_id=? AND time_created>=?) AND json_extract(data,\'$.type\')=\'source-url\' ORDER BY time_created,id').all(input.sessionID,Date.parse(input.at)-1000) as any[]).map(row=>({id:row.id,...JSON.parse(row.data)}))
 assert.deepEqual(pairSources.map(s=>s.url),['https://arxiv.org/abs/2509.11035v1','https://aclanthology.org/2025.naacl-long.475/'])
 const names=fs.readdirSync(run+'/evidence').filter(n=>/^provider-.*-\d+\.json$/.test(n)).sort((a,b)=>Number(a.match(/-(\d+)\.json$/)![1])-Number(b.match(/-(\d+)\.json$/)![1]))
 const audit=JSON.parse(fs.readFileSync(run+'/evidence/'+names.at(-1),'utf8'));assert.equal(audit.maxRequests,12);assert(audit.requests.length<=12)
 for(const request of audit.requests){assert.equal(request.model,'gpt-6.1-sol');assert.equal(request.streaming,true);assert.equal(request.status,200);assert.equal(request.response_reader.state,'settled');assert.equal(request.response_reader.terminal.kind,'eof')}
 const session=db.query('SELECT id,time_updated FROM session WHERE id=?').get(input.sessionID)
 const result={at:new Date().toISOString(),stage,sessionID:input.sessionID,inputID:input.body.messageID,assistantID:output.result.info.id,canonical:{finish:info.finish,completed:info.time.completed},session,promptOwners:owners,promptDisposition:'Actual idle reusable standby;logical reply complete;physical ownership must retire at public shutdown',standby,sources:pairSources,publicFacts,provider:{actual:audit.requests.length,maximum:12,requests:audit.requests.map((r:any)=>({model:r.model,streaming:r.streaming,status:r.status,reader:r.response_reader}))}}
 fs.writeFileSync(root+'/'+stage+'-runtime-qualification.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({stage,assistant:result.assistantID,finish:info.finish,sourceURLs:pairSources.map(s=>s.url),promptOwners:owners.length,actualRequests:audit.requests.length,maximum:12}))
}finally{db.close(true)}
