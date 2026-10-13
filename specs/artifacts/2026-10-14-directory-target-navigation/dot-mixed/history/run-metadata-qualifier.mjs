import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
const scratch=path.resolve('.tmp-codex-directory-target-01a133')
const config=JSON.parse(fs.readFileSync(path.join(scratch,'native-metadata-qualifier.inputs.json'),'utf8'))
const mode=process.argv[2],host=process.argv[3]
if(!['syntax','run'].includes(mode)||!['node','bun'].includes(host))throw Error('Explicit mode/host required')
if(mode==='syntax'&&host!=='node')throw Error('Only the declared Node parser syntax check is planned')
const runtime=config.runtimes[host]
const args=mode==='syntax'?['--check',runtime.arguments[0]]:runtime.arguments
const prefix=path.join(scratch,'native-metadata-'+host+'-'+mode+'-original')
const input={mode,host,executable:runtime.executable,args,timeoutMs:30000,maxOutputBytes:8*1024*1024,qualification:'Direct single child/library ABI observation only; no NativeFacade or production loader/File API/UI acceptance',startedAtUtc:new Date().toISOString()}
fs.writeFileSync(prefix+'.input.json',JSON.stringify(input,null,2),{flag:'wx'})
const result=spawnSync(runtime.executable,args,{cwd:process.cwd(),windowsHide:true,timeout:input.timeoutMs,maxBuffer:input.maxOutputBytes,killSignal:'SIGTERM'})
fs.writeFileSync(prefix+'.stdout.bin',result.stdout??Buffer.alloc(0),{flag:'wx'})
fs.writeFileSync(prefix+'.stderr.bin',result.stderr??Buffer.alloc(0),{flag:'wx'})
const error=result.error?Object.fromEntries(Object.getOwnPropertyNames(result.error).map(key=>[key,result.error[key]])):null
const receipt={exitCode:result.status,signal:result.signal,pid:result.pid,error,stdoutBytes:result.stdout?.length??0,stderrBytes:result.stderr?.length??0,completedAtUtc:new Date().toISOString()}
fs.writeFileSync(prefix+'.exit.json',JSON.stringify(receipt,null,2),{flag:'wx'})
console.log(JSON.stringify({inputPath:prefix+'.input.json',receipt,originalBytePaths:[prefix+'.stdout.bin',prefix+'.stderr.bin']}))
process.exitCode=result.status===0&&!result.error?0:result.status??1
