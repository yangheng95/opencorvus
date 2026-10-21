import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/task-member-stream-504-before',read=(path:string)=>JSON.parse(fs.readFileSync(path,'utf8'))
const before=read(root+'/before-completion-qualification.json'),proof=read(run+'/evidence/physical-terminal-and-pair-cleanup.json'),preservation=read(root+'/data-preservation-observation.json').scopes[0]
assert.equal(proof.native.physicalCompletion,true);assert.equal(proof.native.outputDrainComplete,true);assert.equal(proof.native.requestCleanupComplete,true);assert.equal(proof.launcher.originalChildExit,0);assert.equal(proof.requests,15);assert.equal(proof.maximumRequests,24)
assert.deepEqual(preservation.originalRowDifferences,[1,2].map(row=>({table:'runtime_execution_capacity_lease',identity:'['+row+']',fields:['lease_id','owner_id','time_acquired','expires_at']})))
const db=new Database(run+'/runtime/data/opencorvus.db',{readonly:true,create:false})
try{
 const lifecycle=before.board.task.executionLifecycle,event=db.query('SELECT id,type,aggregate_id,emitted_at,payload FROM protocol_event WHERE id=?').get(lifecycle.terminalEventID) as any
 event.payload=JSON.parse(event.payload)
 assert.equal(event.type,'task.completed');assert.equal(event.aggregate_id,before.owner.task_id);assert.equal(event.emitted_at,lifecycle.terminalAt);assert.equal(event.payload.execution_epoch,1)
 const final=db.query('SELECT data FROM message WHERE id=?').get(before.actualTextDescription.messageID) as any,info=JSON.parse(final.data)
 assert.equal(info.finish,'stop');assert.deepEqual(info.time,before.publicMessages.at(-1).info.time)
 const slots=db.query('SELECT rowid,* FROM runtime_execution_capacity_lease WHERE rowid IN (1,2) ORDER BY rowid').all() as any[]
 for(const slot of slots){assert(slot.owner_id.startsWith('runtime:'+proof.native.target.pid+':'));assert(slot.expires_at<=Date.parse(proof.observedAtUtc))}
 const result={at:new Date().toISOString(),taskID:before.owner.task_id,originalTerminalEvent:event,memberFinal:{id:before.actualTextDescription.messageID,finish:info.finish,time:info.time},schema:3,tables:Object.keys(preservation.counts).length,originalRows:Object.values(preservation.counts).reduce((n:number,row:any)=>n+row.original,0),sourcePreservation:preservation.source,allOriginalChangedRows:preservation.originalRowDifferences,actualCapacitySlots:slots,native:proof.native,launcher:proof.launcher,actualRequests:proof.requests,maximumRequests:proof.maximumRequests,qualification:'Original Task terminal identity and completed member Message retained after own public shutdown; source all original fields/config preserved; only two exact mutable capacity rows changed in clone, both actual owned leases expired before physical closure.'}
 fs.writeFileSync(root+'/before-closed-qualification.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({task:'completed',terminal:event.id,member:info.finish,tables:result.tables,originalRows:result.originalRows,originalChangedRows:result.allOriginalChangedRows.length,physical:'settled',requests:proof.requests,maximum:proof.maximumRequests}))
}finally{db.close(true)}
