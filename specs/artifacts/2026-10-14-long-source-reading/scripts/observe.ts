import {Database} from 'bun:sqlite'
import fs from 'node:fs'
import path from 'node:path'
const root='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/long-source-reading-406-live'
const db=new Database(path.join(root,'runtime/data/opencorvus.db'),{readonly:true})
function read(sql:string,...args:any[]){const q=db.query(sql);try{return q.all(...args) as any[]}finally{q.finalize()}}
try{
 db.exec('PRAGMA busy_timeout=5000')
 const sessions=read("SELECT id,kind,parent_id,metadata FROM session WHERE directory=? ORDER BY time_created,id",path.join(root,'project').replaceAll('/','\\'))
 const progress=sessions.map(s=>{
  const text=read("SELECT p.id,m.id AS messageID,json_extract(m.data,'$.time.completed') AS completed,json_extract(p.data,'$.text') AS text FROM part p JOIN message m ON m.id=p.message_id WHERE m.session_id=? AND json_extract(m.data,'$.role')='assistant' AND json_extract(p.data,'$.type')='text' ORDER BY m.time_created,p.time_created,p.id",s.id).filter(p=>p.text?.trim())
  const tools=read("SELECT json_extract(r.data,'$.tool') AS tool,json_extract(r.data,'$.input.offset') AS requested_offset,json_extract(r.data,'$.input.limit') AS requested_limit,json_extract(o.data,'$.outcome') AS outcome FROM tool_part_request r JOIN message m ON m.id=r.message_id LEFT JOIN tool_part_outcome o ON o.request_part_id=r.id WHERE m.session_id=? ORDER BY r.time_created,r.id",s.id)
  return {sessionID:s.id,kind:s.kind,sideChat:JSON.parse(s.metadata||'{}').sideChat,bodyCount:text.length,completedBodies:text.filter(p=>p.completed).length,distinctBodies:new Set(text.map(p=>p.text)).size,tools:tools.length,completedTools:tools.filter(p=>p.outcome==='completed').length,latestTools:tools.slice(-2),latestText:text.at(-1)?.text.slice(0,180)}
 })
 const result={at:new Date().toISOString(),progress}
 fs.appendFileSync(path.resolve(import.meta.dir,'progress.jsonl'),JSON.stringify(result)+'\n')
 console.log(JSON.stringify(result))
}finally{db.close(true)}
