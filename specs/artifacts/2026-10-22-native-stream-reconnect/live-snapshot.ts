import fs from 'node:fs'
import {Database} from 'bun:sqlite'
const stage=process.argv[2]??'before',root=import.meta.dir,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/native-stream-reconnect-512-'+stage
const accepted=JSON.parse(fs.readFileSync(root+'/'+stage+'-task-create-response.json','utf8')).result
const response=await fetch('http://127.0.0.1:'+(stage==='live'?18951:18953)+'/task/'+accepted.task_id+'/board?directory='+encodeURIComponent(accepted.directory)),board=await response.json() as any
const db=new Database(run+'/runtime/data/opencorvus.db',{readonly:true,create:false})
try{
 const task=db.query('SELECT * FROM engine_task WHERE id=?').get(accepted.task_id) as any
 const sessions=db.query(`WITH RECURSIVE owned(id) AS (SELECT ? UNION SELECT s.id FROM session s JOIN owned o ON s.parent_id=o.id) SELECT s.id,s.kind,s.parent_id,s.project_id,s.title FROM session s JOIN owned o ON o.id=s.id`).all(task.session_id) as any[]
 const marks=sessions.map(()=>'?').join(','),ids=sessions.map(row=>row.id)
 const messages=(db.query(`SELECT id,session_id,data FROM message WHERE session_id IN (${marks}) ORDER BY time_created,id`).all(...ids) as any[]).map(row=>{const info=JSON.parse(row.data);return {id:row.id,sessionID:row.session_id,role:info.role,author:info.author,agent:info.agent,time:info.time,finish:info.finish,parentID:info.parentID,error:info.error}})
 const parts=(db.query(`SELECT p.id,p.message_id,m.session_id,p.data FROM part p JOIN message m ON m.id=p.message_id WHERE m.session_id IN (${marks}) ORDER BY p.time_created,p.id`).all(...ids) as any[]).map(row=>{const part=JSON.parse(row.data);return {id:row.id,messageID:row.message_id,sessionID:row.session_id,type:part.type,...(part.type==='text'?{textCodeUnits:part.text.length}:{}),...(part.type==='source-url'?{url:part.url,title:part.title}:{} )}})
 const tools=(db.query(`SELECT r.id,r.message_id,m.session_id,r.data request,o.data outcome FROM tool_part_request r JOIN message m ON m.id=r.message_id LEFT JOIN tool_part_outcome o ON o.request_part_id=r.id WHERE m.session_id IN (${marks}) ORDER BY r.time_created,r.id`).all(...ids) as any[]).map(row=>{const request=JSON.parse(row.request),outcome=row.outcome?JSON.parse(row.outcome):undefined;return {id:row.id,messageID:row.message_id,sessionID:row.session_id,tool:request.tool,input:request.input,outcome:outcome?.outcome,metadata:outcome?.metadata,outputCodeUnits:outcome?.output?.length,failure:outcome?.failure}})
 const promptOwners=db.query(`SELECT * FROM session_prompt_owner WHERE session_id IN (${marks})`).all(...ids)
 const auditName=fs.readdirSync(run+'/evidence').filter(name=>/^provider-.*-\d+\.json$/.test(name)).sort((a,b)=>Number(a.match(/-(\d+)\.json$/)![1])-Number(b.match(/-(\d+)\.json$/)![1])).at(-1)!
 const audit=JSON.parse(fs.readFileSync(run+'/evidence/'+auditName,'utf8'))
 const next=fs.readdirSync(root).filter(name=>/^task-observation-\d+\.json$/.test(name)).length+1
 const snapshot={at:new Date().toISOString(),owner:accepted,status:response.status,task:board.task,goals:board.goals,interactions:board.interactions,sessions,messages,parts,tools,promptOwners,provider:{requests:audit.requests.length,maxRequests:audit.maxRequests,exhausted:audit.exhausted,entries:audit.requests.map((r:any)=>({model:r.model,streaming:r.streaming,status:r.status,sourceReader:r.response_reader}))}}
 fs.writeFileSync(root+'/task-observation-'+String(next).padStart(3,'0')+'.json',JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({observation:next,http:response.status,taskID:task.id,status:board.task?.status,lifecycle:board.task?.lifecycleStatus,pendingInteractions:board.interactions?.filter((i:any)=>i.status==='pending').map((i:any)=>({id:i.id,type:i.type,tool:i.payload?.toolName})),sessions,unfinished:messages.filter(m=>m.role==='assistant'&&!m.time?.completed).map(m=>({id:m.id,sessionID:m.sessionID,text:parts.filter(p=>p.messageID===m.id&&p.type==='text').map(p=>p.textCodeUnits)})),tools:tools.slice(-4).map(t=>({tool:t.tool,outcome:t.outcome})),requests:audit.requests.length,maximum:audit.maxRequests}))
}finally{db.close(true)}
