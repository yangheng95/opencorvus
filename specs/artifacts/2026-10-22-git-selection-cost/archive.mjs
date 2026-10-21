import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {gzipSync,gunzipSync} from 'node:zlib'
const root=import.meta.dirname,out=path.resolve(root,'../../specs/artifacts/2026-10-22-git-selection-cost')
const copy=name=>fs.copyFileSync(root+'/'+name,out+'/'+name,fs.constants.COPYFILE_EXCL)
const compressed=name=>{const raw=fs.readFileSync(root+'/'+name),gzip=gzipSync(raw);assert(gunzipSync(gzip).equals(raw));fs.writeFileSync(out+'/'+name+'.gz',gzip,{flag:'wx'})}
for(const name of ['prepare.ts','components.ts','launch.ps1','verify-source.ts','verify-physical.ps1','analyse.mjs','archive.mjs','preparation.json','analysis.json','source-preserved.json','source-verification-tool-failure.json'])copy(name)
for(const run of ['resolve-a','ordinary-a','selected-a','selected-b','ordinary-b','resolve-b'])for(const suffix of ['-result.json','.log'])compressed(run+suffix)
for(const name of ['physical-scopes.json','verify-source-before-json-normalization.ts','source-preserved.log'])compressed(name)
console.log(JSON.stringify({files:fs.readdirSync(out).length,compressedPayloads:15,boundary:'Original raw results/logs and script failure snapshot compressed losslessly;private database/input rows/config snapshots excluded'}))
