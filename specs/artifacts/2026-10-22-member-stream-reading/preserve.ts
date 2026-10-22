import fs from 'node:fs'
import assert from 'node:assert/strict'
import {isDeepStrictEqual} from 'node:util'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,result:any={at:new Date().toISOString(),schema:3,scopes:[],modelInputBudget:24}
const quote=(name:string)=>'"'+name.replaceAll('"','""')+'"'
for(const stage of process.argv.slice(2)){
 const input=JSON.parse(fs.readFileSync(root+'/'+stage+'-original-private.json','utf8'))
 const source=new Database(input.source+'/runtime/data/opencorvus.db',{readonly:true,create:false}),clone=new Database(input.target+'/runtime/data/opencorvus.db',{readonly:true,create:false})
 try{
  source.exec('BEGIN');clone.exec('BEGIN')
  for(const db of [source,clone]){assert.deepEqual(db.query('PRAGMA user_version').get(),{user_version:3});assert.deepEqual(db.query('PRAGMA integrity_check').get(),{integrity_check:'ok'})}
  const schema="SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name"
  assert.deepEqual(clone.query(schema).all(),source.query(schema).all())
  const differences:any[]=[],counts:Record<string,any>={}
  for(const [table,rows]of Object.entries(input.original) as [string,any[]][]){
   const sourceRows=source.query(input.queries[table]).all() as any[]
   assert.deepEqual(JSON.parse(JSON.stringify(sourceRows)),rows)
   const current=clone.query(input.queries[table]).all() as any[]
   const pk=(clone.query('PRAGMA table_info('+quote(table)+')').all() as any[]).filter(c=>c.pk>0).sort((a,b)=>a.pk-b.pk).map(c=>c.name)
   const key=(row:any)=>JSON.stringify('rowid'in row?[row.rowid]:pk.map(column=>row[column]))
   const byKey=new Map(current.map(row=>[key(row),row]))
   for(const row of sourceRows){const actual=byKey.get(key(row));if(!isDeepStrictEqual(row,actual))differences.push({table,identity:row.id??key(row),fields:Object.keys(row).filter(field=>!isDeepStrictEqual(row[field],actual?.[field]))})}
   counts[table]={original:rows.length,current:current.length}
  }
  const metadata=fs.statSync(input.source+'/runtime/data/opencorvus.db');assert.equal(metadata.size,input.sourceBytes);assert.equal(metadata.mtimeMs,input.sourceModifiedAtMs)
  assert.equal(fs.readFileSync(input.source+'/runtime/config/opencorvus.jsonc','utf8'),input.canonical)
  assert.equal(fs.readFileSync(input.target+'/runtime/config/opencorvus.jsonc','utf8'),input.canonical)
  result.scopes.push({stage,source:{allOriginalRows:'Exact rowid/primary key/all fields/times',bytes:metadata.size,modifiedAtMs:metadata.mtimeMs},schema:'Same actual application objects and version3;integrity ok',canonical:'Complete source bytes exact',counts,originalRowDifferences:differences})
 }finally{source.exec('ROLLBACK');clone.exec('ROLLBACK');source.close(true);clone.close(true)}
}
fs.writeFileSync(root+'/data-preservation-observation.json',JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify(result.scopes.map((scope:any)=>({stage:scope.stage,tables:Object.keys(scope.counts).length,originalRows:Object.values(scope.counts).reduce((n:number,v:any)=>n+v.original,0),differences:scope.originalRowDifferences,providerActivities:scope.counts.provider_activity_request}))))
