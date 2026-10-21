import fs from 'node:fs'
import {Database} from 'bun:sqlite'
const run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/real-deliverable-review-501-before'
const taskID='tsk_g00VYeMccK0078SroWDw'
const db=new Database(run+'/runtime/data/opencorvus.db',{readonly:true,create:false})
try {
 const task=db.query('SELECT * FROM engine_task WHERE id=?').get(taskID) as any
 const sessions=db.query(`WITH RECURSIVE owned(id) AS (SELECT ? UNION SELECT s.id FROM session s JOIN owned o ON s.parent_id=o.id) SELECT s.id,s.parent_id,s.kind,s.project_id FROM session s JOIN owned o ON o.id=s.id`).all(task.session_id)
 const permissions=db.query('SELECT id,request_id,event_type,decision_slot,session_id,task_id,message_id,tool_name,reason,time_created FROM permission_ledger WHERE task_id=? OR request_id IN (SELECT request_id FROM permission_ledger WHERE task_id=?) ORDER BY rowid').all(taskID,taskID)
 const interactions=db.query('SELECT * FROM engine_interaction_request WHERE task_id=?').all(taskID)
 const events=db.query("SELECT type,source,payload,emitted_at FROM protocol_event WHERE (aggregate_id=? OR task_id=?) AND type IN ('task.cancellation.requested','task.cancelled','task.reopened') ORDER BY seq").all(taskID,taskID)
 const leases=db.query('SELECT rowid,* FROM runtime_execution_capacity_lease').all()
 const result={observedAt:new Date().toISOString(),taskID,sessions,permissions,interactions,events,leases}
 fs.writeFileSync(import.meta.dir+'/cancelled-durable-facts.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify(result))
}finally{db.close(true)}
