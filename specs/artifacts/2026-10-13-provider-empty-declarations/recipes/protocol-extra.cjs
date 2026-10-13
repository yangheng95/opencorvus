const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve('.tmp-codex-provider-empty-declarations-01a133/after'),ready=JSON.parse(fs.readFileSync(root+'/ready.json','utf8')),records=[];
(async()=>{
for(const scope of ['global','project']){
 const id='owned-protocol-extra-'+scope,base={name:'Additional '+scope,api:'http://127.0.0.1:'+ready.participantPort+'/'+scope+'/v1',models:{}};
 const route=scope==='global'?'/global/config':'/config?directory='+encodeURIComponent(ready.project);
 const file=scope==='global'?root+'/runtime/config/opencorvus.jsonc':root+'/project/.opencorvus/opencorvus.jsonc';
 const patch=async(label,definition,expected)=>{
  const response=await fetch('http://127.0.0.1:'+ready.port+route,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({provider:{[id]:definition}})});
  const body=await response.json(),source=JSON.parse(fs.readFileSync(file,'utf8')).provider[id];
  records.push({scope,label,status:response.status,requestID:response.headers.get('x-opencorvus-request-id'),effective:body.provider?.[id]??body,source});
  fs.writeFileSync(root+'/protocol-extra.json',JSON.stringify({boundary:'Actual production TCP and exact owned source, no credential fields',records},null,2)+'\n');
  assert.deepEqual({status:response.status,effective:body.provider?.[id],source},{status:200,effective:expected,source:expected});
 };
 await patch('create-array',{...base,options:{metadata:['known','array']}},{...base,options:{metadata:['known','array']}});
 await patch('array-to-empty',{options:{metadata:{}}},{...base,options:{metadata:{}}});
 await patch('create-existing-record',{options:{metadata:{kept:'record member'}}},{...base,options:{metadata:{kept:'record member'}}});
 await patch('empty-patch-preserves-record',{options:{metadata:{}}},{...base,options:{metadata:{kept:'record member'}}});
}
console.log(JSON.stringify({qualifiedResponses:records.length,boundary:'Two canonical scopes; array replacement and existing-record preservation'}));
})().catch(error=>{console.error(error);process.exitCode=1});
