const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve('.tmp-codex-provider-post-save-01a133/final'),ready=JSON.parse(fs.readFileSync(root+'/ready.json','utf8'));
const file=root+'/runtime/data/auth.json',mode=process.argv[2],ledger=root+'/auth-readonly-input.json';
const original=JSON.parse(fs.readFileSync(file,'utf8'));
const sample=original['owned-bootstrap'].info.key;
const secrets=Object.values(original).flatMap(x=>[x.info?.key,x.info?.access,x.info?.refresh]).filter(x=>typeof x==='string');
const mask=x=>JSON.parse(secrets.reduce((s,key)=>s.replaceAll(key,'[OWNED SAMPLE CREDENTIAL]'),JSON.stringify(x)));
async function main(){
 if(mode==='deny'){
  fs.writeFileSync(ledger,JSON.stringify({file,originalMode:fs.statSync(file).mode,ownerPID:ready.pid,scope:'Only fresh own fictional credential store'},null,2));
  fs.chmodSync(file,0o444);
  const res=await fetch('http://127.0.0.1:'+ready.port+'/auth/owned-auth-write-qualification',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({type:'api',key:sample})});
  const body=await res.json();const after=JSON.parse(fs.readFileSync(file,'utf8'));
  fs.writeFileSync(root+'/auth-readonly-qualification.json',JSON.stringify(mask({status:res.status,requestID:res.headers.get('x-opencorvus-request-id'),body,persistedCredential:after['owned-auth-write-qualification']?.info??null,boundary:'Actual production PUT against own readonly store; qualification only, not browser response substitution'}),null,2)+'\n');
  console.log(JSON.stringify({status:res.status,name:body.name,requestID:res.headers.get('x-opencorvus-request-id'),persistedType:after['owned-auth-write-qualification']?.info?.type??null}));
 }else if(mode==='restore'){
  const input=JSON.parse(fs.readFileSync(ledger,'utf8'));assert.equal(input.ownerPID,ready.pid);assert.equal(input.file,file);fs.chmodSync(file,input.originalMode);console.log('Own credential store permissions restored');
 }else throw Error('Unknown own auth fault mode');
}
main().catch(e=>{console.error(String(e));process.exitCode=1});
