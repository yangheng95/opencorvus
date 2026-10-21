import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {gzipSync,gunzipSync} from 'node:zlib'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=repo+'/specs/artifacts/2026-10-22-native-query-stream'
const scripts=['prepare.mjs','stream-core.rs','stream-client.ts','buffered-client.ts','buffered-control.ts','buffered-control-before-observer-fix.ts','handshake-observer.ts','handshake-program.mjs','contracts.ts','owner-fixture.ts','owner-target.mjs','lifecycle.ts','launch.ps1','audit-scopes.ps1','plan.json','plan-before-observer-repair.json','archive.mjs']
for(const name of scripts)fs.copyFileSync(root+'/'+name,out+'/'+name,fs.constants.COPYFILE_EXCL)
const raw=['build.log','buffered-control.log','buffered-control-result.json','buffered-control-callback.log','buffered-control-callback-result.json','contracts-a.log','contracts-a-result.json','lifecycle-a.log','lifecycle-a-result.json','physical-summary.json','native-source.diff']
for(const name of raw){const bytes=fs.readFileSync(root+'/'+name),z=gzipSync(bytes);assert(gunzipSync(z).equals(bytes));fs.writeFileSync(out+'/'+name+'.gz',z,{flag:'wx'})}
const native=fs.readFileSync(root+'/native/src/main.rs');fs.writeFileSync(out+'/native-main.rs.gz',gzipSync(native),{flag:'wx'});assert(gunzipSync(fs.readFileSync(out+'/native-main.rs.gz')).equals(native))
for(const name of ['Cargo.toml','Cargo.lock']){assert(fs.readFileSync(root+'/native/'+name).equals(fs.readFileSync(repo+'/.tmp-product-iteration/native-query-scope-490/native/'+name)));fs.copyFileSync(root+'/native/'+name,out+'/'+name,fs.constants.COPYFILE_EXCL)}
console.log(JSON.stringify({copiedScripts:scripts.length,rawCompressed:raw.length,completeNativeSource:true,manifestAndLockMatchOriginal490:true}))
