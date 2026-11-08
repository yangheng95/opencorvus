import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import Ajv2020 from 'file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js'
const [phase,port]=process.argv.slice(2)
assert.ok(phase==='before'||phase==='after')
const root='C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b41'
const expected=JSON.parse(await fs.readFile(`${root}/${phase}-memory.json`,'utf8'))
const base=`http://127.0.0.1:${port}`
const doc=await(await fetch(`${base}/doc`)).json()
const ajv=new Ajv2020({strict:false,allErrors:true,validateFormats:false})
const results=[]
async function request(operation,path,schemaPath,method='GET',body){
 const response=await fetch(`${base}${path}`,{method,headers:{'x-opencorvus-directory':expected.project.worktree,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})
 const value=await response.json()
 assert.equal(response.status,200)
 const schema=doc.paths[schemaPath][method.toLowerCase()].responses['200'].content['application/json'].schema
 const validate=ajv.compile({...schema,components:doc.components})
 assert.equal(validate(value),true,JSON.stringify(validate.errors))
 results.push({operation,status:response.status,requestID:response.headers.get('x-opencorvus-request-id'),body:value,schemaValid:true})
 return value
}
const files=await request('panel.knowledge.memory.list','/panel/knowledge/memory','/panel/knowledge/memory')
assert.deepEqual(files.map(file=>file.id).sort(),expected.files.map(file=>file.id).sort())
for(const file of files){const original=expected.files.find(item=>item.id===file.id);assert.equal(file.title,original.title);assert.equal(file.timeUpdated,original.timeUpdated)}
const target=expected.files[0]
const detail=await request('panel.knowledge.memory.get',`/panel/knowledge/memory/${encodeURIComponent(target.id)}`,'/panel/knowledge/memory/{id}')
assert.equal(detail.file.id,target.id)
assert.equal(detail.content,'corvuslocale evidence: keep this original bilingual note. 保留原始笔记内容。')
const search=await request('panel.knowledge.memory.search','/panel/knowledge/memory/search','/panel/knowledge/memory/search','POST',{query:'corvuslocale',limit:20})
assert.equal(search.length,1);assert.equal(search[0].fileId,target.id);assert.equal(search[0].fileTitle,target.title);assert.equal(search[0].content,detail.content);assert.ok(search[0].score>0)
await fs.writeFile(`${root}/${phase}-tcp-schema-check.json`,JSON.stringify({phase,project:expected.project,results,qualification:'Real HTTP list/get/FTS only. UI accepted separately through manual interaction and personally viewed screenshots.'},null,2)+'\n')
console.log(JSON.stringify({phase,checks:results.length,statuses:results.map(item=>item.status),schemaValid:true,fileIDsExact:true,searchScore:search[0].score}))
