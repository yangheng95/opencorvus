const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const stage=process.argv[2],mode=process.argv[3];assert(['before','after','final'].includes(stage));
const root=path.resolve('.tmp-codex-provider-post-save-01a133',stage),ready=JSON.parse(fs.readFileSync(root+'/ready.json','utf8'));
const auth=JSON.parse(fs.readFileSync(root+'/runtime/data/auth.json','utf8'));
const secrets=Object.values(auth).flatMap(x=>[x.info?.key,x.info?.access,x.info?.refresh]).filter(x=>typeof x==='string');
const mask=x=>JSON.parse(secrets.reduce((s,key)=>s.replaceAll(key,'[OWNED SAMPLE CREDENTIAL]'),JSON.stringify(x)));
const suffix='?directory='+encodeURIComponent(ready.project),mcp=root+'/runtime/data/mcp-auth.json';
const records=[];
const label=mode+'-'+Date.now();
async function call(route,method='GET',input){const res=await fetch('http://127.0.0.1:'+ready.port+route,{method,headers:input?{'content-type':'application/json'}:{},body:input?JSON.stringify(input):undefined});const body=await res.json();const record={route,method,input,status:res.status,requestID:res.headers.get('x-opencorvus-request-id'),body};records.push(mask(record));return record;}
async function main(){
 if(mode==='prepare'){
  const warm=await call('/config'+suffix,'PATCH',{username:'Owned receipt qualification'});assert.equal(warm.status,200);
  assert.equal(fs.existsSync(mcp),false,'Fresh owned fault input required');
  fs.writeFileSync(mcp,'{');
  const project=await call('/config'+suffix,'PATCH',{provider:{'owned-empty':{name:'Project committed receipt baseline'}}});
  assert.equal(project.status,409);assert.equal(project.body.name,'ProjectConfigCommittedReconcileError');assert.equal(project.body.data.committed,true);
  assert.equal(project.body.data.config.provider['owned-empty'].name,'Project committed receipt baseline');
  assert.equal(JSON.parse(fs.readFileSync(root+'/project/.opencorvus/opencorvus.jsonc','utf8')).provider['owned-empty'].name,'Project committed receipt baseline');
  const global=await call('/global/config','PATCH',{provider:{'owned-empty':{name:'Global committed receipt baseline'}}});
  assert.equal(global.status,409);assert.equal(global.body.name,'GlobalConfigCommittedReconcileError');assert.equal(global.body.data.committed,true);
  assert.equal(JSON.parse(fs.readFileSync(root+'/runtime/config/opencorvus.jsonc','utf8')).provider['owned-empty'].name,'Global committed receipt baseline');
 }else if(mode==='arm'){assert.equal(fs.existsSync(mcp),false);fs.writeFileSync(mcp,'{');records.push({mode:'arm',input:'Owned mcp-auth JSON syntax {',containsCredentials:false});}
 else if(mode==='restore'){
  assert.equal(fs.readFileSync(mcp,'utf8'),'{');fs.unlinkSync(mcp);records.push({mode:'restore',mcpAuthInput:'Fresh own missing file'});
  const project=await call('/config'+suffix,'PATCH',{username:'Owned restored reader qualification'});assert.equal(project.status,200);
  const global=await call('/global/config','PATCH',{username:'Owned restored global qualification'});assert.equal(global.status,200);
 } else throw Error('Unknown own fault mode');
 const catalog=await call('/global/providers');assert.equal(catalog.status,200);
 fs.writeFileSync(root+'/fault-'+label+'.json',JSON.stringify({label,boundary:'Actual public production HTTP, own malformed credential-free MCP input; no listener stub or browser interception',records},null,2)+'\n');
 console.log(JSON.stringify({stage,mode,responses:records.map(x=>({route:x.route,status:x.status,name:x.body?.name,committed:x.body?.data?.committed,requestID:x.requestID}))}));
}
main().catch(error=>{fs.writeFileSync(root+'/fault-'+label+'-failed.json',JSON.stringify({error:String(error),records},null,2));console.error(String(error));process.exitCode=1});
