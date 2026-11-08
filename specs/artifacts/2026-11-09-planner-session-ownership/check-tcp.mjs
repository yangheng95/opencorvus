import fs from 'node:fs/promises';import assert from 'node:assert/strict';import Ajv2020 from 'file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js';
const directory='C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b36';
const observed=JSON.parse(await fs.readFile(`${directory}/after-observed.json`,'utf8'));
const base='http://127.0.0.1:38993';const doc=await(await fetch(`${base}/doc`)).json();
const schema=doc.paths['/experimental/task-plan'].get.responses['200'].content['application/json'].schema;
const validate=new Ajv2020({strict:false,allErrors:true,validateFormats:false}).compile({...schema,components:doc.components});
const results=[];
for(const [key,expected] of [['a',observed.aAfter],['b',observed.bAfter]]){
 const response=await fetch(`${base}/experimental/task-plan?sessionId=${encodeURIComponent(observed.sessions[key])}`,{headers:{'x-opencorvus-directory':directory+'/project-after'}});const body=await response.json();
 assert.equal(response.status,200);assert.equal(validate(body),true,JSON.stringify(validate.errors));assert.deepEqual(body,expected);
 const result={session:key,status:response.status,requestID:response.headers.get('x-opencorvus-request-id'),body,schemaValid:true,directToolPersistenceExact:true};results.push(result);
}
await fs.writeFile(`${directory}/after-taskplan-responses.json`,JSON.stringify({date:new Date().toISOString(),results},null,2)+'\n');console.log(JSON.stringify(results.map(({session,status,requestID,body,schemaValid,directToolPersistenceExact})=>({session,status,requestID,plans:body.length,schemaValid,directToolPersistenceExact}))));
