import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
const stage=process.argv[2];assert(['before','after'].includes(stage))
const root=import.meta.dir,repo=path.resolve(root,'../..'),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22',name='source-cold-history-534',source=stage==='before'?base+'/goal-home-run-533-after':base+'/'+name+'-before'
if(stage==='before'){
 const proof=JSON.parse(fs.readFileSync(source+'/evidence/physical-terminal-and-pair-cleanup.json','utf8'))
 for(const field of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[field],true)
 assert.equal(proof.launcher.originalChildExit,0);assert.equal(proof.pairedCleanupComplete,true);assert.equal(proof.providerQualificationPassed,true);assert.equal(proof.copiedPair.length,2)
 assert.equal(proof.maximumRequests,16);assert.equal(proof.requests,5)
 for(const item of proof.chain)assert.equal(item.state,'dead_or_reused')
 for(const request of proof.provider){assert.equal(request.model,'gpt-6.1-sol');assert.equal(request.streaming,true);assert.equal(request.status,200);assert.equal(request.sourceReader.state,'settled');assert.equal(request.sourceReader.terminal.kind,'eof')}
 const retired=JSON.parse(fs.readFileSync(repo+'/.tmp-product-iteration/goal-home-run-533/after-authority-retirement.json','utf8'));assert.equal(retired.retired.length,2)
 const recheck=JSON.parse(fs.readFileSync(repo+'/.tmp-product-iteration/goal-home-run-533/after-recheck.json','utf8'));assert.equal(recheck.passed,true)
}else{
 const proof=JSON.parse(fs.readFileSync(source+'-service/evidence/physical-terminal.json','utf8'))
 for(const field of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[field],true)
 assert.equal(proof.launcher.childExitCode,0);assert.equal(proof.originalExit,0);assert.equal(proof.shutdown.statusCode,200);assert.equal(proof.provider.maximum,0);assert.equal(proof.provider.actual,0);assert.equal(proof.provider.exhausted,false)
}
const target=base+'/'+name+'-'+stage,bundle=base+'/'+name+'-'+stage+'-bundle'
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
 fs.writeFileSync(root+'/'+stage+'-data-preparation.json',JSON.stringify({stage,source,target,schema:3,integrity:'ok',originalCounts:Object.fromEntries(Object.entries(original).map(([name,rows])=>[name,rows.length])),canonical:'Complete source bytes,all five declared keys',modelInputBudget:0,authority:'Target zero model requests;no credentials/catalog staged;source physical and authority settlement verified',at:new Date().toISOString()},null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({stage,tables:tables.length,rows:Object.values(original).reduce((n,rows)=>n+rows.length,0),projects:original.project.length,sessions:original.session.length,schema:3,modelInputBudget:0}))
}finally{db.exec('ROLLBACK');db.close(true)}
fs.mkdirSync(bundle+'/bin',{recursive:true})
fs.copyFileSync('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/markdown-batch-continuity-497-before-bundle/bin/bun.exe',bundle+'/bin/bun.exe',fs.constants.COPYFILE_EXCL)
console.log('Formal production UI is prepared separately; source CLI serves /ui')
