import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import zlib from 'node:zlib'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=path.join(repo,'specs/artifacts/2026-10-21-git-index-authority')
assert.equal(fs.existsSync(out),false);fs.mkdirSync(out)
const names=['reproduce.mjs','before-reproduction.json','verify-reproductions.mjs','after-reproduction.json','probe-crlf.mjs','crlf-reproduction.json','prepare-benchmark.mjs','launch.ps1','benchmark.ts','verify.mjs','verify-physical.ps1','verify-source.ts','archive.mjs','comparison.json','physical-scopes.json','source-preserved.json','tests-first.log','tests-final.log','tests-complete.log','tests-qualified.log','scanner-types.log','scanner-types-final.log','scanner-types-qualified.log','before-benchmark.log','after-benchmark.log']
for(const name of names)fs.copyFileSync(root+'/'+name,out+'/'+name,fs.constants.COPYFILE_EXCL)
function gzip(name,bytes){const data=zlib.gzipSync(bytes,{level:9});assert.deepEqual(zlib.gunzipSync(data),bytes);fs.writeFileSync(out+'/'+name,data,{flag:'wx'})}
gzip('secret-scan-before.ts.txt.gz',fs.readFileSync(root+'/secret-scan-before.ts'))
const before=JSON.parse(fs.readFileSync(root+'/before-result.json','utf8')),after=JSON.parse(fs.readFileSync(root+'/after-result.json','utf8'))
gzip('index-snapshots.json.gz',Buffer.from(JSON.stringify(after.indexedSnapshots)))
const corrections=before.indexedSnapshots.flatMap((row,index)=>row.size===after.indexedSnapshots[index].size?[]:[{file:row.file,objectId:row.objectId,cachedSize:row.size,actualBlobSize:after.indexedSnapshots[index].size}]);assert.equal(corrections.length,19741)
gzip('cached-stat-corrections.json.gz',Buffer.from(JSON.stringify(corrections)))
for(const[name,result]of [['before',before],['after',after]]){const{indexedSnapshots,...summary}=result;fs.writeFileSync(out+'/'+name+'-result.json',JSON.stringify(summary,null,2)+'\n',{flag:'wx'})}
const physical=JSON.parse(fs.readFileSync(root+'/physical-scopes.json','utf8'));assert.equal(physical.length,2);for(const scope of physical){assert.equal(scope.native.physicalCompletion,true);assert.equal(scope.native.outputDrainComplete,true);assert.equal(scope.native.requestCleanupComplete,true);assert.equal(scope.runtimeDataFiles.length,0)}
console.log(JSON.stringify({files:fs.readdirSync(out).length,indexedFiles:after.indexedFiles,correctedCachedSizes:corrections.length,modelRequests:0,credentialCopies:0,sourceDatabase:'excluded'}))
