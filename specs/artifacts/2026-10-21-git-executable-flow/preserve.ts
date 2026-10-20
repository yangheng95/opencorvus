import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
import {parse} from '../../packages/overlay/node_modules/jsonc-parser'
const root=import.meta.dir,base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21'
const read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'))
const input=read(root+'/input-private.json'),original=read(root+'/original-canonical-private.json')
const sourceConfig=path.resolve(input.source,'../../config/opencorvus.jsonc')
assert.deepEqual(parse(fs.readFileSync(sourceConfig,'utf8')),original)
const stages=['before','after','control-before','control-after']
const source=new Database(input.source,{readonly:true,create:false})
const result:any={observedAt:new Date().toISOString(),schema:3,source:{},clones:[],canonicalKeys:Object.keys(original),boundary:'Readonly full original rowid/fields/times and actual entire canonical;no initializer,model request or UI assertion'}
try{
 source.exec('BEGIN')
 assert.deepEqual(source.query('PRAGMA user_version').get(),{user_version:3})
 assert.deepEqual(source.query('PRAGMA integrity_check').get(),{integrity_check:'ok'})
 for(const [table,rows]of Object.entries(input.original))assert.deepEqual(source.query('SELECT rowid,* FROM '+table+' ORDER BY rowid').all(),rows)
 const stat=fs.statSync(input.source);assert.equal(stat.size,input.sourceBytes);assert.equal(stat.mtimeMs,input.sourceModifiedAtMs)
 result.source={integrity:'ok',counts:Object.fromEntries(Object.entries(input.original).map(([k,v]:any)=>[k,v.length])),bytes:stat.size,modifiedAtMs:stat.mtimeMs,originalRows:'all rowid/fields/time exact'}
 for(const stage of stages){
  const run=base+'/git-executable-flow-492-'+stage,db=new Database(run+'/runtime/data/opencorvus.db',{readonly:true,create:false})
  try{
   db.exec('BEGIN');assert.deepEqual(db.query('PRAGMA user_version').get(),{user_version:3});assert.deepEqual(db.query('PRAGMA integrity_check').get(),{integrity_check:'ok'})
   const current:Record<string,number>={}
   for(const [table,rows]of Object.entries(input.original)as[string,any[]][]){const all=db.query('SELECT rowid,* FROM '+table+' ORDER BY rowid').all()as any[],byID=new Map(all.map(row=>[row.rowid,row]));assert.deepEqual(rows.map(row=>byID.get(row.rowid)),rows);current[table]=all.length}
   assert.deepEqual(parse(fs.readFileSync(run+'/runtime/config/opencorvus.jsonc','utf8')),original)
   result.clones.push({stage,schema:3,integrity:'ok',originalRows:'all rowid/fields/time exact',current,canonical:'entire original parsed object exact'})
  }finally{db.exec('ROLLBACK');db.close(true)}
 }
}finally{source.exec('ROLLBACK');source.close(true)}
const authority=base+'/git-executable-flow-492-authority',prepared=read(root+'/authority-preparation.json'),authStat=fs.statSync(prepared.source)
assert.equal(authStat.size,prepared.sourceBytes);assert.equal(authStat.mtimeMs,prepared.sourceModifiedAtMs)
const auth=read(prepared.source),copied=read(authority+'/auth.json').openai.info
assert.equal(copied.access,auth.tokens.access_token);assert.equal(copied.refresh,auth.tokens.refresh_token)
assert.deepEqual(fs.readFileSync(authority+'/models.json'),fs.readFileSync(prepared.catalogSource))
result.authority={sourceAuthBytes:authStat.size,sourceAuthModifiedAtMs:authStat.mtimeMs,selectedPair:'same authorized access/refresh and full exact catalog bytes',source:'source file metadata preserved;no refresh/exchange/write',catalogBytes:prepared.catalogBytes,maximumRequests:4}
fs.writeFileSync(root+'/data-and-authority-preserved.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({schema:3,sourceRows:3665,clones:4,canonical:'full exact',sourceCredentials:'preserved',catalogBytes:prepared.catalogBytes}))
