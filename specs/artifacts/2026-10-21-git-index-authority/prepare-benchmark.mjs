import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,previous=path.resolve(root,'../push-secret-snapshots-494')
let launch=fs.readFileSync(previous+'/launch.ps1','utf8');assert(launch.includes('push-secret-snapshots-494'));launch=launch.replaceAll('push-secret-snapshots-494','git-index-authority-495');fs.writeFileSync(root+'/launch.ps1',launch,{flag:'wx'})
let benchmark=fs.readFileSync(previous+'/benchmark.ts','utf8')
benchmark=benchmark.replaceAll('696cc64789091306bde46d93c7a43a436af8d8ce','565567a64d27f0e35f5b40d35ec8e2404c79fa25').replaceAll('same696cc6478','same565567a64')
const old="hits=scanner.scan(mode==='before'?{repoRoot:repo,refs:[head]}:{repoRoot:repo,pushUpdates:[{localRef:'refs/heads/main',localObjectId:head,remoteRef:'refs/heads/main',remoteObjectId:head}]})"
assert(benchmark.includes(old));benchmark=benchmark.replace(old,"hits=scanner.scan({repoRoot:repo,pushUpdates:[{localRef:'refs/heads/main',localObjectId:head,remoteRef:'refs/heads/main',remoteObjectId:head}]})")
fs.writeFileSync(root+'/benchmark.ts',benchmark,{flag:'wx'})
for(const name of ['input-private.json','verify-source.ts'])fs.copyFileSync(previous+'/'+name,root+'/'+name,fs.constants.COPYFILE_EXCL)
fs.copyFileSync(path.resolve(root,'../../.git/index'),root+'/index-before-private.bin',fs.constants.COPYFILE_EXCL)
console.log('Frozen565567a64 tip/exact actual index and same four-field hook input prepared;no predefined file count or size equality')
