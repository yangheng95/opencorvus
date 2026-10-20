import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
import {parse} from '../../packages/overlay/node_modules/jsonc-parser'
const root=import.meta.dir,base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21',source='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh'
const inputPath=path.resolve(root,'../native-query-scope-490/input-private.json')
const input=JSON.parse(fs.readFileSync(inputPath,'utf8'))
const canonical=fs.readFileSync(source+'/runtime/config/opencorvus.jsonc','utf8'),original=parse(canonical)
assert.equal(Object.keys(original).length,5);assert.equal(original.permission_mode,'ask')
const db=new Database(input.source,{readonly:true,create:false})
try{
 db.exec('BEGIN');assert.deepEqual(db.query('PRAGMA user_version').get(),{user_version:3})
 for(const [table,rows]of Object.entries(input.original))assert.deepEqual(db.query('SELECT rowid,* FROM '+table+' ORDER BY rowid').all(),rows)
 const serialized=db.serialize(),metadata=fs.statSync(input.source)
 assert.equal(metadata.size,input.sourceBytes);assert.equal(metadata.mtimeMs,input.sourceModifiedAtMs)
 for(const stage of ['before','after']){
  const run=base+'/git-executable-flow-492-'+stage
  assert.equal(fs.existsSync(run),false,'Fresh QA clone occurrence')
  for(const directory of ['runtime/data','runtime/config','runtime/tmp','home','appdata','localappdata','evidence'])fs.mkdirSync(path.join(run,directory),{recursive:true})
  fs.writeFileSync(run+'/runtime/data/opencorvus.db',serialized,{flag:'wx'})
  fs.writeFileSync(run+'/runtime/config/opencorvus.jsonc',canonical,{flag:'wx'})
  const clone=new Database(run+'/runtime/data/opencorvus.db',{readonly:true,create:false})
  try{for(const [table,rows]of Object.entries(input.original))assert.deepEqual(clone.query('SELECT rowid,* FROM '+table+' ORDER BY rowid').all(),rows);assert.deepEqual(clone.query('PRAGMA user_version').get(),{user_version:3})}finally{clone.close(true)}
 }
 fs.copyFileSync(inputPath,path.join(root,'input-private.json'),fs.constants.COPYFILE_EXCL)
 fs.writeFileSync(root+'/original-canonical-private.json',JSON.stringify(original),{flag:'wx'})
 fs.writeFileSync(root+'/data-preparation.json',JSON.stringify({observedAt:new Date().toISOString(),source,projects:149,sessions:198,schema:3,originalCounts:Object.fromEntries(Object.entries(input.original).map(([key,rows]:any)=>[key,rows.length])),canonicalKeys:Object.keys(original),canonicalBytes:Buffer.byteLength(canonical),clones:['before','after'],sourceDatabase:'All original rows/fields/rowid/time and bytes/mtime retained;readonly serialize,not initializer',modelRequests:0},null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({clones:2,projects:149,sessions:198,schema:3,canonicalKeys:Object.keys(original),source:'exact readonly original retained'}))
}finally{db.exec('ROLLBACK');db.close(true)}
