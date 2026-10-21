import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,input=JSON.parse(fs.readFileSync(root+'/before-original-private.json','utf8'))
const preservation=JSON.parse(fs.readFileSync(root+'/data-preservation-observation.json','utf8')).scopes[0]
const db=new Database(input.target+'/runtime/data/opencorvus.db',{readonly:true,create:false})
try{
 const sid='ses_-zUS0WzzQzzDOGrIbYwN',pid='prj_hSQinOa1MIVoNEeARpn5',message='msg_g0VYesG0v00FFvV6yGyb'
 assert.deepEqual(preservation.originalRowDifferences,[
  {table:'memory_chunk',identity:'mck_h0TwOCuDIItgGfxTGf6k',fields:['content','token_count','time_updated']},
  {table:'memory_file',identity:'mem_hBhVOjG2IHNZ58LGhFBJ',fields:['time_updated']},
  ...[1,2].map(id=>({table:'runtime_execution_capacity_lease',identity:'['+id+']',fields:['lease_id','owner_id','time_acquired','expires_at']})),
  {table:'session',identity:sid,fields:['time_updated']}
 ])
 const before=input.original.memory_chunk.find((r:any)=>r.id==='mck_h0TwOCuDIItgGfxTGf6k'),after=db.query('SELECT * FROM memory_chunk WHERE id=?').get(before.id) as any
 const oldEnvelope=JSON.parse(before.content),envelope=JSON.parse(after.content)
 assert.equal(after.project_id,pid);assert.equal(envelope.revision,oldEnvelope.revision+1);assert.equal(envelope.status,'idle')
 assert.deepEqual(envelope.recentCoveredOccurrenceIDs,[...oldEnvelope.recentCoveredOccurrenceIDs,message]);assert.equal(envelope.tokenCount,after.token_count);assert.equal(envelope.timeUpdated,after.time_updated)
 const logRows=fs.readFileSync(input.target+'/runtime/log/dev.log','utf8').split(/\r?\n/).flatMap(line=>{try{const row=JSON.parse(line);return row.service==='memory.organizer'&&row.message==='Project MEMORY.MD organized'&&row.data?.projectID===pid?[{at:row.time,...row.data}]:[]}catch{return []}})
 assert.equal(logRows.length,1);assert.equal(logRows[0].revision,envelope.revision);assert.equal(logRows[0].tokenCount,envelope.tokenCount);assert.deepEqual(logRows[0].coveredOccurrenceIDs,[message])
 const oldSession=input.original.session.find((r:any)=>r.id===sid),session=db.query('SELECT id,project_id,time_updated FROM session WHERE id=?').get(sid) as any
 assert.equal(session.project_id,pid);assert(session.time_updated>oldSession.time_updated)
 const leases=(db.query('SELECT rowid,* FROM runtime_execution_capacity_lease WHERE rowid IN (1,2) ORDER BY rowid').all() as any[]).map(row=>({before:input.original.runtime_execution_capacity_lease.find((r:any)=>r.rowid===row.rowid),after:row}))
 const result={at:new Date().toISOString(),sourcePreservation:preservation.source,schema:3,tables:Object.keys(preservation.counts).length,originalRows:Object.values(preservation.counts).reduce((n:number,r:any)=>n+r.original,0),allOriginalDifferences:preservation.originalRowDifferences,memory:{projectID:pid,fileID:after.file_id,chunkID:after.id,oldRevision:oldEnvelope.revision,newRevision:envelope.revision,oldTokenCount:before.token_count,newTokenCount:after.token_count,oldMarkdownCodeUnits:oldEnvelope.markdown.length,newMarkdownCodeUnits:envelope.markdown.length,originalCovered:oldEnvelope.recentCoveredOccurrenceIDs.length,currentCovered:envelope.recentCoveredOccurrenceIDs.length,actualInputID:message,timeUpdated:after.time_updated,organizer:logRows[0]},session:{id:sid,projectID:pid,oldUpdated:oldSession.time_updated,currentUpdated:session.time_updated},capacity:leases,qualification:'All original rows compared by exact identity/all fields. Only the five enumerated original rows changed in isolated clone; original source all rows/config/file bytes/mtime retained. Project memory revision39 covers actual input and matches real organizer completion; no memory contents are exported.'}
 fs.writeFileSync(root+'/before-preservation-qualification.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({tables:result.tables,originalRows:result.originalRows,originalChangedRows:result.allOriginalDifferences.length,memoryRevision:envelope.revision,covered:message,source:'preserved'}))
}finally{db.close(true)}
