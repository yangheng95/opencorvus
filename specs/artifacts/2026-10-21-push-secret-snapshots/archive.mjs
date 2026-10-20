import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import assert from 'node:assert/strict'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=path.join(repo,'specs/artifacts/2026-10-21-push-secret-snapshots')
assert.deepEqual(fs.readdirSync(out),['README.md'],'Only the already-authored owned README precedes archive initialization')
const read=p=>JSON.parse(fs.readFileSync(root+'/'+p,'utf8'))
for(const name of ['reproduce-before.mjs','before-reproduction.json','after-reproduction.json','after-reproduction-final.json','prepare-benchmark.mjs','launch.ps1','benchmark.ts','verify.mjs','verify-physical.ps1','verify-source.ts','archive.mjs','archive-before-readme-fix.mjs','comparison.json','physical-scopes.json','source-preserved.json','tests-first.log','tests-final.log','scanner-types.log','scanner-types-fixed.log','scanner-types-final.log','before-benchmark.log','after-benchmark.log'])fs.copyFileSync(root+'/'+name,out+'/'+name,fs.constants.COPYFILE_EXCL)
function gzip(name,bytes){const compressed=zlib.gzipSync(bytes,{level:9});assert.deepEqual(zlib.gunzipSync(compressed),bytes);fs.writeFileSync(out+'/'+name,compressed,{flag:'wx'})}
gzip('secret-scan-before.ts.txt.gz',fs.readFileSync(root+'/secret-scan-before.ts'))
const before=read('before-result.json'),after=read('after-result.json');assert.deepEqual(before.indexedSnapshots,after.indexedSnapshots)
gzip('indexed-snapshots.json.gz',Buffer.from(JSON.stringify(before.indexedSnapshots)))
for(const [name,result]of [['before',before],['after',after]]){const{indexedSnapshots,...summary}=result;fs.writeFileSync(out+'/'+name+'-result.json',JSON.stringify(summary,null,2)+'\n',{flag:'wx'})}
const physical=read('physical-scopes.json');assert.equal(physical.length,2);for(const row of physical){assert.equal(row.native.physicalCompletion,true);assert.equal(row.native.outputDrainComplete,true);assert.equal(row.native.requestCleanupComplete,true);assert.equal(row.runtimeDataFiles.length,0)}
console.log(JSON.stringify({files:fs.readdirSync(out).length,indexedSnapshots:before.indexedSnapshots.length,modelRequests:0,privateSourceData:'excluded',credentialCopies:0}))
