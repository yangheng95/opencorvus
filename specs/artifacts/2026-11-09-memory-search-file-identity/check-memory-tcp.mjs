import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import Ajv2020 from 'file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js'
const [phase,port]=process.argv.slice(2)
assert.ok(phase==='before'||phase==='after')
const root='C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b43'
const original=JSON.parse(await fs.readFile(`${root}/${phase}-memory.json`,'utf8'))
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
const search=await request('Ranked original chunks','/panel/knowledge/memory/search','/panel/knowledge/memory/search','POST',{query:'multirowprobe',limit:20})
assert.equal(search.length,3);assert.equal(new Set(search.map(item=>item.fileId)).size,2)
const identity=result=>({chunkID:result.chunkId,fileID:result.fileId,title:result.fileTitle,content:result.content,score:result.score})
assert.deepEqual(search.map(identity),original.search.map(identity))
for(const file of original.files){
 const detail=await request(`Complete original file ${file.id}`,`/panel/knowledge/memory/${encodeURIComponent(file.id)}`,'/panel/knowledge/memory/{id}')
 assert.equal(detail.file.id,file.id);assert.equal(detail.file.title,file.title);assert.equal(detail.content,file.content)
}
await fs.writeFile(`${root}/${phase}-tcp-schema-check.json`,JSON.stringify({phase,project:original.project,results,qualification:'Actual HTTP preserves the original 3 ranked chunks, 2 file identities and both complete files. UI accepted separately through manual interaction.'},null,2)+'\n')
console.log(JSON.stringify({phase,checks:results.length,statuses:results.map(item=>item.status),schemaValid:true,rankedChunks:search.length,fileIdentities:new Set(search.map(item=>item.fileId)).size,firstMatch:identity(search[0])}))
