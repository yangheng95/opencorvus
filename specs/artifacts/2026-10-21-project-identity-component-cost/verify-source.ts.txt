import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,input=JSON.parse(fs.readFileSync(root+'/input-private.json','utf8')),db=new Database(input.source,{readonly:true,create:false})
try{
 db.exec('BEGIN');assert.deepEqual(db.query('PRAGMA user_version').get(),{user_version:3});assert.deepEqual(db.query('PRAGMA integrity_check').get(),{integrity_check:'ok'})
 const preserved:Record<string,number>={}
 for(const [table,rows]of Object.entries(input.original) as [string,unknown[]][]){assert.deepEqual(db.query('SELECT rowid,* FROM '+table+' ORDER BY rowid').all(),rows,table+' complete original rows/fields/times');preserved[table]=rows.length}
 const stat=fs.statSync(input.source);assert.equal(stat.size,input.sourceBytes);assert.equal(stat.mtimeMs,input.sourceModifiedAtMs)
 const result={observedAt:new Date().toISOString(),schema:3,integrity:'ok',preserved,sourceDatabase:'Original complete rows/fields/times,bytes/mtime retained',models:'No credentials,catalogue,Provider preflight or model input;no source initializer',boundary:'Readonly source qualification after all original local scopes settled;not full Config or UI qualification'}
 fs.writeFileSync(root+'/source-preserved.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
}finally{db.exec('ROLLBACK');db.close(true)}
