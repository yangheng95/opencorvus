import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21',authority=path.resolve(base,'git-executable-flow-492-authority'),out=path.join(repo,'specs/artifacts/2026-10-21-git-executable-flow')
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),source=read('C:/Users/hengu/.codex/auth.json'),copy=read(authority+'/auth.json').openai.info
const secrets=[source.OPENAI_API_KEY,source.tokens?.id_token,source.tokens?.access_token,source.tokens?.refresh_token,copy.access,copy.refresh].filter(v=>typeof v==='string'&&v.length>=20)
assert(secrets.length>=4)
const values=[...new Set(secrets)],eligible=/\.(?:json|jsonl|log|ts|mjs|ps1|md|patch|txt)$/i,scopes=['before','after','control-before','control-after'],hits=[],skipped=[]
let scannedFiles=0,scannedBytes=0
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,item.name),stat=fs.lstatSync(file)
 if(stat.isSymbolicLink()){skipped.push({file,reason:'symbolic link'});continue}
 if(stat.isDirectory()){walk(file);continue}
 if(!eligible.test(item.name)||['auth.json','models.json'].includes(item.name))continue
 const text=fs.readFileSync(file,'utf8');scannedFiles++;scannedBytes+=stat.size
 if(values.some(v=>text.includes(v)))hits.push(file)
}}
for(const dir of [root,out,...scopes.map(s=>base+'/git-executable-flow-492-'+s),base+'/git-executable-flow-492-before-prepare-failed-001',base+'/git-executable-flow-492-after-prepare-failed-001'])walk(dir)
for(const file of ['specs/records/2026-10/2026-10-21-git-executable-flow.md','specs/README.md','specs/records/2026-10/README.md','specs/artifacts/README.md']){const text=fs.readFileSync(path.join(repo,file),'utf8');scannedFiles++;scannedBytes+=Buffer.byteLength(text);if(values.some(v=>text.includes(v)))hits.push(file)}
assert.deepEqual(hits,[],'Actual current secret values found;retain paired authority and fix owned output before retirement')
let requests=0
for(const stage of scopes){const run=base+'/git-executable-flow-492-'+stage,proof=read(run+'/evidence/physical-terminal-and-pair-cleanup.json');assert.equal(proof.pairedCleanupComplete,true);assert.equal(proof.maximumRequests,stage.startsWith('control-')?0:2);requests+=proof.requests}
assert.equal(requests,4)
const physical=read(root+'/physical-scopes.json');assert.equal(physical.length,9);for(const scope of physical){assert.equal(scope.native.physicalCompletion,true);assert.equal(scope.native.outputDrainComplete,true);assert.equal(scope.native.requestCleanupComplete,true)}
assert.equal(path.dirname(authority),path.resolve(base))
for(const dir of [base,authority])assert.equal(fs.lstatSync(dir).isSymbolicLink(),false,'Exact private authority ancestor')
const retired=[]
for(const name of ['auth.json','models.json']){const file=path.resolve(authority,name);assert.equal(path.dirname(file),authority);const stat=fs.lstatSync(file);assert(stat.isFile()&&!stat.isSymbolicLink());fs.unlinkSync(file);retired.push({name,bytes:stat.size,outcome:'retired-after-original-physical-source-EOF-and-actual-secret-scan'})}
const result={observedAt:new Date().toISOString(),scannedFiles,scannedBytes,secretValueMatches:hits.length,skipped,scanBoundary:'Actual current access/refresh/ID/API secret values;owned text evidence/scripts/logs/specs. Credential members are expected authority,DB/binary/images are outside text scan and never archived.',originalNativeScopes:physical.length,actualModelRequests:requests,maximumModelRequests:4,controlsActualModelRequests:0,privateAuthorityPair:retired,runtimePairs:'All four exact owned pairs retired with original physical/source-reader proof',sourceAuth:'Bytes/mtime and selected access/refresh preserved in prior readonly verifier',output:'No secret values emitted'}
fs.writeFileSync(root+'/credential-cleanup.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
fs.copyFileSync(root+'/credential-cleanup.json',out+'/credential-cleanup.json',fs.constants.COPYFILE_EXCL)
fs.copyFileSync(root+'/scan-and-retire.mjs',out+'/scan-and-retire.mjs',fs.constants.COPYFILE_EXCL)
console.log(JSON.stringify({scannedFiles,scannedBytes,secretValueMatches:hits.length,originalNativeScopes:9,requests,privateAuthorityMembersRetired:retired.length}))
