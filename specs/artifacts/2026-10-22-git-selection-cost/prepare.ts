import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,source='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/config-admitted-discovery-518-after'
const proof=JSON.parse(fs.readFileSync(source+'/evidence/physical-terminal-and-pair-cleanup.json','utf8'))
for(const key of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[key],true)
assert.equal(proof.native.terminal.exitCode,0);assert.equal(proof.launcher.originalChildExit,0);assert.equal(proof.pairedCleanupComplete,true)
assert(proof.chain.every((row:any)=>row.state==='dead_or_reused'))
const database=source+'/runtime/data/opencorvus.db',canonical=source+'/runtime/config/opencorvus.jsonc'
const original=fs.readFileSync(database),canonicalBytes=fs.readFileSync(canonical),metadata=fs.statSync(database),canonicalMetadata=fs.statSync(canonical)
const db=new Database(database,{readonly:true,create:false}),tables:Record<string,any[]>={},queries:Record<string,string>={}
const quote=(s:string)=>'"'+s.replaceAll('"','""')+'"'
try{
 db.exec('BEGIN');assert.deepEqual(db.query('PRAGMA user_version').get(),{user_version:3});assert.deepEqual(db.query('PRAGMA integrity_check').get(),{integrity_check:'ok'})
 const listing=db.query('PRAGMA table_list').all() as any[]
 for(const {name}of db.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as {name:string}[]){
  const columns=db.query('PRAGMA table_info('+quote(name)+')').all() as any[]
  const query=listing.find(r=>r.name===name&&r.schema==='main')?.wr===1?'SELECT * FROM '+quote(name)+' ORDER BY '+columns.filter(c=>c.pk>0).sort((a,b)=>a.pk-b.pk).map(c=>quote(c.name)).join(','):'SELECT rowid,* FROM '+quote(name)+' ORDER BY rowid'
  queries[name]=query;tables[name]=db.query(query).all()
 }
}finally{db.exec('ROLLBACK');db.close(true)}
const projects=[]
for(const row of tables.project){
 const stat=await fsp.stat(row.worktree,{bigint:true});assert(stat.isDirectory())
 let git=true;try{await fsp.access(path.join(row.worktree,'.git'))}catch(error:any){if(error.code!=='ENOENT')throw error;git=false}
 projects.push({id:row.id,worktree:row.worktree,physical:await fsp.realpath(row.worktree),device:String(stat.dev),inode:String(stat.ino),git})
}
assert.equal(projects.length,166)
fs.writeFileSync(root+'/input-private.json',JSON.stringify({source,projects,queries,tables,databaseMetadata:{size:metadata.size,mtimeMs:metadata.mtimeMs},canonicalMetadata:{size:canonicalMetadata.size,mtimeMs:canonicalMetadata.mtimeMs}})+'\n',{flag:'wx'})
fs.writeFileSync(root+'/database-private.bin',original,{flag:'wx'});fs.writeFileSync(root+'/canonical-private.bin',canonicalBytes,{flag:'wx'})
const result={at:new Date().toISOString(),source,schema:3,integrity:'ok',tables:Object.keys(tables).length,rows:Object.values(tables).reduce((n,r)=>n+r.length,0),projects:projects.length,gitProjects:projects.filter(p=>p.git).length,nonGitProjects:projects.filter(p=>!p.git).length,modelRequests:0,maximumGitQueries:4*projects.filter(p=>p.git).length,sourceProof:'Original native/output/request/launcher and paired retirement complete;all original physical births dead_or_reused',boundary:'Read-only source,all registered directories;no source initialization,provider or user application'}
fs.writeFileSync(root+'/preparation.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result))
