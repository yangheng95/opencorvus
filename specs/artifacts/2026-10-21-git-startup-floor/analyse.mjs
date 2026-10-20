import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,runs=['query-a','version-a','cmd-a','cmd-b','version-b','query-b'],rows=[]
for(const run of runs){
 const raw=JSON.parse(fs.readFileSync(root+'/'+run+'-raw.json','utf8')),result=JSON.parse(fs.readFileSync(root+'/'+run+'-result.json','utf8'))
 assert.equal(raw.requests.length,296);assert.equal(raw.spawns.length,296);assert.equal(raw.outputs.length,296)
 const byRequest=new Map(raw.spawns.map(s=>[path.resolve(s.args[1]),s]));assert.equal(byRequest.size,296)
 for(const row of raw.requests){
  const requestFile=path.resolve(path.dirname(row.request.ready_file),'request.json'),spawn=byRequest.get(requestFile)
  assert(spawn,'Original --request exact occurrence path join,not a batch PID set');assert.equal(spawn.args[0],'--request');assert.equal(spawn.pid,row.ready.helper_pid)
  assert.equal(row.ready.request_id,row.request.request_id);assert.equal(row.settled.request_id,row.request.request_id);assert.equal(row.ready.runtime_occurrence_id,raw.owner.occurrenceID);assert.equal(row.settled.runtime_occurrence_id,raw.owner.occurrenceID)
  assert.equal(row.request.owner_pid,raw.owner.pid);assert.equal(row.request.owner_process_instance_id,raw.owner.processInstanceID);assert.equal(row.request.runtime_occurrence_id,raw.owner.occurrenceID)
  assert.equal(row.ready.helper_pid,row.settled.helper_pid);assert.equal(row.ready.target_pid,row.settled.target_pid);assert.equal(row.settled.active_processes,0);assert.equal(spawn.code,0);assert.equal(spawn.signal,null);assert(spawn.closedAt>=spawn.returnedAt)
 }
 rows.push({...result,originalRequestPathJoins:byRequest.size,nativeProof:'Each exact request path + request_id + runtime occurrence + owner birth + corresponding helper PID,original ready/settled active0 and helper close0. PID reuse does not define identity.',timing:'Wall includes original command settlement and raw evidence write,excludes imports and pre/post physical qualification. Spawn sum is synchronous parent call intervals,overlapping native child lifetimes;not additive to them.'})
}
const analysis={observedAt:new Date().toISOString(),rows,commands:rows.reduce((s,r)=>s+r.queries,0),projects:149,physicalRequests:rows.reduce((s,r)=>s+r.physicalRequests,0),modelRequests:0,production:'unchanged',fullConfigCriteria:'Original save10s/entire restore5s/read20s remain separate and not requalified here',inference:'Query≈version;cmd also13s. Large common cost survives removal of repository parsing and Git itself. Parent synchronous helper spawns sum9-11.6s;these are serialized calls,not sum of parallel child lifetime. This evidence localizes cost but does not prove a replacement protocol safe or full Config fixed.'}
fs.writeFileSync(root+'/analysis.json',JSON.stringify(analysis,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({commands:analysis.commands,physicalRequests:analysis.physicalRequests,rows:rows.map(({run,wallMs,spawnMs,mainMaxTickMs})=>({run,wallMs,spawnMs,mainMaxTickMs}))}))
