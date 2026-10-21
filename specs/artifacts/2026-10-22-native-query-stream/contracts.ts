import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const {installProcessShims}=await import('../../packages/opencorvus/src/runtime/shims');installProcessShims()
const {StreamQueryScope}=await import('./stream-client')
const {handshakeObserver}=await import('./handshake-observer')
const {Process}=await import('../../packages/opencorvus/src/util/process')
const {observeRuntimeProcessOccurrence}=await import('../../packages/opencorvus/src/runtime/process-occurrence')
const root=import.meta.dir,run=process.env.OPENCORVUS_DIAGNOSTIC_LAUNCH_RUN!,runtime=process.env.OPENCORVUS_HOME!,cwd=path.join(runtime,'contracts space 中文')
await fs.mkdir(cwd,{recursive:true})
const maximum=run==='contracts-b'?12:13,scope=new StreamQueryScope(path.join(runtime,'queries'),maximum),facts:any[]=[]
let terminal:any,failure:any,settlementFailure:any,ordinaryQueries=0
const progress=setInterval(()=>console.log(JSON.stringify({run,completedContracts:facts.length,acceptedSettlements:scope.records.length,elapsed:'actual live diagnostic scope'})),5000)
const accept=(value:any,code=0)=>{assert.equal(value.code,code);assert.deepEqual(value.native_errors,[]);assert.equal(value.output_delivery_complete,true);return value}
try{
 const gate=path.join(cwd,'early-ack.json'),observer=handshakeObserver(gate,cwd)
 const early=accept(await scope.run(process.execPath,[root+'/handshake-program.mjs',gate],cwd,{onData:observer.onData}),7)
 assert.equal(early.stdout.toString(),'early\nlate\n');assert.equal(early.stderr.toString(),'done 中文\n')
 assert.equal(observer.facts.length,1);assert(observer.facts[0].receivedAt<early.receivedAt)
 facts.push({name:'Actual early bytes reach observer and ACK while exact target is live',observer:observer.facts,terminalReceivedAt:early.receivedAt,requestID:early.request.request_id})

 const binary=accept(await scope.run(process.execPath,['-e',"process.stdout.write(Buffer.from([0,1,127,128,255,10]));process.stderr.write('中文🙂\\n')"],cwd))
 assert(binary.stdout.equals(Buffer.from([0,1,127,128,255,10])));assert(binary.stderr.equals(Buffer.from('中文🙂\n')))
 facts.push({name:'Binary and Unicode dual-stream bytes preserve exact values',requestID:binary.request.request_id,stdout:binary.stdout.toJSON(),stderr:binary.stderr.toJSON()})

 const release=path.join(cwd,'slow-release.json')
 const slow=await scope.submit(process.execPath,['-e',`const fs=require('node:fs');process.stdout.write('slow-start\\n');const start=Date.now();const timer=setInterval(()=>{if(fs.existsSync(process.argv[1])){clearInterval(timer);process.stdout.write('slow-end\\n')}else if(Date.now()-start>5000){clearInterval(timer);process.exitCode=24}},10)`,release],cwd)
 const fast=accept(await scope.run(process.execPath,['-e',"process.stdout.write('fast-peer\\n')"],cwd))
 const slowReady=JSON.parse(await fs.readFile(slow.request.ready_file,'utf8'))
 const slowIdentity={pid:slowReady.target_pid,processInstanceID:slowReady.target_process_instance_id,occurrenceID:slow.request.request_id}
 assert.equal(observeRuntimeProcessOccurrence(slowIdentity),'exact_live')
 await fs.writeFile(release,JSON.stringify({fastRequestID:fast.request.request_id}),{flag:'wx'})
 const slowValue=accept(await slow.result);assert.equal(fast.stdout.toString(),'fast-peer\n');assert.equal(slowValue.stdout.toString(),'slow-start\nslow-end\n');assert(fast.receivedAt<slowValue.receivedAt)
 facts.push({name:'Fast peer completes while slow exact target and its own pipes remain live',fast:fast.request.request_id,slow:slow.request.request_id,slowIdentity,fastReceivedAt:fast.receivedAt,slowReceivedAt:slowValue.receivedAt})

 const [bad,good]=await Promise.all([
  scope.run(path.join(cwd,'missing-owned-command.exe'),[],cwd),
  scope.run(process.execPath,['-e',"process.stdout.write(process.env.GIT_CEILING_DIRECTORIES)"],cwd,{ceiling:cwd}),
 ])
 assert.equal(bad.code,null);assert.match(bad.native_errors[0],/CreateProcessW failed/);assert.equal(bad.streams.stdout.bytes,0);accept(good);assert.equal(good.stdout.toString(),cwd)
 facts.push({name:'Explicit pretarget CreateProcess failure and independent peer preserve their outcomes',failed:bad.request.request_id,error:bad.native_errors[0],peer:good.request.request_id})

 const cancellationFacts:any[]=[]
 const cancelled=await scope.submit(process.execPath,['-e',"process.stdout.write('cancel-ready\\n');setInterval(()=>{},1000)"],cwd,{onData(stream,bytes,input){
  if(stream==='stdout'&&bytes.equals(Buffer.from('cancel-ready\n'))){
   const ready=JSON.parse(fsSync.readFileSync(input.request.ready_file,'utf8'))
   const identity={pid:ready.target_pid,processInstanceID:ready.target_process_instance_id,occurrenceID:input.request.request_id}
   assert.equal(observeRuntimeProcessOccurrence(identity),'exact_live');fsSync.writeFileSync(input.request.cancel_file,input.request.request_id)
   cancellationFacts.push({identity,state:'exact_live',frame:input.frame})
  }
 }})
 const cancelPeer=accept(await scope.run(process.execPath,['-e',"process.stdout.write('cancel-peer-ok\\n')"],cwd))
 const cancelledValue=accept(await cancelled.result,1);assert.equal(cancelledValue.stdout.toString(),'cancel-ready\n');assert.equal(cancellationFacts.length,1);assert.equal(cancelPeer.stdout.toString(),'cancel-peer-ok\n')
 facts.push({name:'Live per-query cancellation settles its own Job and permits peer success',cancelled:cancelledValue.request.request_id,peer:cancelPeer.request.request_id,observations:cancellationFacts})

 const silent=accept(await scope.run(process.execPath,['-e','setInterval(()=>{},1000)'],cwd,{inactivity:700}),1)
 assert.equal(silent.error,'inactivity_timeout');assert.equal(silent.streams.stdout.bytes,0)
 facts.push({name:'Silent query has exact inactivity error and physical settlement',requestID:silent.request.request_id,error:silent.error})

 const active=accept(await scope.run(process.execPath,['-e',"let n=0;process.stdout.write('0');const timer=setInterval(()=>{process.stdout.write(String(++n));if(n===4)clearInterval(timer)},250)"],cwd,{inactivity:700}))
 assert.equal(active.stdout.toString(),'01234')
 const activityFrames=active.frames.filter((f:any)=>f.kind==='data');assert(activityFrames.at(-1).receivedAt-activityFrames[0].receivedAt>700)
 facts.push({name:'Actual incremental bytes refresh inactivity across a longer-running target',requestID:active.request.request_id,firstAt:activityFrames[0].receivedAt,lastAt:activityFrames.at(-1).receivedAt,error:active.error})

 const capped=accept(await scope.run(process.execPath,['-e',"process.stdout.write('x'.repeat(200000));setInterval(()=>{},1000)"],cwd,{maximum:1024}),1)
 assert.equal(capped.error,'output_limit');assert(capped.stdout.equals(Buffer.alloc(1024,'x')));assert.equal(capped.streams.stdout.bytes,1024)
 facts.push({name:'Exact retained-byte limit returns explicit output_limit and target settlement',requestID:capped.request.request_id,error:capped.error,retainedBytes:capped.stdout.length})

 const ordinary=await Process.runHost([process.execPath,'-e',"process.stdout.write('ordinary-out');process.stderr.write('ordinary-err')"],{cwd,stdin:'ignore',inactivityTimeoutMs:90000,maxOutputBytes:8*1024*1024});ordinaryQueries++
 assert.equal(ordinary.code,0);assert.equal(ordinary.stdout.toString(),'ordinary-out');assert.equal(ordinary.stderr.toString(),'ordinary-err')
 facts.push({name:'Original production Process.runHost single-request mode retains dual-stream output',code:ordinary.code,stdout:ordinary.stdout.toString(),stderr:ordinary.stderr.toString()})

 const eof=await scope.submit(process.execPath,['-e',"process.stdout.write('eof-start\\n');setTimeout(()=>{process.stdout.write('eof-end\\n');process.stderr.write('EOF 中文\\n')},300)"],cwd)
 const closing=scope.close();const eofValue=accept(await eof.result);terminal=await closing
 assert.equal(eofValue.stdout.toString(),'eof-start\neof-end\n');assert.equal(eofValue.stderr.toString(),'EOF 中文\n')
 facts.push({name:'Scope input EOF joins accepted target, original byte streams and request cleanup',requestID:eofValue.request.request_id,terminal})
}catch(error){failure=error}
finally{
 try{terminal=await scope.close()}catch(error){settlementFailure=error}
 clearInterval(progress)
 await fs.writeFile(root+'/'+run+'-result.json',JSON.stringify({at:new Date().toISOString(),facts,terminal,records:scope.records,failure:failure?{name:failure.name,message:failure.message}:null,settlementFailure:settlementFailure?{name:settlementFailure.name,message:settlementFailure.message}:null,ordinaryQueries,scopeQueries:scope.records.length,modelRequests:0,qualification:'Private incrementally observed collected-query API only;not public spawn/backpressure/stdin/env/general recovery or complete Config performance'},null,2)+'\n',{flag:'wx'})
}
if(failure)throw failure;if(settlementFailure)throw settlementFailure
console.log(JSON.stringify({positiveContracts:facts.length,scopeQueries:scope.records.length,ordinaryQueries,modelRequests:0,terminal}))
