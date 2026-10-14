import fs from 'node:fs/promises'
import path from 'node:path'
import {createNativeMetadataReader} from '../native-metadata-reader.mjs'
import {loadFixture,loadOwner,observe,save,projects,port,requireFact,stamp,sameEntry} from './fixture-support.mjs'
const [phase]=process.argv.slice(2)
requireFact(process.argv.length===3&&['before','after'].includes(phase),'Exact readonly browse phase required')
const fixture=await loadFixture(),owner=await loadOwner(fixture)
const result={phase,fixtureID:fixture.fixtureID,occurrence:owner.occurrence,startedAt:stamp(),links:[],files:[],requests:[],published:[]}
const stringify=value=>JSON.stringify(value,(_key,item)=>typeof item==='bigint'?{type:'bigint',value:String(item)}:item)
const emit=value=>console.log(stringify(value))
const input=JSON.parse(await fs.readFile(new URL('../canonical-entry-name.inputs.json',import.meta.url),'utf8'))
const reader=await createNativeMetadataReader(input,record=>emit({type:'browse-native-original',record}))
for(const item of [...fixture.links,...fixture.extraLinks]){
 const relative=phase==='after'&&item.path==='source-s'?'renamed-s':item.path
 const full=path.join(projects[item.role],relative),actual=await observe(full),native=reader.readEntryName(full)
 result.links.push({originalPath:item.path,actualPath:relative,actual,native})
 requireFact(sameEntry(actual.entry,item.original.entry)&&actual.readlink?.text===item.original.readlink?.text,'Original link identity/text retained at declared location')
 requireFact(native.close?.status==='closed'&&native.query?.returnValue===1&&native.failures.length===0,'Actual native link observation required')
}
for(const item of fixture.files){
 const relative=phase==='after'&&item.path==='source-tree/note.txt'?'data/moved-note.txt':item.path
 const full=path.join(projects[item.role],relative)
 const expected=item.path==='.gitignore'?Buffer.concat([Buffer.from(item.bytesBase64,'base64'),Buffer.from('.opencorvus/.r/\n')]):Buffer.from(item.bytesBase64,'base64')
 const actual=await observe(full,true)
 requireFact(sameEntry(actual.entry,item.original.entry)&&actual.content?.bytesBase64===expected.toString('base64'),'Original file identity/complete registered bytes retained')
 result.files.push({role:item.role,originalPath:item.path,actualPath:relative,actual})
}
for(const item of fixture.pickerInputs){const actual=await observe(item.full,true);requireFact(sameEntry(actual.entry,item.original.entry)&&actual.content?.bytesBase64===item.bytesBase64,'Original picker literal retained');result.files.push({role:'picker',actual})}
async function get(role,route,key){
 const url=new URL(route,`http://127.0.0.1:${port}`);url.searchParams.set('directory',projects[role]);url.searchParams.set('path',key)
 const response=await fetch(url,{signal:AbortSignal.timeout(Math.min(20000,owner.nativeDeadline-Date.now()))}),bytes=Buffer.from(await response.arrayBuffer())
 const record={role,method:'GET',url:url.toString(),status:response.status,requestID:response.headers.get('x-opencorvus-request-id'),headers:Object.fromEntries(response.headers),rawBodyBase64:bytes.toString('base64'),body:JSON.parse(bytes.toString('utf8')),at:stamp()}
 result.requests.push(record);await save(`browse-${phase}-http-${String(result.requests.length).padStart(2,'0')}.json`,record);emit({type:'browse-original-http',record})
 requireFact(record.status===200&&typeof record.requestID==='string','Actual complete Server200 and request identity required');return record.body
}
const nodes=await get('root','/file','')
for(const item of fixture.links){const name=phase==='after'&&item.path==='source-s'?'renamed-s':item.path;if(name.includes('/'))continue;const node=nodes.find(node=>node.name===name);requireFact(node?.type==='file'&&node.directoryTarget===(item.path!=='outside-alias'),'Original entry type and explicit current target fact required')}
for(const name of ['file-alias','broken-alias'])requireFact(nodes.find(node=>node.name===name)?.directoryTarget===false,'Explicit nondirectory target fact required')
await get('b','/file','')
const content=async(role,key,literal)=>{const body=await get(role,'/file/content',key);requireFact(body.type==='text'&&body.content===literal,'Complete public content contract required')}
await content('root','alias-j/marker.txt',Buffer.from(fixture.files.find(item=>item.path==='data/marker.txt').bytesBase64,'base64').toString('utf8'))
await content('b','root-marker.txt',Buffer.from(fixture.files.find(item=>item.role==='b'&&item.path==='root-marker.txt').bytesBase64,'base64').toString('utf8'))
if(phase==='after'){
 for(const key of ['alias-j','alias-s','renamed-s','alias-j/new-folder'])await get('root','/file',key)
 const expected=[
  ['alias-j/new-note.txt',''],
  ['alias-s/browser-upload.txt',Buffer.from(fixture.pickerInputs[0].bytesBase64,'base64').toString('utf8')],
  ['alias-s/copied-root.txt',Buffer.from(fixture.files.find(item=>item.role==='root'&&item.path==='root-marker.txt').bytesBase64,'base64').toString('utf8')],
  ['alias-j/moved-note.txt',Buffer.from(fixture.files.find(item=>item.path==='source-tree/note.txt').bytesBase64,'base64').toString('utf8')],
  ['renamed-s/marker.txt',Buffer.from(fixture.files.find(item=>item.path==='data/marker.txt').bytesBase64,'base64').toString('utf8')],
 ]
 for(const [key,literal] of expected){await content('root',key,literal);const actual=await observe(path.join(projects.root,key),true);requireFact(actual.content?.bytesBase64===Buffer.from(literal).toString('base64'),'Published complete physical bytes required');result.published.push({key,actual})}
}
result.completedAt=stamp();result.qualification='Readonly native/physical/public data qualification; Root manually performs every UI operation and screenshot review; no UI automation'
await save(`browse-${phase}-complete.json`,result);emit({type:'browse-state-complete',phase,fixtureID:fixture.fixtureID,requests:result.requests.length})
