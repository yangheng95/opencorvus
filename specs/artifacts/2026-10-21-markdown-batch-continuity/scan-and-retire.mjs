import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21',authority=path.resolve(base,'markdown-batch-continuity-497-authority'),out=repo+'/specs/artifacts/2026-10-21-markdown-batch-continuity'
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),source=read('C:/Users/hengu/.codex/auth.json'),copy=read(authority+'/auth.json').openai.info
const values=[...new Set([source.OPENAI_API_KEY,source.tokens?.id_token,source.tokens?.access_token,source.tokens?.refresh_token,copy.access,copy.refresh].filter(v=>typeof v==='string'&&v.length>=20))]
assert(values.length>=3)
const hits=[],skipped=[],eligible=/\.(?:json|jsonl|log|ts|mjs|ps1|md|patch|txt)$/i
let scannedFiles=0,scannedBytes=0,requests=0
function scan(file){const body=fs.readFileSync(file,'utf8');scannedFiles++;scannedBytes+=Buffer.byteLength(body);if(values.some(v=>body.includes(v)))hits.push(file)}
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,entry.name),stat=fs.lstatSync(file)
 if(stat.isSymbolicLink()){skipped.push({file,reason:'symbolic link'});continue}
 if(stat.isDirectory()){walk(file);continue}
 if(eligible.test(entry.name)&&!['auth.json','models.json'].includes(entry.name))scan(file)
}}
for(const dir of [root,out,...['before','after'].map(s=>base+'/markdown-batch-continuity-497-'+s)])walk(dir)
for(const file of ['specs/records/2026-10/2026-10-21-markdown-batch-continuity.md','specs/README.md','specs/records/2026-10/README.md','specs/artifacts/README.md'])scan(path.join(repo,file))
assert.equal(hits.length,0,'Owned output contains actual credential values')
for(const stage of ['before','after']){
 const proof=read(base+'/markdown-batch-continuity-497-'+stage+'/evidence/physical-terminal-and-pair-cleanup.json')
 assert.equal(proof.pairedCleanupComplete,true);assert.equal(proof.maximumRequests,8)
 for(const field of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[field],true)
 requests+=proof.requests
}
assert.equal(requests,read(root+'/runtime-qualification.json').actualRequests)
assert.equal(path.dirname(authority),path.resolve(base))
for(const dir of [base,authority])assert.equal(fs.lstatSync(dir).isSymbolicLink(),false)
const retired=[]
for(const name of ['auth.json','models.json']){
 const file=path.resolve(authority,name);assert.equal(path.dirname(file),authority)
 const stat=fs.lstatSync(file);assert(stat.isFile()&&!stat.isSymbolicLink())
 fs.unlinkSync(file);retired.push({name,bytes:stat.size,outcome:'retired-after-original-physical-source-EOF-and-actual-secret-scan'})
}
const result={observedAt:new Date().toISOString(),scannedFiles,scannedBytes,secretValueMatches:hits.length,skipped,scanBoundary:'Actual current access/refresh/ID/API values in owned text/scripts/logs/specs. Credential members are expected authority;DB/binary/images excluded and no private DB archived.',originalNativeScopes:2,actualModelRequests:requests,maximumModelRequests:16,unusedRequestAllowance:16-requests,privateAuthorityPair:retired,runtimePairs:'Both exact owned auth/models pairs retired after original physical and source-reader EOF proof',sourceAuth:'Original bytes/mtime/access/refresh and full catalog preserved by readonly verifier',output:'No credential values emitted'}
fs.writeFileSync(root+'/credential-cleanup.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
fs.copyFileSync(root+'/credential-cleanup.json',out+'/credential-cleanup.json',fs.constants.COPYFILE_EXCL)
fs.copyFileSync(root+'/scan-and-retire.mjs',out+'/scan-and-retire.mjs',fs.constants.COPYFILE_EXCL)
console.log(JSON.stringify({scannedFiles,scannedBytes,secretValueMatches:hits.length,requests,maximum:16,privateAuthorityMembersRetired:retired.length}))
