import fs from 'node:fs'
import fsp from 'node:fs/promises'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,input=JSON.parse(fs.readFileSync(root+'/input-private.json','utf8'))
const database=input.source+'/runtime/data/opencorvus.db',canonical=input.source+'/runtime/config/opencorvus.jsonc'
assert(fs.readFileSync(database).equals(fs.readFileSync(root+'/database-private.bin')))
assert(fs.readFileSync(canonical).equals(fs.readFileSync(root+'/canonical-private.bin')))
for(const [file,metadata]of [[database,input.databaseMetadata],[canonical,input.canonicalMetadata]] as const){const observed=fs.statSync(file);assert.equal(observed.size,metadata.size);assert.equal(observed.mtimeMs,metadata.mtimeMs)}
const db=new Database(database,{readonly:true,create:false})
try{db.exec('BEGIN');assert.deepEqual(db.query('PRAGMA user_version').get(),{user_version:3});assert.deepEqual(db.query('PRAGMA integrity_check').get(),{integrity_check:'ok'});for(const [table,query]of Object.entries(input.queries))assert.deepEqual(JSON.parse(JSON.stringify(db.query(query as string).all())),input.tables[table])}finally{db.exec('ROLLBACK');db.close(true)}
for(const item of input.projects){const stat=await fsp.stat(item.worktree,{bigint:true});assert.equal(String(stat.dev),item.device);assert.equal(String(stat.ino),item.inode);assert.equal(await fsp.realpath(item.worktree),item.physical)}
const result={at:new Date().toISOString(),source:input.source,tables:Object.keys(input.tables).length,rows:Object.values(input.tables).reduce((n:number,rows:any)=>n+rows.length,0),schema:3,integrity:'ok',sourceObservation:'All original fields/identities/timestamps/bytes/mtime exact',canonical:'Complete original bytes/mtime exact',projects:input.projects.length,directories:'Every original dev/inode/realpath exact',modelRequests:0,boundary:'Read-only original QA data and directory observations;no user process or database'}
fs.writeFileSync(root+'/source-preserved.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result))
