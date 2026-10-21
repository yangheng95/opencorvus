import fs from 'node:fs'
import assert from 'node:assert/strict'
const root=import.meta.dir,evidence='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/native-stream-reconnect-512-historical-service/evidence',taskID='tsk_g00VYhrJxy00qIC54qvM',origin='http://127.0.0.1:18949'
const observation=AbortSignal.timeout(20000),started=Date.now(),response=await fetch(`${origin}/task/${taskID}/events?directory=${encodeURIComponent('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/live-member-refresh-511-before/runtime/data/projects/2026/10/22/ebb75947-7467-434b-b3ec-aa7eea039f08')}&after=0`,{signal:observation})
assert.equal(response.status,200);assert(response.body)
const reader=response.body.getReader(),first=await reader.read();assert(first.value&&first.value.length>0)
fs.writeFileSync(evidence+'/network-arm.json',JSON.stringify({name:'calibration',taskID,timeoutSeconds:1})+'\n',{flag:'wx'})
let bytes=first.value.length,chunks=1,terminal:any
try{for(;;){const next=await reader.read();if(next.done){terminal={kind:'eof'};break}bytes+=next.value.length;chunks++}}catch(error){terminal={kind:'read-error',name:error instanceof Error?error.name:'unknown',message:error instanceof Error?error.message:String(error)}}finally{reader.releaseLock()}
const events=fs.readFileSync(evidence+'/network-events.jsonl','utf8').trim().split('\n').map(v=>JSON.parse(v)),applied=events.find(e=>e.kind==='native-idle-timeout-applied'&&e.name==='calibration'),abort=events.find(e=>e.kind==='native-request-abort'&&e.id===applied?.id)
const result={at:new Date().toISOString(),started,status:response.status,bytes,chunks,terminal,clientObservationTimeoutReached:observation.aborted,nativeApplied:applied,nativeAbort:abort,durationMs:Date.now()-started}
fs.writeFileSync(root+'/calibration.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result))
assert.equal(observation.aborted,false);assert.equal(applied?.seconds,1);assert.equal(abort?.kind,'native-request-abort')
