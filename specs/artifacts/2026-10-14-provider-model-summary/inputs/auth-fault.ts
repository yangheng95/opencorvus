import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import {acquireProcessLock} from '../packages/opencorvus/src/util/process-lock'
import {Filesystem} from '../packages/opencorvus/src/util/filesystem'
const root=path.resolve('.tmp-codex-provider-model-summary-01a133/after')
const file=path.join(root,'runtime/data/auth.json'),signal=path.join(root,'auth-fault-restore')
assert.equal(await fs.realpath(file),file)
const release=await acquireProcessLock(file,{realpath:false})
const original=await fs.readFile(file,'utf8'),entries=JSON.parse(original)
assert.equal(Object.keys(entries).length,3)
assert.ok(Object.keys(entries).every(id=>id.startsWith('owned-summary-')))
const started=Date.now();let expired=false
try{
 await Filesystem.writeAtomic(file,'{',0o600)
 await fs.writeFile(path.join(root,'auth-fault-ready.json'),JSON.stringify({pid:process.pid,started,target:file,absoluteLimit:120000,boundary:'Original own fictional Auth retained only in memory; real canonical file syntax fault; no user credential'}))
 console.log('Own canonical fake Auth syntax fault ready')
 while(true){
  try{await fs.access(signal);break}catch{}
  if(Date.now()-started>=120000){expired=true;break}
  await Bun.sleep(50)
 }
}finally{
 await Filesystem.writeAtomic(file,original,0o600)
 await release()
 await fs.writeFile(path.join(root,'auth-fault-terminal.json'),JSON.stringify({pid:process.pid,started,at:Date.now(),expired,restored:true},null,2))
}
console.log('Own canonical fake Auth restored')
if(expired)process.exitCode=1
