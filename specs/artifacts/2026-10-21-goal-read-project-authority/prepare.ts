import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
const stage=process.argv[2];assert(stage==='before'||stage==='after')
const root=import.meta.dir,repo=path.resolve(root,'../..'),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21',name='goal-deliverable-navigation-498',source=base+'/markdown-batch-continuity-497-after'
const proof=JSON.parse(fs.readFileSync(source+'/evidence/physical-terminal-and-pair-cleanup.json','utf8'))
for(const field of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[field],true)
assert.equal(proof.launcher.originalChildExit,0);assert.equal(proof.pairedCleanupComplete,true)
const target=base+'/'+name+'-'+stage+'-data',bundle=base+'/'+name+'-'+stage+'-bundle',diag=base+'/'+name+'-'+stage,port=stage==='before'?18879:18881
const quote=(name:string)=>'"'+name.replaceAll('"','""')+'"'
const db=new Database(source+'/runtime/data/opencorvus.db',{readonly:true,create:false})
try{
 db.exec('BEGIN');assert.deepEqual(db.query('PRAGMA user_version').get(),{user_version:3});assert.deepEqual(db.query('PRAGMA integrity_check').get(),{integrity_check:'ok'})
 const tables=db.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as {name:string}[]
 const listing=db.query('PRAGMA table_list').all() as any[],original:Record<string,any[]>={},queries:Record<string,string>={}
 for(const {name:table}of tables){
  const columns=db.query('PRAGMA table_info('+quote(table)+')').all() as any[]
  const query=listing.find(row=>row.name===table&&row.schema==='main')?.wr===1
   ? 'SELECT * FROM '+quote(table)+' ORDER BY '+columns.filter(c=>c.pk>0).sort((a,b)=>a.pk-b.pk).map(c=>quote(c.name)).join(',')
   : 'SELECT rowid,* FROM '+quote(table)+' ORDER BY rowid'
  queries[table]=query;original[table]=db.query(query).all()
 }
 for(const dir of ['runtime/data','runtime/config','runtime/tmp','home','appdata','localappdata'])fs.mkdirSync(target+'/'+dir,{recursive:true})
 const canonical=fs.readFileSync(source+'/runtime/config/opencorvus.jsonc'),stat=fs.statSync(source+'/runtime/data/opencorvus.db')
 fs.writeFileSync(target+'/runtime/data/opencorvus.db',db.serialize(),{flag:'wx'})
 fs.writeFileSync(target+'/runtime/config/opencorvus.jsonc',canonical,{flag:'wx'})
 fs.writeFileSync(root+'/'+stage+'-original-private.json',JSON.stringify({source,target,queries,original,sourceBytes:stat.size,sourceModifiedAtMs:stat.mtimeMs,canonical:canonical.toString('utf8')})+'\n',{flag:'wx'})
 fs.writeFileSync(root+'/'+stage+'-data-preparation.json',JSON.stringify({stage,source,target,schema:3,integrity:'ok',originalCounts:Object.fromEntries(Object.entries(original).map(([name,rows])=>[name,rows.length])),canonical:'Complete source bytes,all five declared keys',modelInputBudget:0,authority:'None copied;source native/reader/launcher settled and auth/models retired',at:new Date().toISOString()},null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({stage,tables:tables.length,rows:Object.values(original).reduce((n,rows)=>n+rows.length,0),projects:original.project.length,sessions:original.session.length,schema:3,modelInputBudget:0}))
}finally{db.exec('ROLLBACK');db.close(true)}
fs.mkdirSync(bundle+'/bin',{recursive:true})
fs.copyFileSync(base+'/markdown-batch-continuity-497-before-bundle/bin/bun.exe',bundle+'/bin/bun.exe',fs.constants.COPYFILE_EXCL)
fs.cpSync(repo+'/packages/overlay/dist-vite',bundle+'/bin/ui',{recursive:true,errorOnExist:true,force:false})
const prior=repo+'/.tmp-product-iteration/member-reading-lifecycle-487'
let serve=fs.readFileSync(prior+'/serve-before.ts','utf8').replaceAll('member-reading-lifecycle-487-before-data',name+'-'+stage+'-data').replaceAll('18857',String(port)).replaceAll('487 before genuine member reading;no credentials or model requests','498 '+stage+' real goal/deliverable navigation;no credentials or model input')
fs.writeFileSync(root+'/serve-'+stage+'.ts',serve,{flag:'wx'})
for(const kind of ['launch','shutdown','settle']){
 let code=fs.readFileSync(prior+'/'+kind+'-before.ps1','utf8').replaceAll('member-reading-lifecycle-487-before-data',name+'-'+stage+'-data').replaceAll('member-reading-lifecycle-487-before-bundle',name+'-'+stage+'-bundle').replaceAll('member-reading-lifecycle-487-before',name+'-'+stage).replaceAll('18857',String(port)).replaceAll('member-reading-lifecycle-487/serve-before.ts',name+'/serve-'+stage+'.ts')
 if(kind==='launch')code=code.replace('"$taskRoot/project"',"'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh/project'")
 fs.writeFileSync(root+'/'+kind+'-'+stage+'.ps1',code,{flag:'wx'})
}
