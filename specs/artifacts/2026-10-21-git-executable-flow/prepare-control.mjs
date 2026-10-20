import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),revision='2963e80510616309b75f913560683bde54330c5f'
const files={'packages/opencorvus/src/project/project.ts':'project-before.ts','packages/opencorvus/src/util/git.ts':'git-before.ts'}
for(const [file,name]of Object.entries(files))fs.writeFileSync(root+'/'+name,execFileSync('git',['show',revision+':'+file],{cwd:repo}),{flag:'wx'})
let wrapper=fs.readFileSync(root+'/../live-sol-task-guidance-413.ts','utf8')
function replaceOnce(code,a,b){assert.equal(code.split(a).length,2,a.slice(0,95));return code.replace(a,b)}
wrapper=replaceOnce(wrapper,'const packageRoot = path.resolve(import.meta.dir, "../packages/opencorvus")','const packageRoot = "D:/myhexin-local/opencorvus/packages/opencorvus"')
wrapper=replaceOnce(wrapper,'maxRequests >= 1 && maxRequests <= 100','maxRequests >= 0 && maxRequests <= 100')
const start=wrapper.indexOf('    const preflight = await state.audit.preflight('),end=wrapper.indexOf('    if (qualificationKind !== "Task") return',start)
assert(start>0&&end>start)
const admitted=[
'    assert.equal(qualificationKind, "NativeService"); assert.equal(maxRequests, 0)',
'    const originalPreflightPath = "C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/git-executable-flow-492-before/evidence/preflight-ready.json"',
'    const originalPreflight = JSON.parse(await fs.readFile(originalPreflightPath,"utf8"))',
'    assert.equal(originalPreflight.preflight.actualModel,"gpt-6.1-sol"); assert.equal(originalPreflight.preflight.streaming,true)',
'    await publish("api-ready.json", {pid:process.pid, owner, occurrence, port, maxRequests, sessionID:originalPreflight.preflight.sessionID, projectedModel:admission.providerAPIModel, sourcePreflight:{path:originalPreflightPath,occurrence:originalPreflight.occurrence,owner:originalPreflight.owner}, boundary:"API-only control;no new model input,preflight,Session or outbound request;actual credential and projected model checked above. Original completed preflight is provenance,not a new owner request."})',
'',
].join('\n')
wrapper=wrapper.slice(0,start)+admitted+wrapper.slice(end)
fs.writeFileSync(root+'/api-wrapper.ts',wrapper,{flag:'wx'})
let launch=fs.readFileSync(root+'/launch.ps1','utf8')
launch=launch.replace("[ValidateSet('before','after')]","[ValidateSet('control-before','control-after')]")
launch=launch.replace("if($Stage -eq 'before'){18863}else{18865}","if($Stage -eq 'control-before'){18867}else{18869}")
launch=launch.replace('+1200000','+240000')
launch=launch.replace("try{\n Get-ChildItem Env:","$taskPreloads=@(); if($Stage -eq 'control-before'){$taskPreloads=@('--preload',\"$taskRepo/.tmp-product-iteration/git-executable-flow-492/before-loader.ts\")}\ntry{\n Get-ChildItem Env:")
launch=launch.replace('$taskBun $taskWrapper "$taskAuthority/auth.json"','$taskBun @taskPreloads "$taskRepo/.tmp-product-iteration/git-executable-flow-492/api-wrapper.ts" "$taskAuthority/auth.json"')
launch=launch.replace("'2' 'NativeService'","'0' 'NativeService'")
fs.writeFileSync(root+'/launch-control.ps1',launch,{flag:'wx'})
let checker=fs.readFileSync(root+'/check-config.ts','utf8')
checker=checker.replace("['before','after'].includes(stage)","['control-before','control-after'].includes(stage)").replace("stage==='before'?18863:18865","stage==='control-before'?18867:18869")
const originalHeader="const native=read(run+'/evidence/native-host-ready.json'),preflight=read(run+'/evidence/preflight-ready.json'),original=read(root+'/original-canonical-private.json'),canonical=run+'/runtime/config/opencorvus.jsonc'\nassert.equal(preflight.occurrence,native.occurrence);assert.equal(preflight.owner.pid,native.target.pid);assert.deepEqual({model:preflight.preflight.actualModel,stream:preflight.preflight.streaming},{model:'gpt-6.1-sol',stream:true})"
checker=replaceOnce(checker,originalHeader,"const native=read(run+'/evidence/native-host-ready.json'),api=read(run+'/evidence/api-ready.json'),original=read(root+'/original-canonical-private.json'),canonical=run+'/runtime/config/opencorvus.jsonc'\nassert.equal(api.occurrence,native.occurrence);assert.equal(api.owner.pid,native.target.pid);assert.equal(api.maxRequests,0);assert.equal(api.projectedModel,'gpt-6.1-sol')\nconst selectedSessionID=api.sessionID")
checker=checker.replaceAll('preflight.preflight.sessionID','selectedSessionID')
fs.writeFileSync(root+'/check-control.ts',checker,{flag:'wx'})
let checkerLaunch=fs.readFileSync(root+'/launch-checker.ps1','utf8')
checkerLaunch=checkerLaunch.replace("[ValidateSet('before','after')]","[ValidateSet('control-before','control-after')]").replace('check-config.ts','check-control.ts')
fs.writeFileSync(root+'/launch-control-checker.ps1',checkerLaunch,{flag:'wx'})
console.log('Immutable original source control and explicit zero-model API-only runner prepared')
