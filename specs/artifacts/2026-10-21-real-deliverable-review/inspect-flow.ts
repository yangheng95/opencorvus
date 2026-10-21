import fs from 'node:fs'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/real-deliverable-review-501-before'
const accepted=JSON.parse(fs.readFileSync(root+'/task-create-corrected-response.json','utf8')).result
const db=new Database(run+'/runtime/data/opencorvus.db',{readonly:true,create:false})
try{
 const task=db.query('SELECT session_id FROM engine_task WHERE id=?').get(accepted.task_id) as any
 const rows=db.query(`WITH RECURSIVE owned(id) AS (SELECT ? UNION SELECT s.id FROM session s JOIN owned o ON s.parent_id=o.id)
 SELECT m.id,m.session_id,m.time_created,m.data FROM message m JOIN owned o ON m.session_id=o.id ORDER BY m.time_created,m.id`).all(task.session_id) as any[]
 const messages=rows.map(row=>{
  const info=JSON.parse(row.data),parts=db.query('SELECT data FROM part WHERE message_id=? ORDER BY time_created,id').all(row.id) as any[]
  return {id:row.id,sessionID:row.session_id,at:new Date(row.time_created).toISOString(),role:info.role,author:info.author,completed:info.time?.completed,error:info.error,parts:parts.map(p=>{
   const part=JSON.parse(p.data)
   return {type:part.type,tool:part.tool,status:part.state?.status,inputOperation:part.state?.input?.action??part.state?.input?.name,inputFile:part.state?.input?.filePath,error:part.state?.error,text:part.type==='text'?part.text:undefined}
  })}
 })
 const next=fs.readdirSync(root).filter(name=>/^flow-observation-\d+\.json$/.test(name)).length+1
 fs.writeFileSync(root+'/flow-observation-'+String(next).padStart(3,'0')+'.json',JSON.stringify({at:new Date().toISOString(),messages},null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify(messages.map(m=>({...m,parts:m.parts.map(p=>({...p,text:p.text?.slice(0,160)}))}))))
 const logs=fs.readFileSync(run+'/runtime/log/dev.log','utf8').trim().split(/\r?\n/).flatMap(line=>{try{return [JSON.parse(line)]}catch{return []}})
 console.log(JSON.stringify(logs.filter(r=>r.service==='llm').map(r=>({time:r.time,message:r.message,agent:r.data.agent,sessionID:r.data.sessionID,model:r.data.modelID,purpose:r.data.purpose}))))
}finally{db.close(true)}
