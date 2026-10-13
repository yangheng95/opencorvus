const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const stage=process.argv[2],scope=process.argv[3],id=process.argv[4],label=process.argv[5];
assert(['before','after','final'].includes(stage));assert(['global','project'].includes(scope));assert(/^[A-Za-z0-9_-]+$/.test(label));
const root=path.resolve('.tmp-codex-provider-empty-declarations-01a133',stage),ready=JSON.parse(fs.readFileSync(root+'/ready.json','utf8'));
const route=scope==='global'?'/global/config':'/config?directory='+encodeURIComponent(ready.project);
const file=scope==='global'?root+'/runtime/config/opencorvus.jsonc':root+'/project/.opencorvus/opencorvus.jsonc';
const source=JSON.parse(fs.readFileSync(file,'utf8'));
const secrets=Object.values(JSON.parse(fs.readFileSync(root+'/runtime/data/auth.json','utf8'))).flatMap(value=>[value.info?.key,value.info?.access,value.info?.refresh]).filter(value=>typeof value==='string');
const mask=value=>JSON.parse(secrets.reduce((body,key)=>body.replaceAll(key,'[OWNED SAMPLE CREDENTIAL]'),JSON.stringify(value)));
(async()=>{
 const response=await fetch('http://127.0.0.1:'+ready.port+route);assert.equal(response.status,200);const body=await response.json();
 const record={label,scope,id,status:response.status,requestID:response.headers.get('x-opencorvus-request-id'),effective:body.provider?.[id]??null,source:source.provider?.[id]??null,boundary:'Actual owned production TCP and exact canonical source; sample credential bytes masked'};
 fs.writeFileSync(root+'/inspect-'+label+'.json',JSON.stringify(mask(record),null,2)+'\n');
 if(process.argv[6])assert.deepEqual({effective:record.effective,source:record.source},JSON.parse(fs.readFileSync(process.argv[6],'utf8')));
 console.log(JSON.stringify(mask(record)));
})().catch(error=>{console.error(error);process.exitCode=1});
