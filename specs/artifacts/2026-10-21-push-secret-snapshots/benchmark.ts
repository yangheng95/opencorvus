import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dir,repo=path.resolve(root,'../..'),mode=process.env.OPENCORVUS_DIAGNOSTIC_LAUNCH_MODE!,run=process.env.OPENCORVUS_DIAGNOSTIC_LAUNCH_RUN!
assert(['before','after'].includes(mode));assert.match(run,/^[a-z0-9-]+$/)
assert.deepEqual(fs.readFileSync(repo+'/.git/index'),fs.readFileSync(root+'/index-before-private.bin'))
const cp=require('node:child_process'),original=cp.spawnSync,records:any[]=[]
cp.spawnSync=function(executable:string,args:string[],options:any){const at=performance.now(),result=Reflect.apply(original,this,[executable,args,options]);if(executable==='git')records.push({args,ms:performance.now()-at,status:result.status,inputObjects:options?.input?options.input.toString().trim().split(/\r?\n/).length:0,outputBytes:result.stdout?.length??0});return result}
require('node:module').syncBuiltinESMExports()
const scanner=await import(mode==='before'?'./secret-scan-before.ts':'../../script/secret-scan.ts')
const {currentRuntimeProcessOccurrence}=await import('../../packages/opencorvus/src/runtime/process-occurrence')
const owner=currentRuntimeProcessOccurrence(),head=original('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim()
assert.equal(head,'696cc64789091306bde46d93c7a43a436af8d8ce')
const indexEntries=scanner.listTrackedEntries(repo),indexedSnapshots=indexEntries.map((entry:any)=>({file:entry.file,objectId:entry.objectId,mode:entry.mode,size:entry.size}))
records.length=0
console.log(JSON.stringify({run,mode,event:'checker-started',head,indexedFiles:indexEntries.length,owner}))
const at=new Date().toISOString(),started=performance.now(),cpuStart=process.cpuUsage()
let hits:any[]
try{hits=scanner.scan(mode==='before'?{repoRoot:repo,refs:[head]}:{repoRoot:repo,pushUpdates:[{localRef:'refs/heads/main',localObjectId:head,remoteRef:'refs/heads/main',remoteObjectId:head}]})}
finally{cp.spawnSync=original;require('node:module').syncBuiltinESMExports()}
const wallMs=performance.now()-started,cpu=process.cpuUsage(cpuStart)
assert.deepEqual(fs.readFileSync(repo+'/.git/index'),fs.readFileSync(root+'/index-before-private.bin'));assert.deepEqual(hits,[])
const result={observedAt:new Date().toISOString(),startedAt:at,run,mode,runtime:Bun.version,head,owner,indexedFiles:indexEntries.length,indexedSnapshots,wallMs,parentCpuUserMs:cpu.user/1000,parentCpuSystemMs:cpu.system/1000,hits,gitCalls:records.length,blobQueries:records.filter(r=>r.args.includes('--batch')).reduce((sum,r)=>sum+r.inputObjects,0),blobOutputBytes:records.filter(r=>r.args.includes('--batch')).reduce((sum,r)=>sum+r.outputBytes,0),records,modelRequests:0,boundary:'Original real scanner core over same696cc6478 tree and exact index bytes. All selected real Git blobs,not file mocks;separate from UI/full Config qualification. Immutable source object identity used for dedup,not a mutable-source hash gate.'}
fs.writeFileSync(root+'/'+run+'-result.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
const{indexedSnapshots:_snapshots,records:_records,...summary}=result;console.log(JSON.stringify(summary))
