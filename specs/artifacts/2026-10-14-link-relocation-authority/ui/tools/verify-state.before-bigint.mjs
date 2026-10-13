import fs from 'node:fs/promises'
import path from 'node:path'
import {createNativeMetadataReader} from '../native-metadata-reader.mjs'
import {loadFixture,loadOwner,observe,save,projects,runRoot,port,requireFact,stamp} from './fixture-support.mjs'
const [mode]=process.argv.slice(2)
requireFact(['before','after'].includes(mode),'Explicit readonly before/after mode required')
const fixture=await loadFixture(),owner=await loadOwner(fixture)
const result={mode,fixtureID:fixture.fixtureID,occurrence:owner.occurrence,startedAt:stamp(),sourceLinks:[],files:[],requests:[],copied:[]}
const input=JSON.parse(await fs.readFile(new URL('../canonical-entry-name.inputs.json',import.meta.url),'utf8'))
const reader=await createNativeMetadataReader(input,record=>console.log(JSON.stringify({type:'copy-reader-fact',record})))
for(const item of fixture.links){const actual=await observe(item.full),native=reader.readEntryName(item.full);requireFact(actual.entry.inode===item.original.entry.inode&&actual.entry.device===item.original.entry.device&&actual.entry.birthtimeNs===item.original.entry.birthtimeNs&&actual.readlink.text===item.original.readlink.text,'Original source link identity/text retained');requireFact(native.close?.status==='closed'&&native.query?.returnValue===1,'Actual original source native observation required');result.sourceLinks.push({path:item.path,actual,native})}
for(const item of fixture.files){const expected=item.path==='.gitignore'?Buffer.concat([Buffer.from(item.bytesBase64,'base64'),Buffer.from('.opencorvus/.r/\n')]):Buffer.from(item.bytesBase64,'base64'),actual=await fs.readFile(item.full);requireFact(actual.equals(expected),'Registered original literal bytes retained');result.files.push({path:item.path,role:item.role,bytesBase64:actual.toString('base64'),bytes:actual.length})}
async function get(role,route,key){
 const url=new URL(route,`http://127.0.0.1:${port}`);url.searchParams.set('directory',projects[role]);url.searchParams.set('path',key)
 const response=await fetch(url,{signal:AbortSignal.timeout(Math.min(20000,owner.nativeDeadline-Date.now()))}),bytes=Buffer.from(await response.arrayBuffer()),record={role,method:'GET',url:url.toString(),status:response.status,requestID:response.headers.get('x-opencorvus-request-id'),headers:Object.fromEntries(response.headers),rawBodyBase64:bytes.toString('base64'),body:JSON.parse(bytes.toString('utf8')),at:stamp()}
 result.requests.push(record);await save(`copy-${mode}-http-${String(result.requests.length).padStart(2,'0')}.json`,record);console.log(JSON.stringify({type:'copy-original-http',record}));requireFact(record.status===200&&typeof record.requestID==='string','Actual complete Server 200/request identity required');return record.body
}
await get('root','/file','');await get('b','/file','')
for(const [role,key] of [['root','root-marker.txt'],['root','data/marker.txt'],['root','source-tree/note.txt'],['b','root-marker.txt']]){const body=await get(role,'/file/content',key),literal=fixture.files.find(item=>item.role===role&&item.path===key);requireFact(body.type==='text'&&body.content===Buffer.from(literal.bytesBase64,'base64').toString('utf8'),'Actual original public marker text retained')}
if(mode==='after'){
 for(const [source,target,tag] of [['source-j','copied-j',0xa0000003],['source-s','copied-s',0xa000000c]]){
  const full=path.join(projects.root,target),actual=await observe(full),native=reader.readEntryName(full),original=fixture.links.find(item=>item.path===source)
  requireFact(actual.readlink.text===original.original.readlink.text&&actual.entry.symbolicLink===true,'Published actual original link text retained')
  requireFact(native.query?.returnValue===1&&native.close?.status==='closed'&&native.query.output.ReparseTag===tag&&(native.query.output.FileAttributes&16)!==0,'Published actual tag/directory creation type retained')
  const body=await get('root','/file/content',target+'/marker.txt'),literal=fixture.files.find(item=>item.role==='root'&&item.path==='data/marker.txt')
  requireFact(body.content===Buffer.from(literal.bytesBase64,'base64').toString('utf8'),'Copied alias reads actual full A marker')
  result.copied.push({source,target,actual,native})
 }
}
result.completedAt=stamp();result.qualification='Readonly physical/native/public API positive evidence; Root manual page alone performs copies; no UI automation or model request'
await save(`copy-${mode}-complete.json`,result)
console.log(JSON.stringify({type:'copy-state-complete',fixtureID:fixture.fixtureID,mode,requests:result.requests.length,sourceLinks:result.sourceLinks.length,copied:result.copied.length,runRoot}))
