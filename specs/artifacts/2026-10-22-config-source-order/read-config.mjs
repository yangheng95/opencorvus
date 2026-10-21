import fs from 'node:fs'
import assert from 'node:assert/strict'
const stage=process.argv[2],label=process.argv[3]??'initial';assert(['before','after'].includes(stage));assert(/^[a-z-]+$/.test(label))
const root=import.meta.dirname,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/config-source-order-520-'+stage,port=stage==='before'?18987:18989
const ready=JSON.parse(fs.readFileSync(run+'/evidence/preflight-ready.json','utf8'));assert.equal(ready.preflight.actualModel,'gpt-6.1-sol');assert.equal(ready.preflight.streaming,true)
const files=fs.readdirSync(run+'/evidence').filter(s=>/^provider-.*-\d+\.json$/.test(s)).sort((a,b)=>Number(a.match(/-(\d+)\.json$/)[1])-Number(b.match(/-(\d+)\.json$/)[1]))
const audit=JSON.parse(fs.readFileSync(run+'/evidence/'+files.at(-1),'utf8'));assert.equal(audit.maxRequests,4);assert(audit.requests.length<=4)
for(const request of audit.requests){assert.equal(request.model,'gpt-6.1-sol');assert.equal(request.streaming,true);assert.equal(request.status,200);assert.equal(request.response_reader.state,'settled');assert.equal(request.response_reader.terminal.kind,'eof')}
const results=[]
for(const pathname of ['/config','/global/config']){
 const url=new URL('http://127.0.0.1:'+port+pathname);url.searchParams.set('directory',run+'/project')
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});assert.equal(response.status,200)
 const config=await response.json();results.push({path:pathname,status:response.status,requestID:response.headers.get('x-request-id'),username:config.username,permissionMode:config.permission_mode,model:config.model,profile:config.prompt_profile?.active})
}
const canonical=JSON.parse(fs.readFileSync(run+'/runtime/config/opencorvus.jsonc','utf8'))
assert.equal(results[1].permissionMode,canonical.permission_mode)
fs.writeFileSync(root+'/'+stage+'-'+label+'-config.json',JSON.stringify({at:new Date().toISOString(),stage,label,occurrence:ready.occurrence,preflight:ready.preflight,actualRequests:audit.requests.length,maximumRequests:4,canonical:'Read-only original global source retained',custom:JSON.parse(fs.readFileSync(run+'/custom.jsonc','utf8')),results},null,2)+'\n',{flag:'wx'})
if(label==='initial')assert.deepEqual({username:results[0].username,mode:results[0].permissionMode},stage==='before'?{username:canonical.username||'QA custom source 520',mode:'ask'}:{username:'QA custom source 520',mode:'full_access'})
if(label==='project-override'){
 assert.deepEqual({username:results[0].username,mode:results[0].permissionMode},{username:'QA custom source 520',mode:'ask'})
 const project=JSON.parse(fs.readFileSync(run+'/project/.opencorvus/opencorvus.jsonc','utf8'))
 assert.equal(project.permission_mode,'ask');assert.equal(project.prompt_profile.active,'base')
 assert.equal(JSON.parse(fs.readFileSync(run+'/custom.jsonc','utf8')).permission_mode,'full_access')
}
console.log(JSON.stringify({stage,label,results,actualRequests:audit.requests.length}))
