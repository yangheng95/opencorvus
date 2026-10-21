import fs from 'node:fs'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/real-deliverable-review-501-before'
const accepted=JSON.parse(fs.readFileSync(root+'/task-create-corrected-response.json','utf8')).result
const response=await fetch('http://127.0.0.1:18889/task/'+accepted.task_id+'/board?directory='+encodeURIComponent(accepted.directory)),board=await response.json() as any
const db=new Database(run+'/runtime/data/opencorvus.db',{readonly:true,create:false})
try{
 const task=db.query('SELECT * FROM engine_task WHERE id=?').get(accepted.task_id) as any
 const sessions=db.query(`WITH RECURSIVE owned(id) AS (SELECT ? UNION SELECT s.id FROM session s JOIN owned o ON s.parent_id=o.id) SELECT s.id,s.kind,s.parent_id FROM session s JOIN owned o ON o.id=s.id`).all(task.session_id)
 const goals=db.query('SELECT * FROM engine_goal WHERE task_id=? ORDER BY time_created,id').all(task.id)
 const auditName=fs.readdirSync(run+'/evidence').filter(name=>/^provider-.*-\d+\.json$/.test(name)).sort((a,b)=>Number(a.match(/-(\d+)\.json$/)![1])-Number(b.match(/-(\d+)\.json$/)![1])).at(-1)!
 const audit=JSON.parse(fs.readFileSync(run+'/evidence/'+auditName,'utf8'))
 const next=fs.readdirSync(root).filter(name=>/^task-observation-\d+\.json$/.test(name)).length+1
 const snapshot={at:new Date().toISOString(),owner:accepted,status:response.status,task:board.task,goals:board.goals,interactions:board.interactions,storedGoals:goals,sessions,provider:{requests:audit.requests.length,maxRequests:audit.maxRequests,exhausted:audit.exhausted,entries:audit.requests.map((r:any)=>({model:r.model,streaming:r.streaming,status:r.status,sourceReader:r.response_reader}))}}
 fs.writeFileSync(root+'/task-observation-'+String(next).padStart(3,'0')+'.json',JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({observation:next,http:response.status,taskID:task.id,status:board.task?.status,lifecycle:board.task?.lifecycleStatus,goals:board.goals?.map((g:any)=>({id:g.deliverySliceID,title:g.goalTitle,accepted:g.acceptance?.accepted})),pendingInteractions:board.interactions?.filter((i:any)=>i.status==='pending').map((i:any)=>({id:i.id,type:i.type})),sessions,requests:audit.requests.length,maximum:audit.maxRequests}))
}finally{db.close(true)}
