const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const stage=process.argv[2],phase=process.argv[3];
assert(['before','after','final'].includes(stage));assert(['before','after'].includes(phase));
const root=path.resolve('.tmp-codex-config-diagnostics-01a133',stage),ready=JSON.parse(fs.readFileSync(path.join(root,'ready.json'),'utf8'));
const globalFile=path.join(root,'runtime/config/opencorvus.jsonc'),projectFile=path.join(root,'project/.opencorvus/opencorvus.jsonc');
const originalGlobal=fs.readFileSync(globalFile),originalProject=fs.readFileSync(projectFile);
for(const file of [globalFile,projectFile])fs.writeFileSync(path.join(path.dirname(file),'owned-diagnostic-note.txt'),'diagnostic-file-sample');
const records=[];
const inputs={literal:'diagnostic-literal-sample',env:'{env:OWNED_DIAGNOSTIC_VALUE}',file:'{file:owned-diagnostic-note.txt}'};
const expanded={literal:inputs.literal,env:'diagnostic-env-sample',file:'diagnostic-file-sample'};
const invalid=value=>JSON.stringify({username:value,provider:{'owned-bootstrap':{options:{apiKey:'diagnostic-literal-sample'}}}}).slice(0,-1);
const request=async(scope,method,catalog=false)=>{
 const url=new URL(catalog?(scope==='global'?'/global/providers':'/provider'):(scope==='global'?'/global/config':'/config'),`http://127.0.0.1:${ready.port}`);
 if(scope==='project')url.searchParams.set('directory',ready.project);
 const response=await fetch(url,{method,...(method==='PATCH'?{headers:{'content-type':'application/json'},body:JSON.stringify({username:'owned-diagnostic-patch'})}:{})});
 return {status:response.status,requestID:response.headers.get('x-opencorvus-request-id'),body:await response.json()};
};
(async()=>{
 try{
  for(const scope of ['global','project'])for(const kind of ['literal','env','file']){
   fs.writeFileSync(globalFile,originalGlobal);fs.writeFileSync(projectFile,originalProject);
   const source=scope==='global'?globalFile:projectFile;fs.writeFileSync(source,invalid(inputs[kind]));
   for(const method of ['GET','PATCH']){
    const result=await request(scope,method);assert.equal(result.status,500);assert.equal(result.body.name,'ConfigJsonError');
    if(phase==='before'){
     const expected=method==='GET'?expanded[kind]:inputs[kind];assert.equal(result.body.data.message.includes(expected),true);
    }else{
     const value=method==='GET'?expanded[kind]:inputs[kind];
     assert.deepEqual(result.body,{name:'ConfigJsonError',data:{path:source,message:`CloseBraceExpected at line 1, column ${invalid(value).length+1}`}});
    }
    records.push({scope,kind,method,...result});
   }
   const projection=await request(scope,'GET',true);assert.equal(projection.status,200);
   const catalog=scope==='global'?projection.body.catalog:projection.body;
   const issue=catalog.issues.find(item=>item.phase==='config.read');assert(issue);
   if(phase==='after')assert.equal(issue.message,`ConfigJsonError: CloseBraceExpected at line 1, column ${invalid(expanded[kind]).length+1}`);
   records.push({scope,kind,method:'GET providers',status:projection.status,requestID:projection.requestID,issues:catalog.issues});
  }
 }finally{
  fs.writeFileSync(globalFile,originalGlobal);fs.writeFileSync(projectFile,originalProject);
  fs.writeFileSync(path.join(root,`http-${phase}.json`),JSON.stringify({phase,boundary:'Actual production TCP; literal/env/file are fictional marker inputs; original owned sources restored',records},null,2));
 }
 const globalHealthy=await request('global','GET');const projectHealthy=await request('project','GET');assert.equal(globalHealthy.status,200);assert.equal(projectHealthy.status,200);
 fs.writeFileSync(path.join(root,`http-${phase}-recovered.json`),JSON.stringify({global:globalHealthy.status,project:projectHealthy.status,at:new Date().toISOString()},null,2));
 console.log(JSON.stringify({stage,phase,qualifiedResponses:records.length,recovered:{global:200,project:200}}));
})().catch(error=>{console.error(error);process.exitCode=1});
