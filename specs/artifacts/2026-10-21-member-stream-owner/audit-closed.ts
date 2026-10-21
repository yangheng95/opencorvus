import fs from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,baseline=JSON.parse(fs.readFileSync(root+'/before-original-private.json','utf8'))
const db=new Database(baseline.target+'/runtime/data/opencorvus.db',{readonly:true,create:false})
try {
 const sid='ses_-zUS0WzzQzzDOGrIbYwN'
 const events=(db.query("SELECT * FROM protocol_event WHERE aggregate_id=? AND type='agent.execution.lifecycle' ORDER BY seq DESC LIMIT 4").all(sid) as any[]).map(row=>({...row,payload:JSON.parse(row.payload)}))
 const original=baseline.original.memory_chunk.find((row:any)=>row.id==='mck_h0TwOCuDIItgGfxTGf6k')
 const current=db.query('SELECT rowid,* FROM memory_chunk WHERE id=?').get(original.id) as any
 const before=JSON.parse(original.content),after=JSON.parse(current.content)
 const describe=(row:any)=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,typeof value==='string'?{type:'string',codeUnits:value.length}:value]))
 const memory={file:db.query('SELECT * FROM memory_file WHERE id=?').get(current.file_id),beforeMetadata:{...original,content:undefined},afterMetadata:{...current,content:undefined},beforeEnvelope:describe(before),afterEnvelope:describe(after),changedEnvelopeFields:Object.keys(before).filter(key=>!isDeepStrictEqual(before[key],after[key]))}
 const logs=fs.readFileSync(baseline.target+'/runtime/log/dev.log','utf8').split(/\r?\n/).flatMap(line=>{try{const row=JSON.parse(line);return (String(row.service).includes('memory')||row.sessionID===sid&&String(row.message).includes('standby'))?[{at:row.time,service:row.service,message:String(row.message).slice(0,220),dataKeys:Object.keys(row.data??{}),projectID:row.projectID??row.data?.projectID,sessionID:row.sessionID??row.data?.sessionID}]:[]}catch{return []}})
 const result={at:new Date().toISOString(),owners:db.query('SELECT * FROM session_prompt_owner WHERE session_id=?').all(sid),events,memory,logs:logs.slice(-24)}
 fs.writeFileSync(root+'/closed-audit-observation.json',JSON.stringify(result,null,2)+'\n')
 console.log(JSON.stringify(result))
}finally{db.close(true)}
