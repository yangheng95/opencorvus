import fs from 'node:fs'
import assert from 'node:assert/strict'
const name=process.argv[2];assert(['before-cold','before-repeat'].includes(name));const stage=name.split('-')[0],root=import.meta.dirname,dir=root+'/'+name,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/config-current-validation-521-'+stage
const read=file=>JSON.parse(fs.readFileSync(file,'utf8')),ready=read(run+'/evidence/native-host-ready.json'),preflight=read(run+'/evidence/preflight-ready.json'),reader=read(dir+'/run-reader-ready.json'),writer=read(dir+'/run-checker-ready.json')
for(const value of [preflight,reader,writer])assert.equal(value.occurrence,ready.occurrence)
const files=fs.readdirSync(run+'/evidence').filter(name=>/^provider-.*-\d+\.json$/.test(name)).sort((a,b)=>Number(a.match(/-(\d+)\.json$/)[1])-Number(b.match(/-(\d+)\.json$/)[1]))
const audit=read(run+'/evidence/'+files.at(-1));assert.equal(audit.maxRequests,4);assert(audit.requests.length<=4&&!audit.exhausted)
for(const request of audit.requests){assert.equal(request.model,'gpt-6.1-sol');assert.equal(request.streaming,true);assert.equal(request.status,200);assert.equal(request.response_reader.terminal?.kind,'eof')}
const health=await fetch('http://127.0.0.1:'+(stage==='before'?18993:18995)+'/global/health');assert.equal(health.status,200);assert.equal((await health.json()).healthy,true)
const gate={at:new Date().toISOString(),occurrence:ready.occurrence,readerReady:reader,writerReady:writer,preflightSourceReaders:audit.requests.length,scope:'Only release real public HTTP checker after original preflight source EOF;no model instructions or routing gate'}
fs.writeFileSync(dir+'/run-write-start.json',JSON.stringify(gate,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({name,occurrence:ready.occurrence,sourceReaders:audit.requests.length,health:200}))
