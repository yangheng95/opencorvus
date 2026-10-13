const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const stage=process.argv[2],scope=process.argv[3],mode=process.argv[4],input=path.resolve(process.argv[5]),label=process.argv[6];
assert(['before','after','final'].includes(stage));assert(['global','project'].includes(scope));assert(['config','project-name'].includes(mode));assert(/^[A-Za-z0-9_-]+$/.test(label));
const scratch=path.resolve('.tmp-codex-provider-empty-declarations-01a133');assert.equal(input.startsWith(scratch+path.sep),true);
const root=path.join(scratch,stage),ready=JSON.parse(fs.readFileSync(root+'/ready.json','utf8'));
const route=mode==='project-name'?'/project/current':scope==='global'?'/global/config':'/config';
const suffix=scope==='project'?'?directory='+encodeURIComponent(ready.project):'';
const secrets=Object.values(JSON.parse(fs.readFileSync(root+'/runtime/data/auth.json','utf8'))).flatMap(value=>[value.info?.key,value.info?.access,value.info?.refresh]).filter(value=>typeof value==='string');
const mask=value=>JSON.parse(secrets.reduce((body,key)=>body.replaceAll(key,'[OWNED SAMPLE CREDENTIAL]'),JSON.stringify(value)));
(async()=>{
 const payload=JSON.parse(fs.readFileSync(input,'utf8'));
 const response=await fetch('http://127.0.0.1:'+ready.port+route+suffix,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
 const record=mask({scope,mode,label,method:'PATCH',path:route,status:response.status,requestID:response.headers.get('x-opencorvus-request-id'),input:payload,body:await response.json(),boundary:'Actual isolated production HTTP mutation; only own fictional data; known sample credential bytes masked'});
 fs.writeFileSync(root+'/mutate-'+label+'.json',JSON.stringify(record,null,2)+'\n');assert.equal(response.status,Number(process.argv[7]??200));
 console.log(JSON.stringify({label,status:record.status,requestID:record.requestID,name:record.body.name??null}));
})().catch(error=>{console.error(error);process.exitCode=1});
