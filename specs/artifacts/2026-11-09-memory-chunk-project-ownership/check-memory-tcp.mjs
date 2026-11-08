import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import Ajv2020 from 'file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js'
const [phase,port]=process.argv.slice(2)
assert.ok(phase==='before'||phase==='after')
const root='C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b42'
const original=JSON.parse(await fs.readFile(`${root}/${phase}-domain-probe.json`,'utf8'))
const owner=original.projects.find(project=>project.role==='owner')
const caller=original.projects.find(project=>project.role==='caller')
const base=`http://127.0.0.1:${port}`
const doc=await(await fetch(`${base}/doc`)).json()
const ajv=new Ajv2020({strict:false,allErrors:true,validateFormats:false})
const results=[]
async function request(operation,path,schemaPath,project,status=200,method='GET',body){
 const response=await fetch(`${base}${path}`,{method,headers:{'x-opencorvus-directory':project.worktree,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})
 const value=await response.json();assert.equal(response.status,status)
 const schema=doc.paths[schemaPath][method.toLowerCase()].responses[String(status)].content['application/json'].schema
 const validate=ajv.compile({...schema,components:doc.components});assert.equal(validate(value),true,JSON.stringify(validate.errors))
 results.push({operation,project:{id:project.id,role:project.role,directory:project.worktree},status:response.status,requestID:response.headers.get('x-opencorvus-request-id'),body:value,schemaValid:true})
 return value
}
const list=await request('Caller list','/panel/knowledge/memory','/panel/knowledge/memory',caller)
assert.deepEqual(list.map(file=>file.id),[caller.file.id])
const search=await request('Caller search','/panel/knowledge/memory/search','/panel/knowledge/memory/search',caller,200,'POST',{query:'crosschunkprobe',limit:20})
assert.equal(search.length,1);assert.equal(search[0].fileId,phase==='before'?owner.file.id:caller.file.id);assert.equal(search[0].fileTitle,phase==='before'?owner.file.title:caller.file.title);assert.equal(search[0].content,original.callerSearch[0].content);assert.ok(search[0].score>0)
const ownerDetail=await request('Owner exact get',`/panel/knowledge/memory/${encodeURIComponent(owner.file.id)}`,'/panel/knowledge/memory/{id}',owner)
assert.equal(ownerDetail.content,owner.originalContent)
const callerDetail=await request('Caller exact get',`/panel/knowledge/memory/${encodeURIComponent(caller.file.id)}`,'/panel/knowledge/memory/{id}',caller)
assert.equal(callerDetail.content,phase==='before'?caller.originalContent:'crosschunkprobe: legitimate Caller knowledge belongs to its own original file.')
const foreignDetail=await request('Caller foreign identity error',`/panel/knowledge/memory/${encodeURIComponent(owner.file.id)}`,'/panel/knowledge/memory/{id}',caller,404)
assert.equal(foreignDetail.name,'NotFoundError');assert.equal(foreignDetail.data.message,`Memory file not found: ${owner.file.id}`)
await fs.writeFile(`${root}/${phase}-tcp-schema-check.json`,JSON.stringify({phase,results,qualification:'Actual scoped read/search/explicit error contracts. No public writeChunks endpoint; UI acceptance is separate manual interaction.'},null,2)+'\n')
console.log(JSON.stringify({phase,checks:results.length,statuses:results.map(item=>item.status),schemaValid:true,searchFileID:search[0].fileId,searchTitle:search[0].fileTitle}))
