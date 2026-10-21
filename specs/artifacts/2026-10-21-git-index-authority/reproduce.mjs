import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {listTrackedEntries,scan} from './secret-scan-before.ts'
const root=import.meta.dirname,fake='sk-'+'IndexFixture'.repeat(3),rows=[]
const env={...process.env};for(const key of Object.keys(env))if(key.startsWith('GIT_'))delete env[key]
function git(repo,args,input,extra={}){const result=spawnSync('git',['-C',repo,'-c','user.name=Index Fixture','-c','user.email=index@example.invalid','-c','commit.gpgsign=false','-c','core.hooksPath='+repo+'/empty-hooks',...args],{input,env:{...env,...extra},windowsHide:true,maxBuffer:16*1024*1024});if(result.error)throw result.error;assert.equal(result.status,0,result.stderr.toString());return result.stdout}
function write(repo,file,body){fs.mkdirSync(path.dirname(repo+'/'+file),{recursive:true});fs.writeFileSync(repo+'/'+file,body+'\n');git(repo,['add','--',file])}
function setup(name,format='sha1'){const repo=root+'/'+name;assert.equal(fs.existsSync(repo),false);fs.mkdirSync(repo);git(repo,['init','--initial-branch=index-fixture','--object-format='+format]);write(repo,'base.ts','public baseline');git(repo,['commit','-m','public baseline']);return repo}
function attempt(fn){try{return{value:fn()}}catch(error){return{error:{name:error.name,message:error.message}}}}
function observe(name,repo,extra={}){
 const previous=process.env.GIT_INDEX_FILE
 if(extra.GIT_INDEX_FILE)process.env.GIT_INDEX_FILE=extra.GIT_INDEX_FILE
 try{
  const actual=git(repo,['ls-files','--stage','--full-name','-z'],undefined,extra).toString().split('\0').filter(Boolean).map(record=>{const tab=record.indexOf('\t'),[mode,objectId,stage]=record.slice(0,tab).split(' ');return{file:record.slice(tab+1),mode:Number.parseInt(mode,8),objectId,stage:Number(stage)}})
  const sizes=actual.filter(row=>row.mode!==0o160000).map(row=>({file:row.file,objectId:row.objectId,bytes:Number(git(repo,['cat-file','-s',row.objectId],undefined,extra).toString())}))
  const row={name,repo,format:git(repo,['rev-parse','--show-object-format'],undefined,extra).toString().trim(),gitAuthority:actual,actualBlobSizes:sizes,originalEntries:attempt(()=>listTrackedEntries(repo)),originalScan:attempt(()=>scan({repoRoot:repo})),credential:'Generated fake only;no real authority or Provider request'}
  rows.push(row)
 }finally{if(previous===undefined)delete process.env.GIT_INDEX_FILE;else process.env.GIT_INDEX_FILE=previous}
}
{
 const repo=setup('sha256','sha256');write(repo,'staged.ts',fake);observe('sha256',repo)
}
{
 const repo=setup('v4');write(repo,'staged.ts',fake);git(repo,['update-index','--index-version=4']);observe('v4',repo)
}
{
 const repo=setup('split');write(repo,'staged.ts',fake);git(repo,['update-index','--split-index']);observe('split',repo)
}
{
 const repo=setup('sparse');write(repo,'inside/public.ts','inside public');write(repo,'outside/public.ts','outside public');git(repo,['commit','-m','public directory baseline']);git(repo,['sparse-checkout','init','--cone','--sparse-index']);git(repo,['sparse-checkout','set','inside']);write(repo,'inside/staged.ts',fake);observe('sparse',repo)
}
{
 const repo=setup('cacheinfo'),body=fake+'\n'+'x'.repeat(1024*1024+17),objectId=git(repo,['hash-object','-w','--stdin'],body).toString().trim();git(repo,['update-index','--add','--cacheinfo','100644',objectId,'cached.ts']);observe('cacheinfo',repo)
}
{
 const repo=setup('alternate'),extra={GIT_INDEX_FILE:'alternate-index'};git(repo,['read-tree','HEAD'],undefined,extra);const objectId=git(repo,['hash-object','-w','--stdin'],fake+'\n').toString().trim();git(repo,['update-index','--add','--cacheinfo','100644',objectId,'alternate.ts'],undefined,extra);observe('relative-alternate',repo,extra)
}
fs.writeFileSync(root+'/before-reproduction.json',JSON.stringify({observedAt:new Date().toISOString(),rows,modelRequests:0,credentialCopies:0,source:'Six exact owned new test repositories;no primary index/branch/worktree modification'},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify(rows.map(row=>({name:row.name,gitFiles:row.gitAuthority.map(r=>r.file),originalFiles:row.originalEntries.value?.map(r=>r.file),entriesError:row.originalEntries.error,scan:row.originalScan.value?.map(r=>({file:r.file,lineNumber:r.lineNumber,patternId:r.patternId})),scanError:row.originalScan.error,cachedSize:row.name==='cacheinfo'?{declared:row.originalEntries.value?.find(r=>r.file==='cached.ts')?.size,actual:row.actualBlobSizes.find(r=>r.file==='cached.ts')?.bytes}:undefined}))))
