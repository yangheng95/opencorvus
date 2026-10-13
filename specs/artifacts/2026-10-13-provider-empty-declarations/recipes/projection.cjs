const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const stage=process.argv[2],scope=process.argv[3],id=process.argv[4],label=process.argv[5];assert(['after','before','final'].includes(stage));assert(['global','project'].includes(scope));assert(/^[A-Za-z0-9_-]+$/.test(label));
const root=path.resolve('.tmp-codex-provider-empty-declarations-01a133',stage),ready=JSON.parse(fs.readFileSync(root+'/ready.json','utf8'));
(async()=>{
 const route=scope==='global'?'/global/providers':'/provider?directory='+encodeURIComponent(ready.project);
 const response=await fetch('http://127.0.0.1:'+ready.port+route);assert.equal(response.status,200);const body=await response.json(),catalog=scope==='global'?body.catalog:body,provider=catalog.all.find(value=>value.id===id);
 assert(provider);const observed={name:provider.name,modelIDs:Object.keys(provider.models).sort(),apiKeyConfigured:provider.apiKeyConfigured,connected:catalog.connected.includes(id)};
 if(process.argv[6])assert.deepEqual(observed,JSON.parse(fs.readFileSync(process.argv[6],'utf8')));
 const record={scope,id,label,status:response.status,requestID:response.headers.get('x-opencorvus-request-id'),observed,models:provider.models,issues:catalog.issues,boundary:'Actual production public catalog; current configured fact and derived runnable identities, no credential contents'};
 fs.writeFileSync(root+'/projection-'+label+'.json',JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({scope,id,...observed}));
})().catch(error=>{console.error(error);process.exitCode=1});
