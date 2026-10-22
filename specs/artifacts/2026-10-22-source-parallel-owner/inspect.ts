import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,label=process.argv[2]??'current',run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/source-parallel-owner-532-before'
assert(/^[a-z0-9-]+$/.test(label))
const request=JSON.parse(fs.readFileSync(root+'/before-request.json','utf8')),db=new Database(run+'/runtime/data/opencorvus.db',{readonly:true,create:false})
try{
 db.exec('BEGIN')
 const messages=db.query("SELECT id,time_created,data FROM message WHERE session_id=? AND json_extract(data,'$.parentID')=? ORDER BY time_created,id").all(request.sessionID,request.body.messageID) as any[]
 const rows=messages.map(message=>{
  const parts=(db.query('SELECT id,time_created,data FROM part WHERE message_id=? ORDER BY time_created,id').all(message.id) as any[]).map(row=>{const data=JSON.parse(row.data);return{id:row.id,created:row.time_created,type:data.type,toolPartID:data.toolPartID,sourceId:data.sourceId,url:data.url,textLength:data.text?.length}})
  const tools=(db.query('SELECT r.id,r.time_created,r.data,o.data AS outcome_data,o.time_created AS outcome_created FROM tool_part_request r LEFT JOIN tool_part_outcome o ON o.request_part_id=r.id WHERE r.message_id=? ORDER BY r.time_created,r.id').all(message.id) as any[]).map(row=>{const data=JSON.parse(row.data),outcome=row.outcome_data?JSON.parse(row.outcome_data):undefined;return{id:row.id,created:row.time_created,tool:data.tool,input:data.input,time:data.time,outcome:outcome?{kind:outcome.outcome,time:outcome.time,resultAttemptID:outcome.resultAttemptID,created:row.outcome_created}:null}})
  const info=JSON.parse(message.data)
  return{messageID:message.id,created:message.time_created,finish:info.finish,completed:info.time?.completed,errorName:info.error?.name,parts,tools}
 })
 const result={at:new Date().toISOString(),label,scope:'Actual readonly SQLite rows for exact parent user input;request admission times are not execution concurrency proof',sessionID:request.sessionID,inputMessageID:request.body.messageID,messages:rows}
 fs.writeFileSync(root+'/before-'+label+'-persistence.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify(result))
}finally{db.exec('ROLLBACK');db.close(true)}
