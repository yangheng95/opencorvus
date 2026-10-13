const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const stage=process.argv[2],phase=process.argv[3];assert(['before','after','final'].includes(stage));assert(['before','after'].includes(phase));
const root=path.resolve('.tmp-codex-provider-empty-declarations-01a133',stage),ready=JSON.parse(fs.readFileSync(root+'/ready.json','utf8')),records=[];
(async()=>{
for(const scope of ['global','project']){
 const id='owned-protocol-'+scope,api='http://127.0.0.1:'+ready.participantPort+'/'+scope+'/v1',base={name:'Protocol '+scope,api};
 const route=scope==='global'?'/global/config':'/config?directory='+encodeURIComponent(ready.project);
 const file=scope==='global'?root+'/runtime/config/opencorvus.jsonc':root+'/project/.opencorvus/opencorvus.jsonc';
 const patch=async(label,definition,expected)=>{
  const response=await fetch('http://127.0.0.1:'+ready.port+route,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({provider:{[id]:definition}})});
  const body=await response.json(),source=JSON.parse(fs.readFileSync(file,'utf8')).provider?.[id];
  const record={scope,label,status:response.status,requestID:response.headers.get('x-opencorvus-request-id'),effective:body.provider?.[id]??body,source};
  records.push(record);fs.writeFileSync(root+'/protocol-'+phase+'.json',JSON.stringify({phase,boundary:'Actual production TCP, exact owned canonical source, fictional public markers and no credential fields',records},null,2)+'\n');
  assert.deepEqual({status:record.status,effective:record.effective,source},{status:200,effective:expected,source:expected});
 };
 await patch('create-empty',{...base,models:{},options:{metadata:{}}},phase==='after'?{...base,models:{},options:{metadata:{}}}:base);
 const normalized=phase==='after'?{...base,models:{}}:base;
 await patch('set-scalar',{options:{metadata:'previous'}},{...normalized,options:{metadata:'previous'}});
 await patch('scalar-to-empty',{options:{metadata:{}}},{...normalized,options:{metadata:phase==='after'?{}:'previous'}});
 await patch('remove-metadata',{options:{metadata:null}},{...normalized,options:{}});
 await patch('create-record-empty-member',{options:{metadata:{kept:'known',empty:{},removed:null}}},{...normalized,options:{metadata:phase==='after'?{kept:'known',empty:{}}:{kept:'known'}}});
 await patch('nested-delete',{options:{metadata:{nested:{removed:null}}}},{...normalized,options:{metadata:phase==='after'?{kept:'known',empty:{},nested:{}}:{kept:'known'}}});
}
console.log(JSON.stringify({stage,phase,qualifiedResponses:records.length,source:'exact canonical provider definitions'}));
})().catch(error=>{console.error(error);process.exitCode=1});
