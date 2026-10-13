const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve('.tmp-codex-provider-post-save-01a133/final'),ready=JSON.parse(fs.readFileSync(root+'/ready.json','utf8'));
const secrets=Object.values(JSON.parse(fs.readFileSync(root+'/partial-read-input/auth.json','utf8'))).flatMap(x=>[x.info?.key,x.info?.access,x.info?.refresh]).filter(x=>typeof x==='string');
const mask=x=>JSON.parse(secrets.reduce((s,key)=>s.replaceAll(key,'[OWNED SAMPLE CREDENTIAL]'),JSON.stringify(x)));
async function main(){const records=[];assert.equal(fs.readFileSync(root+'/runtime/data/auth.json','utf8'),'{');
 for(const route of ['/global/config','/global/providers','/global/providers/auth']){const r=await fetch('http://127.0.0.1:'+ready.port+route);records.push(mask({route,status:r.status,requestID:r.headers.get('x-opencorvus-request-id'),body:await r.json()}));}
 const source=JSON.parse(fs.readFileSync(root+'/runtime/config/opencorvus.jsonc','utf8'));assert.equal(source.provider['owned-global-partial'].name,'Owned partial-read publication');
 assert.equal(records[0].status,200);assert.equal(records[1].status,200);assert.equal(records[2].status,200);
 assert.deepEqual(records[1].body.catalog.issues.map(x=>({phase:x.phase,message:x.message})),[{phase:'auth.read',message:'AuthReadError: Saved Provider credentials contain malformed JSON'}]);
 fs.writeFileSync(root+'/partial-read-http.json',JSON.stringify({boundary:'Actual production GET replies under own post-publication malformed Auth; committed source and partial projection remain distinct',sourceProvider:source.provider['owned-global-partial'],records},null,2)+'\n');
 console.log(JSON.stringify({sourceProvider:source.provider['owned-global-partial'],responses:records.map(x=>({route:x.route,status:x.status,issues:x.body.catalog?.issues,requestID:x.requestID}))}));}
 main().catch(e=>{console.error(String(e));process.exitCode=1});
