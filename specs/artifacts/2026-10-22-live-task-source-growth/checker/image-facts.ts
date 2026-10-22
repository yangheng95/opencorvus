import fs from 'node:fs'
import {Database} from 'bun:sqlite'
const stage=process.argv[2]??'after',root=import.meta.dir,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/live-task-source-growth-537-'+stage,owner=JSON.parse(fs.readFileSync(root+'/'+stage+'-task-create-response.json','utf8')).result
const db=new Database(run+'/runtime/data/opencorvus.db',{readonly:true,create:false})
try{
 const rows=db.query('SELECT p.id,p.message_id,m.session_id,p.data FROM part p JOIN message m ON m.id=p.message_id JOIN session s ON s.id=m.session_id WHERE s.project_id=? ORDER BY p.time_created,p.id').all(owner.project_id) as any[]
 const images=rows.flatMap(row=>{const p=JSON.parse(row.data);return p.type==='file'?[{id:row.id,messageID:row.message_id,sessionID:row.session_id,type:p.type,mime:p.mime,urlKind:p.url?.split(':',1)[0],dataCodeUnits:p.url?.length}]:[]})
 const tools=(db.query('SELECT r.id,r.message_id,m.session_id,o.data FROM tool_part_request r JOIN message m ON m.id=r.message_id JOIN session s ON s.id=m.session_id LEFT JOIN tool_part_outcome o ON o.request_part_id=r.id WHERE s.project_id=?').all(owner.project_id) as any[]).map(r=>{const outcome=r.data?JSON.parse(r.data):undefined;return{id:r.id,messageID:r.message_id,sessionID:r.session_id,outcome:outcome?.outcome,metadata:outcome?.metadata,attachments:outcome?.attachments?.map((f:any)=>({type:f.type,mime:f.mime,urlKind:f.url?.split(':',1)[0],dataCodeUnits:f.url?.length}))}})
 const result={at:new Date().toISOString(),stage,images,tools};fs.writeFileSync(root+'/'+stage+'-image-facts.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
}finally{db.close(true)}
