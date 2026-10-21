import fs from 'node:fs'
import fsp from 'node:fs/promises'
import assert from 'node:assert/strict'
import {isDeepStrictEqual} from 'node:util'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,input=JSON.parse(fs.readFileSync(root+'/before-original-private.json','utf8'))
assert(fs.readFileSync(input.source+'/runtime/data/opencorvus.db').equals(fs.readFileSync(root+'/source-database-private.bin')))
assert(fs.readFileSync(input.source+'/runtime/config/opencorvus.jsonc').equals(fs.readFileSync(root+'/source-canonical-private.bin')))
const directories=JSON.parse(fs.readFileSync(root+'/source-directories-private.json','utf8'))
for(const item of directories){const info=await fsp.stat(item.path,{bigint:true});assert.equal(String(info.dev),item.device);assert.equal(String(info.ino),item.inode);assert.equal(fs.realpathSync(item.path),item.realpath)}
const db=new Database(input.target+'/runtime/data/opencorvus.db',{readonly:true,create:false})
let memory
try{
 const row=input.original.memory_chunk.find((r:any)=>r.id==='mck_h0TwOCuDIItgGfxTGf6k');assert(row)
 const current:any=db.query('SELECT * FROM memory_chunk WHERE id=?').get(row.id);assert(current)
 const before=JSON.parse(row.content),after=JSON.parse(current.content)
 memory={projectID:row.project_id,chunkID:row.id,changedEnvelopeFields:Object.keys(before).filter(key=>!isDeepStrictEqual(before[key],after[key])),markdownExact:before.markdown===after.markdown,tokenCount:{before:before.tokenCount,after:after.tokenCount},availability:{before:before.availabilityGeneration,after:after.availabilityGeneration},documentRevision:{before:before.revision,after:after.revision},timeUpdated:{before:before.timeUpdated,after:after.timeUpdated}}
 assert.equal(memory.markdownExact,true);assert.equal(after.tokenCount,before.tokenCount);assert.equal(after.revision,before.revision)
}finally{db.close(true)}
const result={at:new Date().toISOString(),source:{database:'Exact original bytes,all fields/size/mtime checked separately',canonical:'Exact complete original bytes',originalPhysicalDirectories:directories.length,physical:'Every original dev/inode/realpath exact'},memory,boundary:'Actual closed original QA data identity/integrity and semantic envelope comparison;not mutable source hashes or model narrative;no user database'}
fs.writeFileSync(root+'/data-observation.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result))
