import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/member-stream-owner-503-before'
const old=JSON.parse(fs.readFileSync(root+'/before-standby-observation.json','utf8')),proof=JSON.parse(fs.readFileSync(run+'/evidence/physical-terminal-and-pair-cleanup.json','utf8'))
assert.equal(proof.native.physicalCompletion,true);assert.equal(proof.native.outputDrainComplete,true);assert.equal(proof.native.requestCleanupComplete,true)
const db=new Database(run+'/runtime/data/opencorvus.db',{readonly:true,create:false})
try{
 const sessionID=old.owner.session_id
 const ownerRows=db.query('SELECT * FROM session_prompt_owner WHERE session_id=?').all(sessionID)
 const current=(db.query("SELECT seq,id,type,payload FROM protocol_event WHERE aggregate_id=? AND type='agent.execution.lifecycle' ORDER BY seq DESC LIMIT 1").get(sessionID) as any)
 current.payload=JSON.parse(current.payload)
 const original=db.query('SELECT seq,id,type,payload FROM protocol_event WHERE id=? AND aggregate_id=?').get(old.lifecycle[0].id,sessionID) as any
 original.payload=JSON.parse(original.payload)
 assert.deepEqual(original,old.lifecycle[0]);assert.deepEqual(current.payload,original.payload);assert.equal(ownerRows.length,0)
 const result={at:new Date().toISOString(),beforeOwner:old.owner,afterOwners:ownerRows,originalInputLifecycle:original,latestInputLifecycle:current,originalNative:proof.native,originalPhysicalDisposition:'Public shutdown released actual idle standby; original immutable idle fact remains; finalizePrompt settled the same accepted input by appending idle',checkerCorrection:'Original checker required latest event identity unchanged. loop.ts finalizePrompt and status.ts settleAcceptedExecutionOccurrence publish idle again after standby wake abort; this is an append, not replacement or active-input cancellation.'}
 fs.writeFileSync(root+'/before-standby-closed.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({physical:'settled',ownerRows:ownerRows.length,lifecycle:current.id,status:current.payload.status.type,input:current.payload.inputMessageID}))
}finally{db.close(true)}
