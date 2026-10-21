import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {listTrackedEntries,scan} from '../../script/secret-scan.ts'
const root=import.meta.dirname,source=path.resolve(root,'../../script/secret-scan.ts'),before=JSON.parse(fs.readFileSync(root+'/before-reproduction.json','utf8')),bun='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/dependency-redirect-hardening-488-after-bundle/bin/bun.exe',rows=[]
for(const row of before.rows){
 const previous=process.env.GIT_INDEX_FILE,indexPath=row.name==='relative-alternate'?row.repo+'/alternate-index':row.repo+'/.git/index',bytes=fs.readFileSync(indexPath),stat=fs.statSync(indexPath)
 if(row.name==='relative-alternate')process.env.GIT_INDEX_FILE='alternate-index'
 try{
  const sizes=new Map(row.actualBlobSizes.map(r=>[r.objectId,r.bytes])),entries=listTrackedEntries(row.repo),expected=row.gitAuthority.map(r=>({...r,size:r.mode===0o160000?0:sizes.get(r.objectId)}))
  assert.deepEqual(entries,expected)
  const hits=scan({repoRoot:row.repo});let cli
  if(row.name!=='cacheinfo'){
   const file=row.name==='sparse'?'inside/staged.ts':row.name==='relative-alternate'?'alternate.ts':'staged.ts'
   assert.deepEqual(hits,[{file,lineNumber:1,patternId:'provider-key',description:'Model-provider key (sk-...)'}])
   fs.mkdirSync(row.repo+'/script',{recursive:true});const target=row.repo+'/script/secret-scan-final.ts';fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL)
   const result=spawnSync(bun,[target],{cwd:path.resolve(root,'../..'),encoding:'utf8',windowsHide:true,maxBuffer:1024*1024})
   if(result.error)throw result.error;assert.equal(result.status,1);assert.deepEqual(result.stderr.split(/\r?\n/).filter(line=>line.startsWith('  ')),[`  ${file}:1  [provider-key] Model-provider key (sk-...)`])
   cli={status:result.status,stdout:result.stdout,stderr:result.stderr,cwd:'Original host workspace,not fixture;Git resolves alternate index in its -C repository'}
  }
  assert.deepEqual(fs.readFileSync(indexPath),bytes);assert.equal(fs.statSync(indexPath).mtimeMs,stat.mtimeMs)
  rows.push({name:row.name,entries,hits,cli,index:'Original exact bytes/mtime preserved',boundary:row.name==='cacheinfo'?'Actual blob1048633 exceeds unchanged1MiB content policy;positive metadata size contract':'Same original fixture now returns exact Git authority and explicit credential error'})
 }finally{if(previous===undefined)delete process.env.GIT_INDEX_FILE;else process.env.GIT_INDEX_FILE=previous}
}
fs.writeFileSync(root+'/after-reproduction.json',JSON.stringify({observedAt:new Date().toISOString(),rows,modelRequests:0,credentialCopies:0},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({originalFixtures:rows.length,exactMetadata:rows.length,actualCLIRejections:rows.filter(r=>r.cli?.status===1).length,indexes:'all original bytes/mtime retained',modelRequests:0}))
