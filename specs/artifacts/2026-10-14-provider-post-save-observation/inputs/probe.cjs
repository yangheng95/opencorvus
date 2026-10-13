const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const stage=process.argv[2],scope=process.argv[3],id=process.argv[4],label=process.argv[5];
const root=path.resolve('.tmp-codex-provider-post-save-01a133',stage),ready=JSON.parse(fs.readFileSync(root+'/ready.json','utf8'));
const auth=JSON.parse(fs.readFileSync(root+'/runtime/data/auth.json','utf8'));
const secrets=Object.values(auth).flatMap(x=>[x.info?.key,x.info?.access,x.info?.refresh]).filter(x=>typeof x==='string');
const mask=x=>JSON.parse(secrets.reduce((s,key)=>s.replaceAll(key,'[OWNED SAMPLE CREDENTIAL]'),JSON.stringify(x)));
async function read(route){const r=await fetch('http://127.0.0.1:'+ready.port+route);assert.equal(r.status,200);return {status:r.status,requestID:r.headers.get('x-opencorvus-request-id'),body:await r.json()};}
async function main(){
 const suffix='?directory='+encodeURIComponent(ready.project);
 const config=await read(scope==='global'?'/global/config':'/config'+suffix);
 const response=await read(scope==='global'?'/global/providers':'/provider'+suffix);
 const catalog=scope==='global'?response.body.catalog:response.body;
 const p=catalog.all.find(x=>x.id===id);
 const source=JSON.parse(fs.readFileSync(scope==='global'?root+'/runtime/config/opencorvus.jsonc':root+'/project/.opencorvus/opencorvus.jsonc','utf8'));
 const record={scope,id,label,config:{status:config.status,requestID:config.requestID,provider:config.body.provider?.[id]??null,source:source.provider?.[id]??null},catalog:{status:response.status,requestID:response.requestID,provider:p?{id:p.id,name:p.name,modelIDs:Object.keys(p.models),apiKeyConfigured:p.apiKeyConfigured}:null,issues:catalog.issues},auth:{type:auth[id]?.info?.type??null,keyMatchesOwnedParticipant:auth[id]?.info?.key===auth['owned-bootstrap'].info.key},boundary:'Production TCP and exact own canonical source, known fictional credentials masked; no inference calls'};
 fs.writeFileSync(root+'/probe-'+label+'.json',JSON.stringify(mask(record),null,2)+'\n');
 if(process.argv[6]){const expected=JSON.parse(fs.readFileSync(process.argv[6],'utf8'));assert.deepEqual(record.catalog.provider,expected.catalog);if(expected.auth)assert.deepEqual(record.auth,expected.auth);if(expected.sourceName)assert.equal(record.config.source.name,expected.sourceName);}
 console.log(JSON.stringify(mask(record)));
}
main().catch(e=>{console.error(String(e));process.exitCode=1});
