import fs from 'node:fs/promises'
import path from 'node:path'
import {createNativeMetadataReader} from '../native-metadata-reader.mjs'
import {loadFixture,loadOwner,observe,save,projects,port,requireFact,stamp,sameEntry} from './fixture-support.mjs'
const [phase]=process.argv.slice(2)
requireFact(['before','after'].includes(phase),'Exact readonly phase required')
const fixture=await loadFixture(),owner=await loadOwner(fixture),result={phase,fixtureID:fixture.fixtureID,occurrence:owner.occurrence,startedAt:stamp(),sourceLinks:[],files:[],requests:[],published:[]}
const stringify=value=>JSON.stringify(value,(_key,item)=>typeof item==='bigint'?{type:'bigint',value:String(item)}:item)
const emit=value=>console.log(stringify(value))
const input=JSON.parse(await fs.readFile(new URL('../canonical-entry-name.inputs.json',import.meta.url),'utf8'))
const reader=await createNativeMetadataReader(input,record=>emit({type:'relocation-reader-fact',record}))
for(const item of fixture.links){
 const relative=phase==='after'&&item.path==='source-s'?'alias-s/allowed-move':item.path
 const full=path.join(projects.root,relative),actual=await observe(full),native=reader.readEntryName(full)
 requireFact(sameEntry(actual.entry,item.original.entry)&&actual.readlink?.text===item.original.readlink?.text,'Original link occurrence and text retained at explicit location')
 requireFact(native.close?.status==='closed'&&native.query?.returnValue===1&&native.failures.length===0,'Original actual native observation required')
 result.sourceLinks.push({originalPath:item.path,actualPath:relative,actual,native})
}
for(const item of fixture.files){
 const expected=item.path==='.gitignore'?Buffer.concat([Buffer.from(item.bytesBase64,'base64'),Buffer.from('.opencorvus/.r/\n')]):Buffer.from(item.bytesBase64,'base64')
 const actual=await fs.readFile(item.full);requireFact(actual.equals(expected),'Original registered complete bytes retained')
 result.files.push({role:item.role,path:item.path,bytes:actual.length,bytesBase64:actual.toString('base64')})
}
async function get(role,route,key,status=200){
 const url=new URL(route,`http://127.0.0.1:${port}`);url.searchParams.set('directory',projects[role]);url.searchParams.set('path',key)
 const response=await fetch(url,{signal:AbortSignal.timeout(Math.min(20000,owner.nativeDeadline-Date.now()))}),bytes=Buffer.from(await response.arrayBuffer())
 const record={role,method:'GET',url:url.toString(),status:response.status,requestID:response.headers.get('x-opencorvus-request-id'),headers:Object.fromEntries(response.headers),rawBodyBase64:bytes.toString('base64'),body:JSON.parse(bytes.toString('utf8')),at:stamp()}
 result.requests.push(record);await save(`relocation-${phase}-http-${String(result.requests.length).padStart(2,'0')}.json`,record);emit({type:'relocation-original-http',record})
 requireFact(record.status===status&&typeof record.requestID==='string','Actual complete Server response contract/request identity required')
 if(status===404)requireFact(record.body.name==='FileNotFoundError'&&record.body.data.path===key,'Precise public missing-path contract required')
 return record.body
}
await get('root','/file','');await get('b','/file','')
for(const [role,key] of [['root','root-marker.txt'],['root','data/marker.txt'],['root','source-tree/note.txt'],['b','root-marker.txt'],['root','project-b/root-marker.txt'],['root','context/relative/root-marker.txt']]){
 const body=await get(role,'/file/content',key),literal=fixture.files.find(item=>item.role===role&&item.path===(key==='context/relative/root-marker.txt'?'project-b/root-marker.txt':key))
 requireFact(body.type==='text'&&body.content===Buffer.from(literal.bytesBase64,'base64').toString('utf8'),'Actual complete original public content retained')
}
if(phase==='after'){
 for(const [source,target,tag] of [['source-j','copied-j',0xa0000003],['source-s','alias-s/allowed-move',0xa000000c]]){
  const full=path.join(projects.root,target),actual=await observe(full),native=reader.readEntryName(full),original=fixture.links.find(item=>item.path===source)
  requireFact(actual.readlink.text===original.original.readlink.text&&actual.entry.symbolicLink===true,'Published actual text and entry contract retained')
  requireFact(native.query?.returnValue===1&&native.close?.status==='closed'&&native.query.output.ReparseTag===tag&&(native.query.output.FileAttributes&16)!==0,'Published actual creation type/directory flag retained')
  const body=await get('root','/file/content',target+'/marker.txt'),literal=fixture.files.find(item=>item.role==='root'&&item.path==='data/marker.txt')
  requireFact(body.content===Buffer.from(literal.bytesBase64,'base64').toString('utf8'),'Published aliases read complete original A content')
  result.published.push({source,target,actual,native})
 }
 await get('root','/file/content','source-s/marker.txt',404)
}
result.completedAt=stamp();result.qualification='Readonly Native/physical/public positive qualification; Root manually owns all mutations and visual review, no UI automation or model request'
await save(`relocation-${phase}-complete.json`,result);emit({type:'relocation-state-complete',phase,fixtureID:fixture.fixtureID,requests:result.requests.length,published:result.published.length})
