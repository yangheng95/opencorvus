import { Database } from 'bun:sqlite';
import fs from 'node:fs';
const root='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-07/dock-width-before-103-02';
const taskID='tsk_g00VXN4oUA00rn0BZH4H';
const db=new Database(root+'/runtime/data/opencorvus.db',{readonly:true});
try{db.exec('BEGIN');
const task=db.query('SELECT * FROM engine_task WHERE id=?').get(taskID);
const sessions=db.query('WITH RECURSIVE tree(id) AS (SELECT session_id FROM engine_task WHERE id=? UNION ALL SELECT s.id FROM session s JOIN tree t ON s.parent_id=t.id) SELECT s.* FROM session s JOIN tree t ON t.id=s.id').all(taskID);
const rootSession=(task as any).session_id;
const messages=db.query('WITH RECURSIVE tree(id) AS (SELECT session_id FROM engine_task WHERE id=? UNION ALL SELECT s.id FROM session s JOIN tree t ON s.parent_id=t.id) SELECT m.* FROM message m JOIN tree t ON t.id=m.session_id ORDER BY m.time_created,m.id').all(taskID);
const tools=db.query('WITH RECURSIVE tree(id) AS (SELECT session_id FROM engine_task WHERE id=? UNION ALL SELECT s.id FROM session s JOIN tree t ON s.parent_id=t.id) SELECT r.*,m.session_id,o.data AS outcome_data FROM tool_part_request r JOIN message m ON m.id=r.message_id JOIN tree t ON t.id=m.session_id LEFT JOIN tool_part_outcome o ON o.request_part_id=r.id ORDER BY r.time_created,r.id').all(taskID);
const events=db.query("SELECT * FROM protocol_event WHERE task_id=? OR (aggregate_type='task' AND aggregate_id=?) ORDER BY emitted_at,id").all(taskID,taskID);
const owners=db.query('SELECT * FROM session_prompt_owner').all(); const waits=db.query('SELECT * FROM engine_task_wait_registration WHERE task_id=?').all(taskID); const settlements=db.query('SELECT * FROM engine_task_wait_settlement').all(); const results=tools.map((r:any)=>{const o=r.outcome_data?JSON.parse(r.outcome_data):null; return {partID:r.id,tool:JSON.parse(r.data).tool,outcome:o,stored:o?.resultAttemptID?db.query('SELECT result FROM permission_execution_result WHERE attempt_id=?').get(o.resultAttemptID):null};}); const facts={task,sessions,messages,tools,events,owners,waits,settlements,results};
fs.writeFileSync('specs/artifacts/2026-10-05-connection-workspace-authority/dock-width-103/shared-scheduling-audit-103/readonly-facts-v3.json',JSON.stringify(facts,null,2),{flag:'wx'});
console.log(JSON.stringify({task,sessions:sessions.map((s:any)=>({id:s.id,kind:s.kind,parent:s.parent_id})),lastTools:tools.slice(-8),events:events.slice(-8)},null,2));
db.exec('ROLLBACK');}finally{db.close();}
