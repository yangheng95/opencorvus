import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=repo+'/specs/artifacts/2026-10-22-offline-location-recovery'
const plan=JSON.parse(fs.readFileSync(root+'/scope-plan.json','utf8'))
const auth=JSON.parse(fs.readFileSync('C:/Users/hengu/.codex/auth.json','utf8'))
const secrets=[auth.OPENAI_API_KEY,auth.tokens?.id_token,auth.tokens?.access_token,auth.tokens?.refresh_token].filter(value=>typeof value==='string'&&value.length>=20)
const serverFailures=[],projectErrors=[],clientErrors=[],other=[]
let total=0
for(const stage of Object.keys(plan.ports)){
 const file=plan.base+'/'+plan.scope+'-'+stage+'/runtime/log/dev.log'
 for(const row of fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line))){
  if(row.level!=='error')continue
  total++
  const data=row.data??{},error=data.error
  if(row.service==='server'&&row.message==='request failed')serverFailures.push({stage,time:row.time,requestID:data.requestID,path:data.path,statusCode:data.statusCode,error:{type:error?.type,name:error?.name,message:error?.message,data:error?.data}})
  else if(row.service==='project.open')projectErrors.push({stage,time:row.time,stageName:data.stage,error})
  else if(row.service==='overlay:ui'||row.service==='overlay:project-load')clientErrors.push({stage,time:row.time,service:row.service,message:row.message,diagnosticID:data.diagnosticID,error,details:data.details})
  else other.push({stage,time:row.time,service:row.service,message:row.message,keys:Object.keys(data)})
 }
}
const result={at:new Date().toISOString(),total,serverFailures,projectErrors,clientErrors,other,scope:'All actual error entries;typed server failures and original caller error text;no full runtime log or credentials exported',qualification:'No model catalog or credentials staged;read-only navigation qualification;Provider availability not qualified'}
const text=JSON.stringify(result,null,2)+'\n'
assert.equal(secrets.filter(secret=>text.includes(secret)).length,0,'Actual credentials detected in runtime error observation')
fs.writeFileSync(root+'/runtime-error-observation.json',text,{flag:'wx'})
fs.copyFileSync(root+'/runtime-error-observation.json',out+'/runtime-error-observation.json',fs.constants.COPYFILE_EXCL)
fs.copyFileSync(root+'/observe-errors.mjs',out+'/observe-errors.mjs',fs.constants.COPYFILE_EXCL)
console.log(JSON.stringify({total,serverFailureTypes:Object.fromEntries([...new Set(serverFailures.map(row=>row.error.name))].map(name=>[name,serverFailures.filter(row=>row.error.name===name).length])),statuses:[...new Set(serverFailures.map(row=>row.statusCode))],projectMessages:[...new Set(projectErrors.map(row=>row.error))],other}))
