import fs from 'node:fs'
import {Database} from 'bun:sqlite'
const file='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/source-entry-navigation-514-before/runtime/data/opencorvus.db'
const taskID='tsk_g00VYhrJxy00qIC54qvM'
const sessions=['ses_-zURI8flEzz7XOW5XhCo','ses_-zURI8ekpzzskoESwwiP','ses_hM7XNBWOoUj94oRFpAmh','ses_h0gcSAerl0lMXEbz1cq3']
const db=new Database(file,{readonly:true,create:false})
try{
 db.exec('BEGIN')
 const requests=db.query(`SELECT id,request_id,session_id,task_id,tool_name FROM permission_ledger WHERE event_type='requested' AND (task_id=? OR session_id IN (?,?,?,?)) ORDER BY time_created`).all(taskID,...sessions) as any[]
 const rows=requests.map(request=>({request,events:db.query('SELECT id,event_type,decision_scope,decision_slot,source_event_id,reason,time_created FROM permission_ledger WHERE request_id=? ORDER BY time_created,id').all(request.request_id),interaction:db.query('SELECT id,source_kind,source_id FROM engine_interaction_request WHERE source_kind=? AND source_id=?').all('permission_request',request.id)}))
 const protocol=db.query('SELECT type,seq,emitted_at FROM protocol_event WHERE aggregate_id=? ORDER BY seq').all(taskID)
 const out={at:new Date().toISOString(),file,taskID,sessions,requests:rows,protocol,mode:'Read-only exact owned clone; original immutable facts only; no projection or data mutation'}
 fs.writeFileSync(import.meta.dir+'/permission-facts-detailed.json',JSON.stringify(out,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({requests:rows.length,tools:rows.map(row=>({tool:row.request.tool_name,requestID:row.request.request_id,events:row.events.map((e:any)=>e.event_type)}))}))
}finally{db.exec('ROLLBACK');db.close(true)}
