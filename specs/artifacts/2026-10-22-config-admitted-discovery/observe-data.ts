import fs from 'node:fs'
import path from 'node:path'
import {isDeepStrictEqual} from 'node:util'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,out=path.resolve(root,'../../specs/artifacts/2026-10-22-config-admitted-discovery'),results:any[]=[]
for(const stage of ['before','after']){
 const original=JSON.parse(fs.readFileSync(root+'/'+stage+'-original-private.json','utf8'))
 const row=original.original.memory_chunk.find((r:any)=>r.id==='mck_h0TwOCuDIItgGfxTGf6k')
 const db=new Database(original.target+'/runtime/data/opencorvus.db',{readonly:true,create:false})
 try{
  const current:any=db.query('SELECT * FROM memory_chunk WHERE id=?').get(row.id)
  const before=JSON.parse(row.content),after=JSON.parse(current.content)
  results.push({stage,projectID:row.project_id,chunkID:row.id,changedEnvelopeFields:Object.keys(before).filter(key=>!isDeepStrictEqual(before[key],after[key])),markdownExact:before.markdown===after.markdown,tokenCount:{before:before.tokenCount,after:after.tokenCount},availability:{before:before.availabilityGeneration,after:after.availabilityGeneration},documentRevision:{before:before.revision,after:after.revision},timeUpdated:{before:before.timeUpdated,after:after.timeUpdated}})
 }finally{db.close(true)}
}
fs.writeFileSync(out+'/memory-observation.json',JSON.stringify({at:new Date().toISOString(),results,contract:'Original ProjectMemory availability invalidation;complete semantic document comparison;not model narrative or a source hash'},null,2)+'\n',{flag:'wx'})
const images=fs.readdirSync(root).filter(name=>name.endsWith('.png')).sort().map(name=>{const b=fs.readFileSync(root+'/'+name);return{name,capturedAt:fs.statSync(root+'/'+name).mtime.toISOString(),bytes:b.length,dimensions:b.subarray(1,4).toString()==='PNG'?{width:b.readUInt32BE(16),height:b.readUInt32BE(20)}:undefined,manualObservation:name==='05-after-general.png'?'Only header fragment;not full-layout qualification':'Full page inspected manually'}})
fs.writeFileSync(out+'/image-observations.json',JSON.stringify({at:new Date().toISOString(),images,contract:'Raw image-file metadata and manual classifications;no pixel,DOM,baseline or screenshot assertions'},null,2)+'\n',{flag:'wx'})
fs.copyFileSync(root+'/observe-data.ts',out+'/observe-data.ts',fs.constants.COPYFILE_EXCL)
console.log(JSON.stringify({memory:results,images:images.map(v=>({name:v.name,dimensions:v.dimensions}))}))
