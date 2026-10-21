import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
const {installProcessShims}=await import('../../packages/opencorvus/src/runtime/shims');installProcessShims()
const {QueryScope}=await import('./buffered-client')
const root=import.meta.dir,cwd=path.join(process.env.OPENCORVUS_HOME!,'controlled command'),gate=path.join(cwd,'ack.json')
await fs.mkdir(cwd,{recursive:true})
const scope=new QueryScope(path.join(process.env.OPENCORVUS_HOME!,'queries'))
let value:any,terminal:any
try{value=await scope.run(process.execPath,[root+'/handshake-program.mjs',gate],cwd)}finally{terminal=await scope.close()}
await fs.writeFile(root+'/buffered-control-result.json',JSON.stringify({at:new Date().toISOString(),expected:{code:7,stdout:'early\nlate\n',stderr:'done 中文\n'},actual:{code:value.code,stdout:value.stdout.toString(),stderr:value.stderr.toString()},terminal,records:scope.records,modelRequests:0,queries:1,boundary:'Original490 buffered helper/client;real controlled target waits receiver ACK before exit;physical/output/request settle before positive assertion'},null,2)+'\n',{flag:'wx'})
assert.equal(value.code,7);assert.equal(value.stdout.toString(),'early\nlate\n');assert.equal(value.stderr.toString(),'done 中文\n')
