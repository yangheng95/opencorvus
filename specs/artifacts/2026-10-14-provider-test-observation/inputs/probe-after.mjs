import fs from 'node:fs'
const root='.tmp-codex-provider-test-observation-01a133/after'
const ready=JSON.parse(fs.readFileSync(root+'/ready.json','utf8')),origin='http://127.0.0.1:'+ready.port
const facts=[]
for(const [scope,path]of [['global','/global/providers/owned-zero/test'],['project','/provider/owned-zero/test?directory='+encodeURIComponent(ready.project)],['global-missing','/global/providers/owned-missing/test']]){
 const response=await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)})
 facts.push({scope,path,status:response.status,requestID:response.headers.get('x-opencorvus-request-id'),body:await response.json()})
}
const response=await fetch(origin+'/global/providers'),projection=await response.json()
const audit=JSON.parse(fs.readFileSync(root+'/provider-audit.json','utf8'))
const record={boundary:'Actual public HTTP preconditions after implementation; original frontend UI and genuine Sol qualification are separate',facts,catalog:{status:response.status,providers:projection.catalog.all.filter(p=>['openai','owned-zero','opencorvus'].includes(p.id)).map(p=>({id:p.id,models:Object.keys(p.models),apiKeyConfigured:p.apiKeyConfigured}))},audit:audit.requests.map(r=>({model:r.model,status:r.status,streaming:r.streaming,reader:r.response_reader.state,terminal:r.response_reader.terminal?.kind}))}
fs.writeFileSync(root+'/precondition-public-after.json',JSON.stringify(record,null,2)+'\n')
console.log(JSON.stringify(record))
