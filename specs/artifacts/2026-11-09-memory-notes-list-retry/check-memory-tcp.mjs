import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import Ajv2020 from 'file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js'
const [root,phase,port]=process.argv.slice(2)
assert.ok(phase==='before'||phase==='after')
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
for(const file of original.files){
 const detail=await request(`Complete original file ${file.id}`,`/panel/knowledge/memory/${encodeURIComponent(file.id)}`,'/panel/knowledge/memory/{id}')
 assert.equal(detail.file.id,file.id);assert.equal(detail.file.title,file.title);assert.equal(detail.content,file.content)
}
if (phase === 'after') {
 const query='northern trail marker'
 const result=await request('Exact note found by the real full-text index','/panel/knowledge/memory/search','/panel/knowledge/memory/search','POST',{query,limit:20})
 const target=original.files.find(file=>file.role==='target')
 assert.deepEqual(result.map(row=>({id:row.fileId,title:row.fileTitle,content:row.content})),[{id:target.id,title:target.title,content:target.content}])
}
await fs.writeFile(`${root}/${phase}-tcp-schema-check.json`,JSON.stringify({phase,project:original.project,results,qualification:'Actual HTTP preserves both original file identities and complete stored content. Desktop recovery is reviewed separately through manual interaction.'},null,2)+'\n')
console.log(JSON.stringify({phase,checks:results.length,statuses:results.map(item=>item.status),schemaValid:true,targetLines:original.files.find(file=>file.role==='target').content.split('\n').length}));
