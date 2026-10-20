import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21',source=base+'/git-executable-flow-492-before'
const settled=JSON.parse(fs.readFileSync(source+'/evidence/physical-terminal-and-pair-cleanup.json','utf8'))
assert.equal(settled.pairedCleanupComplete,true);assert.equal(settled.requests,2)
const input=JSON.parse(fs.readFileSync(root+'/input-private.json','utf8')),canonical=fs.readFileSync(source+'/runtime/config/opencorvus.jsonc','utf8')
const db=new Database(source+'/runtime/data/opencorvus.db',{readonly:true,create:false})
try{
 db.exec('BEGIN');assert.deepEqual(db.query('PRAGMA user_version').get(),{user_version:3})
 for(const [table,rows]of Object.entries(input.original))assert.deepEqual(db.query('SELECT rowid,* FROM '+table+' WHERE rowid<=? ORDER BY rowid').all(Math.max(...(rows as any[]).map(row=>row.rowid))),rows)
 const serialized=db.serialize(),counts=Object.fromEntries(Object.keys(input.original).map(table=>[table,(db.query('SELECT COUNT(*) AS count FROM '+table).get() as any).count]))
 assert.equal(counts.project,150)
 for(const stage of ['control-before','control-after']){
  const run=base+'/git-executable-flow-492-'+stage;assert.equal(fs.existsSync(run),false,'Fresh matched control occurrence')
  for(const directory of ['runtime/data','runtime/config','runtime/tmp','home','appdata','localappdata','evidence'])fs.mkdirSync(path.join(run,directory),{recursive:true})
  fs.writeFileSync(run+'/runtime/data/opencorvus.db',serialized,{flag:'wx'});fs.writeFileSync(run+'/runtime/config/opencorvus.jsonc',canonical,{flag:'wx'})
 }
 fs.writeFileSync(root+'/control-data-preparation.json',JSON.stringify({observedAt:new Date().toISOString(),source,counts,schema:3,controls:['control-before','control-after'],modelRequests:0,boundary:'Both exact same settled full DB/canonical snapshot including original149 and prior real preflight Project/Session;no new Session/model input;no UI in controls'},null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({controls:2,counts,modelRequests:0}))
}finally{db.exec('ROLLBACK');db.close(true)}
