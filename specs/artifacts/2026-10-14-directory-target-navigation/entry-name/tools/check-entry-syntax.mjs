import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
const scratch=path.resolve('.tmp-codex-directory-target-01a133')
for(const name of ['native-metadata-reader.mjs','canonical-entry-name-qualifier.mjs','run-dot-native.mjs']){
 const args=['--check',path.join(scratch,name)],prefix=path.join(scratch,'entry-syntax-'+name)
 const startedAt=new Date().toISOString(),result=spawnSync(process.execPath,args,{cwd:process.cwd(),windowsHide:true,timeout:30000,maxBuffer:4*1024*1024})
 fs.writeFileSync(prefix+'.stdout.bin',result.stdout,{flag:'wx'})
 fs.writeFileSync(prefix+'.stderr.bin',result.stderr,{flag:'wx'})
 fs.writeFileSync(prefix+'.exit.json',JSON.stringify({executable:process.execPath,args,startedAt,endedAt:new Date().toISOString(),status:result.status,signal:result.signal,error:result.error?Object.fromEntries(Object.getOwnPropertyNames(result.error).map(key=>[key,result.error[key]])):null,stdoutBytes:result.stdout.length,stderrBytes:result.stderr.length},null,2),{flag:'wx'})
 console.log(JSON.stringify({name,status:result.status,stdoutBytes:result.stdout.length,stderrBytes:result.stderr.length}))
 if(result.status!==0){process.exitCode=result.status??1;break}
}
