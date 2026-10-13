import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
const project='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-13/explorer-after-01a133/project'
const expected={
 'source/audit-a.txt':'COPY A\r\n','source/audit-b.txt':'COPY B\r\n',
 'target/audit-a.txt':'COPY A\r\n','target/audit-b.txt':'EXISTING TARGET\r\n',
 'root-copy/root-copy-a.txt':'ROOT COPY A\r\n','root-copy/root-copy-b.txt':'ROOT COPY B\r\n',
 'root-copy-a.txt':'ROOT COPY A\r\n','root-copy-b.txt':'ROOT COPY B\r\n',
 'root-move-a.txt':'ROOT MOVE A\r\n','root-move-b.txt':'ROOT MOVE B\r\n',
}
const files=[]
for(const [file,content] of Object.entries(expected)){
 const physical=await fs.readFile(path.join(project,file))
 assert(physical.equals(Buffer.from(content)),'Exact authored bytes required: '+file)
 const response=await fetch('http://127.0.0.1:18440/file/content?'+new URLSearchParams({path:file,directory:project}),{signal:AbortSignal.timeout(15000)})
 const body=await response.json()
 assert.equal(response.status,200);assert.equal(body.type,'text');assert.equal(body.content,content);assert.equal(typeof body.revision,'string')
 files.push({file,bytes:physical.length,content,api:{status:response.status,type:body.type,content:body.content,revision:body.revision}})
}
const roots=[]
for(const action of ['copy','move','delete']){
 const query=new URLSearchParams({directory:project,...(action==='delete'?{path:'.'}:{})})
 const response=await fetch('http://127.0.0.1:18440/file/item'+(action==='copy'?'/copy':'')+'?'+query,{method:action==='delete'?'DELETE':action==='copy'?'POST':'PATCH',...(action==='delete'?{}:{headers:{'content-type':'application/json'},body:JSON.stringify({path:'.',newPath:'owned-root-result'})}),signal:AbortSignal.timeout(15000)})
 const body=await response.json()
 assert.equal(response.status,400)
 assert.deepEqual(body,{name:'FileInvalidPathError',data:{path:'.',message:`Cannot ${action} the project root from the file browser`}})
 roots.push({action,status:response.status,body})
}
assert.equal(await fs.readFile(path.join(project,'source/audit-a.txt'),'utf8'),'COPY A\r\n')
await fs.writeFile('specs/artifacts/2026-10-13-explorer-copy-convergence/after/after-physical-and-live-api.json',JSON.stringify({project,files,roots,boundary:'Actual 18440 /ui production server and exact authored bytes; no model messages or UI automation'},null,2)+'\n')
console.log(JSON.stringify({files:files.length,sourceRootErrors:roots.length,verified:true}))
