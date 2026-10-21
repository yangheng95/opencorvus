import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,prior=path.resolve(root,'../native-query-scope-490')
fs.mkdirSync(root+'/native/src',{recursive:true})
for(const name of ['Cargo.toml','Cargo.lock'])fs.copyFileSync(prior+'/native/'+name,root+'/native/'+name,fs.constants.COPYFILE_EXCL)
const source=fs.readFileSync(prior+'/native/src/main.rs','utf8'),start=source.indexOf('    fn collect_query_bytes('),end=source.indexOf('    pub fn main()',start)
assert(start>=0&&end>start)
const updated=source.slice(0,start)+fs.readFileSync(root+'/stream-core.rs','utf8')+'\n\n'+source.slice(end)
fs.writeFileSync(root+'/native/src/main.rs',updated,{flag:'wx'})
fs.copyFileSync(prior+'/scope-client.ts',root+'/buffered-client.ts',fs.constants.COPYFILE_EXCL)
let buffered=fs.readFileSync(root+'/buffered-client.ts','utf8');buffered=buffered.replace("path.join(import.meta.dir,'native-target/release/opencorvus-process-supervisor.exe')","path.resolve(import.meta.dir,'../native-query-scope-490/native-target/release/opencorvus-process-supervisor.exe')")
fs.writeFileSync(root+'/buffered-client.ts',buffered)
fs.writeFileSync(root+'/plan.json',JSON.stringify({scope:'native-query-stream-522',modelRequests:0,providerAuthority:'None;no catalog/auth copied',budgets:{bufferedControl:1,contractsA:14,lifecycleA:2,conditionalContractsB:14},maximumProcessQueries:31,scopeDeadlineMs:240000,startupInactivityMs:180000,source:'Private490 native copy;only reader/response streaming changed;production untouched',runtime:'Frozen Bun1.4.0 and original413/446 outer ownership',publicEligibility:'Output-only private observer/collection;stdin/backpressure/env/general recovery remain unqualified'},null,2)+'\n',{flag:'wx'})
console.log('Fresh private native source prepared;old/production binaries retained;no process or authority staged')
