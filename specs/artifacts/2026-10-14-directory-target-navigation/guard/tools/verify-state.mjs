import fs from 'node:fs/promises'
import path from 'node:path'
import {runRoot,projects,port,stamp,factError,requireFact,loadFixture,loadOwner,observe,sameEntry,save} from './fixture-support.mjs'
const phase=process.argv[2]
requireFact(process.argv.length===3&&['before','after'].includes(phase),'Exact before/after read-only phase required')
const result={phase,startedAt:stamp(),requests:[],entries:[],files:[],mutationRequests:0,modelCalls:0}
console.log(JSON.stringify({type:'original-state-input',phase,runRoot,port,mutationRequests:0,modelCalls:0}))
try{
 const fixture=await loadFixture(),owner=await loadOwner(fixture)
 result.fixtureID=fixture.fixtureID;result.owner=owner
 await save('state-'+phase+'-admission.json',{phase,fixtureID:fixture.fixtureID,owner,at:stamp(),maximumHTTP:phase==='before'?6:10,qualification:'Read original owned state and real FileRoutes only; UI/mutations are performed separately by Root'})
 for(const item of fixture.links){
  const relative=phase==='after'&&item.path==='source-j'?'data/moved-j':phase==='after'&&item.path==='source-s'?'data/moved-s':item.path
  const current=await observe(path.join(projects.root,relative))
  result.entries.push({original:item,current})
  requireFact(sameEntry(current.entry,item.original.entry)&&current.entry.birthtimeNs===item.original.entry.birthtimeNs&&current.readlink.text===item.original.readlink.text,'Original entry identity/text changed: '+relative)
 }
 for(const item of fixture.files){
  const expected=item.path==='.gitignore'?Buffer.concat([Buffer.from(item.bytesBase64,'base64'),Buffer.from('.opencorvus/.r/\n')]):Buffer.from(item.bytesBase64,'base64')
  const current=await observe(item.full,true)
  result.files.push({original:item,expectedBytesBase64:expected.toString('base64'),current})
  requireFact(sameEntry(current.entry,item.original.entry)&&current.content.bytesBase64===expected.toString('base64'),'Original registered literal changed: '+item.path)
 }
 const plans=[{role:'root',route:'/file',file:''},{role:'b',route:'/file',file:''},
  ...fixture.files.filter(item=>item.path!=='.gitignore').map(item=>({role:item.role,route:'/file/content',file:item.path,literal:Buffer.from(item.bytesBase64,'base64').toString('utf8')})),
  ...(phase==='after'?[{role:'root',route:'/file',file:'alias-j'},{role:'root',route:'/file',file:'alias-s'},
   {role:'root',route:'/file/content',file:'alias-j/moved-j/marker.txt',literal:'GUARD DATA A 01a133\r\n'},
   {role:'root',route:'/file/content',file:'alias-s/moved-s/marker.txt',literal:'GUARD DATA A 01a133\r\n'}]:[])]
 for(const plan of plans){
  const url=new URL(plan.route,'http://127.0.0.1:'+port)
  url.searchParams.set('directory',projects[plan.role]);url.searchParams.set('path',plan.file)
  const record={plan,url:url.href,dispatchedAt:stamp()};result.requests.push(record)
  const response=await fetch(url,{signal:AbortSignal.timeout(Math.min(20000,owner.nativeDeadline-Date.now()))})
  const bytes=Buffer.from(await response.arrayBuffer())
  Object.assign(record,{status:response.status,headers:Object.fromEntries(response.headers),requestID:response.headers.get('x-opencorvus-request-id'),rawBodyBase64:bytes.toString('base64'),rawBody:bytes.toString('utf8'),completedAt:stamp()})
  record.body=JSON.parse(record.rawBody)
  await save('state-'+phase+'-http-'+String(result.requests.length).padStart(2,'0')+'.json',record)
  console.log(JSON.stringify({type:'original-state-http',record}))
  requireFact(record.status===200&&typeof record.requestID==='string','Original read response contract changed')
  if(plan.literal!==undefined)requireFact(record.body.type==='text'&&record.body.content===plan.literal,'Actual full content differs: '+plan.file)
  else{
   requireFact(Array.isArray(record.body),'Original File listing must be an array')
   if(plan.role==='root'&&plan.file===''){
    const names=['.opencorvus','context','data','source-tree','.gitattributes','.gitignore','alias-j','alias-s','root-marker.txt',...(phase==='before'?['source-j','source-s']:[])].sort()
    requireFact(JSON.stringify(record.body.map(item=>item.name).sort())===JSON.stringify(names),'Current complete root listing differs')
   }
   if(plan.file==='alias-j'||plan.file==='alias-s')for(const name of ['marker.txt','moved-j','moved-s'])requireFact(record.body.some(item=>item.name===name),'Current directory member missing: '+name)
  }
 }
 result.exitCode=0;result.outcome='original-owned-state-and-file-routes-qualified';result.completedAt=stamp()
}catch(error){result.exitCode=1;result.error=factError(error);result.failedAt=stamp();result.outcome='first-original-error-retained-no-retry'}
await save('state-'+phase+'-result.json',result)
console.log(JSON.stringify({phase,outcome:result.outcome,exitCode:result.exitCode,actualHTTP:result.requests.length,fixtureID:result.fixtureID}))
process.exitCode=result.exitCode
