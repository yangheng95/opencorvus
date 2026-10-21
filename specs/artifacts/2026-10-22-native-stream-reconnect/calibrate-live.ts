import fs from 'node:fs'
import assert from 'node:assert/strict'
const root=import.meta.dir,evidence='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/native-stream-reconnect-512-live/evidence',taskID='tsk_g00VYhrJxy00qIC54qvM',origin='http://127.0.0.1:18951'
const observation=AbortSignal.timeout(20000),started=Date.now(),response=await fetch(origin+'/task/'+taskID+'/events?directory='+encodeURIComponent('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/live-member-refresh-511-before/runtime/data/projects/2026/10/22/ebb75947-7467-434b-b3ec-aa7eea039f08')+'&after=0',{signal:observation})
assert.equal(response.status,200);assert(response.body)
const reader=response.body.getReader(),first=await reader.read();assert(first.value&&first.value.length>0)
fs.writeFileSync(evidence+'/network-arm.json',JSON.stringify({name:'calibration',taskID,mode:'response-error'})+'\n',{flag:'wx'})
let bytes=first.value.length,chunks=1,terminal:any
try{for(;;){const next=await reader.read();if(next.done){terminal={kind:'eof'};break}bytes+=next.value.length;chunks++}}catch(error){terminal={kind:'read-error',name:error instanceof Error?error.name:'unknown',message:error instanceof Error?error.message:String(error)}}finally{reader.releaseLock()}
const readEvents=()=>fs.readFileSync(evidence+'/network-events.jsonl','utf8').trim().split('\n').map(v=>JSON.parse(v))
let events=readEvents(),applied=events.find(e=>e.kind==='response-transport-error-applied'&&e.name==='calibration'),pipe=events.find(e=>e.kind==='original-response-pipe-cancellation-settled'&&e.id===applied?.id)
const waitStarted=Date.now()
while(!pipe&&Date.now()-waitStarted<1500){await Bun.sleep(25);events=readEvents();pipe=events.find(e=>e.kind==='original-response-pipe-cancellation-settled'&&e.id===applied?.id)}
const result={at:new Date().toISOString(),started,status:response.status,bytes,chunks,terminal,clientObservationTimeoutReached:observation.aborted,transportApplied:applied,upstreamCancellation:pipe,nativeAbort:events.find(e=>e.kind==='native-request-abort'&&e.id===applied?.id),durationMs:Date.now()-started}
fs.writeFileSync(root+'/live-calibration.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result))
assert.equal(terminal.kind,'read-error');assert.equal(terminal.name,'TypeError');assert.equal(applied?.kind,'response-transport-error-applied');assert.equal(pipe?.kind,'original-response-pipe-cancellation-settled')
