import fs from 'node:fs'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,stage=process.argv[2]??'before',run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/live-task-source-growth-537-'+stage,owner=JSON.parse(fs.readFileSync(root+'/'+stage+'-task-create-response.json','utf8')).result
const db=new Database(run+'/runtime/data/opencorvus.db',{readonly:true,create:false})
try{
 const task=db.query('SELECT id,session_id FROM engine_task WHERE id=?').get(owner.task_id)
 const messages=db.query("SELECT m.id,m.session_id,json_extract(m.data,'$.role') role,json_extract(m.data,'$.time.completed') completed,json_extract(m.data,'$.finish') finish FROM message m JOIN session s ON s.id=m.session_id WHERE s.project_id=? ORDER BY m.time_created,m.id").all(owner.project_id)
 const sources=db.query("SELECT p.id,p.message_id,m.session_id,json_extract(p.data,'$.url') url FROM part p JOIN message m ON m.id=p.message_id JOIN session s ON s.id=m.session_id WHERE s.project_id=? AND json_extract(p.data,'$.type')='source-url' ORDER BY p.time_created,p.id").all(owner.project_id)
 const tools=db.query("SELECT r.id,m.session_id,json_extract(r.data,'$.tool') tool,json_extract(r.data,'$.input.url') url,json_extract(o.data,'$.outcome') outcome FROM tool_part_request r JOIN message m ON m.id=r.message_id JOIN session s ON s.id=m.session_id LEFT JOIN tool_part_outcome o ON o.request_part_id=r.id WHERE s.project_id=? ORDER BY r.time_created,r.id").all(owner.project_id)
 const summary={at:new Date().toISOString(),task,messages,sources,tools}
 fs.writeFileSync(root+'/db-status-'+Date.now()+'.json',JSON.stringify(summary,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify(summary))
}finally{db.close(true)}
