import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import Ajv2020 from 'file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js'
const [phase,port]=process.argv.slice(2)
assert.ok(phase==='before'||phase==='after')
const root='C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b45'
const original=JSON.parse(await fs.readFile(`${root}/${phase}-domain-probe.json`,'utf8'))
const base=`http://127.0.0.1:${port}`
const doc=await(await fetch(`${base}/doc`)).json()
const ajv=new Ajv2020({strict:false,allErrors:true,validateFormats:false})
const results=[]
async function request(operation,path,schemaPath,method='GET',body){
 const response=await fetch(`${base}${path}`,{method,headers:{'x-opencorvus-directory':original.project.worktree,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})
 const value=await response.json();assert.equal(response.status,200)
 const schema=doc.paths[schemaPath][method.toLowerCase()].responses['200'].content['application/json'].schema
 const validate=ajv.compile({...schema,components:doc.components});assert.equal(validate(value),true,JSON.stringify(validate.errors))
 results.push({operation,status:response.status,requestID:response.headers.get('x-opencorvus-request-id'),body:value,schemaValid:true})
 return value
}
const files=await request('List original files','/panel/knowledge/memory','/panel/knowledge/memory')
assert.deepEqual(files.map(file=>file.id).sort(),original.files.map(file=>file.id).sort())
const identity=result=>({chunkID:result.chunkId,fileID:result.fileId,title:result.fileTitle,content:result.content})
const stable=await request('Stable-key current search','/panel/knowledge/memory/search','/panel/knowledge/memory/search','POST',{query:'stablekeyprobe',limit:20})
assert.deepEqual(stable.map(identity),original.stableSearch.map(identity))
if(phase==='before'){
 const retry=await request('Both distinct retry identities','/panel/knowledge/memory/search','/panel/knowledge/memory/search','POST',{query:'retrykeyprobe',limit:20})
 assert.deepEqual(retry.map(identity),original.retrySearch.map(identity))
}
for(const file of original.files){
 const detail=await request(`Complete original file ${file.id}`,`/panel/knowledge/memory/${encodeURIComponent(file.id)}`,'/panel/knowledge/memory/{id}')
 assert.equal(detail.file.id,file.id);assert.equal(detail.file.title,file.title);assert.equal(detail.file.key,file.key);assert.equal(detail.content,file.content)
}
await fs.writeFile(`${root}/${phase}-tcp-schema-check.json`,JSON.stringify({phase,project:original.project,results,qualification:'Actual persisted read and search contracts. Invalid key writes are checked directly in the domain, not through a public HTTP write route.'},null,2)+'\n')
console.log(JSON.stringify({phase,checks:results.length,statuses:results.map(item=>item.status),schemaValid:true,files:files.length,stableFileID:stable[0].fileId,canonicalKey:original.canonicalCurrent.key}));
