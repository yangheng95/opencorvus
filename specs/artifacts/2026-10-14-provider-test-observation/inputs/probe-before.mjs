import fs from 'node:fs';
const root='.tmp-codex-provider-test-observation-01a133/before';
const ready=JSON.parse(fs.readFileSync(root+'/ready.json','utf8'));
const origin='http://127.0.0.1:'+ready.port;
const facts=[];
for(const [scope,path]of [['global','/global/providers/owned-zero/test'],['project','/provider/owned-zero/test?directory='+encodeURIComponent(ready.project)],['global-missing','/global/providers/owned-missing/test']]){
 const response=await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
 facts.push({scope,path,status:response.status,requestID:response.headers.get('x-request-id'),body:await response.json()});
}
const catalogResponse=await fetch(origin+'/global/providers');
const catalog=await catalogResponse.json();
const audit=JSON.parse(fs.readFileSync(root+'/provider-audit.json','utf8'));
const record={boundary:'Actual public routes before implementation; saved-key presence and effective models are independent of config declarations; no mocked response',facts,catalog:{status:catalogResponse.status,providers:catalog.catalog.all.filter(p=>['openai','owned-zero'].includes(p.id)).map(p=>({id:p.id,models:Object.keys(p.models),apiKeyConfigured:p.apiKeyConfigured}))},audit:audit.requests.map(r=>({model:r.model,status:r.status,streaming:r.streaming,reader:r.response_reader.state,terminal:r.response_reader.terminal?.kind}))};
fs.writeFileSync(root+'/precondition-public-before.json',JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify(record));
