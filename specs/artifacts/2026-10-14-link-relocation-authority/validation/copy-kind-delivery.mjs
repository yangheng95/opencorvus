import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
const repo=process.cwd(),scratch=path.join(repo,'.tmp-codex-directory-target-01a133')
const id='2026-10-14-link-relocation-authority'
const scopes=['.gitattributes','packages/opencorvus/src/file/index.ts','packages/opencorvus/src/util/file-entry.ts','packages/opencorvus/test/file-link-entry-contract.test.ts','specs/records/2026-10/'+id+'.md','specs/artifacts/'+id]
const shared=['specs/README.md','specs/records/2026-10/README.md','specs/artifacts/README.md']
const architecture='specs/current/architecture/07-panel.md'
const contract=`The private entry observation supplies the symlink creation type from that same
entry metadata. Copy records each link's original text and creation type while
the mature copier handles ordinary entries, then creates the staged links with
that explicit type. Windows junctions and broken directory symbolic links retain
their original reparse semantics. Strict staging and publication checks compare
creation types as well as link text and file bytes. This does not publish a
followed-directory navigation fact or a complete unpublished-tree resolver.
`
function git(args,env=process.env,input){const r=spawnSync('git',args,{cwd:repo,env,input,encoding:'utf8',windowsHide:true,maxBuffer:128*1024*1024});if(args[0]==='commit'||r.status!==0)fs.writeFileSync(path.join(scratch,'copy-kind-git-result-'+Date.now()+'.json'),JSON.stringify({args,stdout:r.stdout,stderr:r.stderr,exitCode:r.status,atUtc:new Date().toISOString()},null,2));if(r.status!==0)throw Error('Git failed: '+args.join(' ')+'; original complete result retained');return r.stdout}
function blob(file,text,env){const oid=git(['hash-object','-w','--stdin'],env,text).trim();git(['update-index','--add','--cacheinfo','100644,'+oid+','+file],env)}
const preparedFile=path.join(scratch,'copy-kind-prepared-index.json'),commitFile=path.join(scratch,'copy-kind-commit.json')
if(process.argv.includes('--prepare')){
 const base=git(['rev-parse','HEAD']).trim(),index=path.join(scratch,'copy-kind-index-'+Date.now()),env={...process.env,GIT_INDEX_FILE:index}
 fs.writeFileSync(path.join(scratch,'copy-kind-real-index-before.diff'),git(['diff','--cached','--binary']))
 fs.writeFileSync(path.join(scratch,'copy-kind-status-before.txt'),git(['status','--short']))
 git(['read-tree',base],env);git(['add','-f','--',...scopes],env)
 for(const file of shared){
  const working=fs.readFileSync(path.join(repo,file),'utf8').replaceAll('\r\n','\n'),rows=working.split('\n').filter(line=>line.startsWith('- [')&&line.includes(id))
  if(rows.length!==1)throw Error('Single owned row required: '+file)
  let baseline=git(['show',base+':'+file]),prior=baseline.split('\n').filter(line=>line.startsWith('- [')&&line.includes(id))
  if(prior.length>1||prior.length===1&&prior[0]!==rows[0])throw Error('Owned row requires explicit review: '+file)
  if(prior.length===0)baseline=baseline.replace('\n','\n\n'+rows[0]+'\n')
  blob(file,baseline,env)
 }
 const working=fs.readFileSync(path.join(repo,architecture),'utf8').replaceAll('\r\n','\n');if(working.split(contract).length!==2)throw Error('Exact single owned architecture paragraph required')
 let baseline=git(['show',base+':'+architecture]),anchor='Recursion and self-directory protection apply to actual directory entries.\n'
 if(!baseline.includes(contract)){if(baseline.split(anchor).length!==2)throw Error('Exact architecture anchor required');baseline=baseline.replace(anchor,contract+anchor)}
 blob(architecture,baseline,env);git(['diff','--cached','--check'],env)
 const files=git(['diff','--cached','--name-only'],env).trim().split('\n').filter(Boolean)
 if(files.some(file=>!scopes.some(scope=>file===scope||file.startsWith(scope+'/'))&&!shared.includes(file)&&file!==architecture))throw Error('Private staging escaped task scope')
 fs.writeFileSync(preparedFile,JSON.stringify({base,index,files},null,2))
 fs.writeFileSync(path.join(scratch,'copy-kind-staged-review.diff'),git(['diff','--cached','--',...scopes.slice(0,5),...shared,architecture,...files.filter(file=>file.endsWith('/README.md'))],env))
 fs.writeFileSync(path.join(scratch,'copy-kind-staged-stat.txt'),git(['diff','--cached','--stat'],env))
 console.log(JSON.stringify({base,index,files:files.length,preparedOnly:true}));process.exit(0)
}
if(process.argv.includes('--reconcile')){
 const committed=JSON.parse(fs.readFileSync(commitFile,'utf8'));if(git(['rev-parse','HEAD']).trim()!==committed.commit)throw Error('HEAD changed; inspect before precise own reconciliation')
 const patch=git(['diff',committed.base,committed.commit,'--binary']);fs.writeFileSync(path.join(scratch,'copy-kind-owned-index.patch'),patch)
 git(['apply','--cached','--check'],process.env,patch);git(['apply','--cached'],process.env,patch)
 const remaining=git(['diff','--cached','--name-only']).trim();console.log(JSON.stringify({commit:committed.commit,reconciledOnlyOwned:true,remainingStaged:remaining}));process.exit(0)
}
if(!process.argv.includes('--commit'))throw Error('Explicit prepare/commit/reconcile required')
const prepared=JSON.parse(fs.readFileSync(preparedFile,'utf8'));if(git(['rev-parse','HEAD']).trim()!==prepared.base)throw Error('HEAD advanced; prepare latest base before commit')
const result=git(['commit','-m','fix(files): preserve symlink creation types during copy'],{...process.env,GIT_INDEX_FILE:prepared.index})
const match=result.match(/^\[.+ ([a-f0-9]+)\] /m);if(!match)throw Error('Cannot identify successful commit')
const commit=git(['rev-parse',match[1]]).trim()
const changed=git(['diff-tree','--no-commit-id','--name-only','-r',commit]).trim().split('\n').filter(Boolean)
if(changed.some(file=>!prepared.files.includes(file)))throw Error('Commit includes unreviewed changes; inspect concurrent parent/tree before continuing')
fs.writeFileSync(commitFile,JSON.stringify({base:prepared.base,commit,files:prepared.files,result,atUtc:new Date().toISOString()},null,2))
console.log(JSON.stringify({commit,files:prepared.files.length,reconciliationPending:true}))
