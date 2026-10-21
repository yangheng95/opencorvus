import fs from 'node:fs'
import assert from 'node:assert/strict'
const root=import.meta.dirname,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/config-source-order-520-final-read'
const ready=JSON.parse(fs.readFileSync(run+'/evidence/service-ready.json','utf8')),audit=JSON.parse(fs.readFileSync(run+'/evidence/provider-audit-current.json','utf8'))
assert.equal(audit.maximum,0);assert.equal(audit.actual,0);assert.equal(audit.exhausted,false)
const results=[]
for(const route of ['/config','/global/config']){const url=new URL(route,ready.receipt.url);url.searchParams.set('directory',run+'/project');const response=await fetch(url,{signal:AbortSignal.timeout(30000)});assert.equal(response.status,200);const data=await response.json();results.push({route,status:response.status,username:data.username,permissionMode:data.permission_mode,model:data.model,profile:data.prompt_profile?.active})}
fs.writeFileSync(root+'/final-read-config.json',JSON.stringify({at:new Date().toISOString(),occurrence:ready.occurrence,results,modelRequests:0,modelBudget:0,providerQualification:'None;complete public catalog only;no credentials',resourceDirectory:(run+'/runtime/config').toUpperCase()+'/.',boundary:'Actual final source/API/Windows case-equivalent explicit directory;global canonical read only'},null,2)+'\n',{flag:'wx'})
assert.deepEqual({username:results[0].username,mode:results[0].permissionMode},{username:'QA custom source 520',mode:'full_access'});assert.equal(results[1].permissionMode,'ask')
console.log(JSON.stringify({results,modelRequests:audit.actual}))
