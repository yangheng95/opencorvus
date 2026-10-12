import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { Database as Sqlite } from 'bun:sqlite'
const repo='D:/myhexin-local/opencorvus'
const scratch=path.join(repo,'.tmp-product-iteration/error-copy-343')
process.env.OPENCORVUS_HOME=path.join(scratch,'export-runtime')
const req=createRequire(path.join(repo,'packages/opencorvus/package.json'))
const {drizzle}=await import(req.resolve('drizzle-orm/bun-sqlite'))
const {installProcessShims}=await import('../../packages/opencorvus/src/runtime/shims')
installProcessShims()
const {Session}=await import('../../packages/opencorvus/src/session')
const {Message}=await import('../../packages/opencorvus/src/session/message')
const schema=await import('../../packages/opencorvus/src/session/session.sql')
const {eq}=await import('../../packages/opencorvus/src/storage/db')
const {projectToolPartInTransaction}=await import('../../packages/opencorvus/src/session/tool-part-facts')
const {timelineOrderKey}=await import('../../packages/opencorvus/src/timeline/order')
const source='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-12/skill-loader-341-live-01'
const sqlite=new Sqlite(path.join(source,'runtime/data/opencorvus.db'),{readonly:true})
sqlite.exec('BEGIN')
try{
 const db=drizzle({client:sqlite})
 const sessionID='ses_-zUSBKhbizzj0BUgz0kf'
 const row=db.select().from(schema.SessionTable).where(eq(schema.SessionTable.id,sessionID)).get()!
 const messages=db.select().from(schema.MessageTable).where(eq(schema.MessageTable.session_id,sessionID)).all().sort((a:any,b:any)=>a.time_created-b.time_created||a.id.localeCompare(b.id)).map((row:any)=>{
  const regular=db.select().from(schema.PartTable).where(eq(schema.PartTable.message_id,row.id)).all().map((p:any)=>({time:p.time_created,id:p.id,part:Message.VisiblePart.parse({...p.data,id:p.id,messageID:row.id,sessionID,orderKey:timelineOrderKey({domain:'part',time:p.time_created,id:p.id})})}))
  const tools=db.select().from(schema.ToolPartRequestTable).where(eq(schema.ToolPartRequestTable.message_id,row.id)).all().map((p:any)=>({time:p.time_created,id:p.id,part:{...projectToolPartInTransaction(db as any,p),orderKey:timelineOrderKey({domain:'part',time:p.time_created,id:p.id})}}))
  return {info:Message.Info.parse({...row.data,id:row.id,sessionID}),parts:[...regular,...tools].sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id)).map(p=>p.part)}
 })
 const exported=Session.importSnapshot.schema.parse({info:Session.fromRow(row),messages})
 fs.writeFileSync(path.join(scratch,'actual-session-export.json'),JSON.stringify(exported,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({source,sessionID,projectID:exported.info.projectID,messages:messages.length,parts:messages.reduce((n,m)=>n+m.parts.length,0),errors:messages.filter(m=>m.info.role==='assistant'&&m.info.error).map(m=>({id:m.info.id,error:(m.info as any).error}))}))
}finally{sqlite.exec('ROLLBACK');sqlite.close()}
