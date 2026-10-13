import {Database} from 'bun:sqlite'
import fs from 'node:fs'
import path from 'node:path'
const root='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/source-reading-405-live'
const dbPath=path.join(root,'runtime/data/opencorvus.db')
const db=new Database(dbPath,{readonly:true})
function read(sql:string,...args:any[]) { const q=db.query(sql);try{return q.all(...args) as any[]}finally{q.finalize()} }
try {
 const sessions=read(`SELECT s.id,s.kind,s.directory,COUNT(p.id) AS sources FROM session s JOIN message m ON m.session_id=s.id JOIN part p ON p.message_id=m.id WHERE json_extract(p.data,'$.type') IN ('source-url','source-file','source-document') GROUP BY s.id ORDER BY s.id`)
 const sources=read(`SELECT p.id,m.session_id AS sessionID,p.message_id AS messageID,json_extract(p.data,'$.type') AS type,json_extract(p.data,'$.sourceId') AS sourceId,json_extract(p.data,'$.toolPartID') AS toolPartID,json_extract(p.data,'$.title') AS title,json_extract(p.data,'$.provider') AS provider,json_extract(p.data,'$.url') AS url,json_extract(p.data,'$.path') AS path FROM part p JOIN message m ON m.id=p.message_id WHERE json_extract(p.data,'$.type') IN ('source-url','source-file','source-document') ORDER BY m.time_created,p.time_created,p.id`)
 const result={databaseVersion:read('PRAGMA user_version'),sessions,sources,
  messages:sessions.flatMap(s=>read(`SELECT id,session_id AS sessionID,json_extract(data,'$.role') AS role,json_extract(data,'$.finish') AS finish,json_extract(data,'$.time.completed') AS completed FROM message WHERE session_id=? ORDER BY time_created,id`,s.id)),
  tools:sessions.flatMap(s=>read(`SELECT r.id,m.session_id AS sessionID,r.message_id AS messageID,json_extract(r.data,'$.tool') AS tool,json_extract(o.data,'$.outcome') AS outcome FROM tool_part_request r JOIN message m ON m.id=r.message_id LEFT JOIN tool_part_outcome o ON o.request_part_id=r.id WHERE m.session_id=? ORDER BY r.time_created,r.id`,s.id)),
  boundary:'Read-only persisted facts after the genuine UI-created work conversation and normal service shutdown; no source/message fabrication or historical data restore.'}
 fs.writeFileSync(path.resolve(import.meta.dir,'data-facts.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({version:result.databaseVersion,sessions,messages:result.messages.length,sources:sources.length,tools:result.tools}))
} finally {db.close(true)}
