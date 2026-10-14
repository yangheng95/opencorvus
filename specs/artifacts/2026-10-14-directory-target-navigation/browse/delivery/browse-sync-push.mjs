import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
const scratch=path.resolve('.tmp-codex-directory-target-01a133')
const env={...process.env,PATH:path.resolve('.tmp-product-iteration/sse-compression-305/bun140/bun-windows-x64')+path.delimiter+process.env.PATH}
function run(name,args){
 const prefix=path.join(scratch,name+'-'+Date.now()),atUtc=new Date().toISOString()
 const r=spawnSync('git',args,{env,encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024})
 fs.writeFileSync(prefix+'.stdout.log',r.stdout??'');fs.writeFileSync(prefix+'.stderr.log',r.stderr??'')
 const receipt={command:['git',...args],atUtc,completedAtUtc:new Date().toISOString(),exitCode:r.status,signal:r.signal,stdoutFile:prefix+'.stdout.log',stderrFile:prefix+'.stderr.log',error:r.error?String(r.error):undefined}
 fs.writeFileSync(prefix+'.exit.json',JSON.stringify(receipt,null,2)+'\n')
 console.log(JSON.stringify(receipt))
 if(r.status!==0)throw Error('Original failed Git receipt retained: '+prefix)
 return r.stdout
}
if(process.argv.includes('--sync')){
 run('browse-fetch-fresh',['fetch','origin']);run('browse-merge-fresh',['merge','@{upstream}'])
 const r=spawnSync(process.execPath,[path.join(scratch,'review-browse-outgoing.mjs')],{env,encoding:'utf8',windowsHide:true,maxBuffer:128*1024*1024})
 const file=path.join(scratch,'browse-outgoing-run-'+Date.now()+'.json');fs.writeFileSync(file,JSON.stringify({exitCode:r.status,stdout:r.stdout,stderr:r.stderr,atUtc:new Date().toISOString()},null,2)+'\n');console.log(r.stdout)
 if(r.status!==0)throw Error('Full outgoing review failed: '+file)
}else if(process.argv.includes('--push')){
 const reviewed=JSON.parse(fs.readFileSync(path.join(scratch,'browse-outgoing-latest.json'),'utf8'))
 const head=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).stdout.trim()
 if(head!==reviewed.head)throw Error('HEAD advanced; fresh sync and complete audit required')
 run('browse-push-normal',['push'])
}else if(process.argv.includes('--final')){
 run('browse-fetch-final',['fetch','origin'])
 const head=run('browse-head-final',['rev-parse','HEAD']).trim(),upstream=run('browse-upstream-final',['rev-parse','@{upstream}']).trim(),remote=run('browse-remote-final',['ls-remote','origin','refs/heads/main']).trim()
 const owned=JSON.parse(fs.readFileSync(path.join(scratch,'browse-commit.json'),'utf8'))
 run('browse-owned-ancestor-final',['merge-base','--is-ancestor',owned.commit,upstream])
 const product=owned.files.filter(file=>file.startsWith('packages/'))
 const ownStatus=run('browse-own-scope-final',['status','--short','--',...product,'specs/records/2026-10/2026-10-14-directory-target-navigation.md','specs/artifacts/2026-10-14-directory-target-navigation'])
 if(ownStatus.trim())throw Error('Root delivery scope retains uncommitted changes')
 const staged=run('browse-staged-final',['diff','--cached','--name-only']),status=run('browse-status-final',['status','--short'])
 const proof={atUtc:new Date().toISOString(),head,upstream,remote,ownedCommit:owned.commit,ownAncestorExitCode:0,ownScopeStatus:ownStatus,staged,status,qualification:'Fresh remote read and actual own commit ancestry; unrelated working changes preserved. Continuous goal remains active.'}
 const file=path.join(scratch,'browse-final-proof-'+Date.now()+'.json');fs.writeFileSync(file,JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({file,head,upstream,remote,ownedCommit:owned.commit,ownScopeClean:true,staged}))
}else throw Error('Explicit sync/push/final required')
