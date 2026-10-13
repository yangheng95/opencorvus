import fs from 'node:fs'
import path from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'
const repo=process.cwd(), artifact=path.join(repo,'specs/artifacts/2026-10-13-explorer-copy-convergence')
const scratch=path.join(repo,'.tmp-codex-explorer-01a133')
const rows=[]
function copy(source,target){
 const raw=fs.readFileSync(source), compressed=/\.log$|native-host\.ts$/.test(source)
 const output=compressed?gzipSync(raw):raw
 const destination=path.join(artifact,target+(compressed?'.gz':''))
 fs.mkdirSync(path.dirname(destination),{recursive:true})
 fs.writeFileSync(destination,output)
 if(compressed&&!gunzipSync(fs.readFileSync(destination)).equals(raw))throw Error('Lossless log archival failed')
 rows.push({source,target:path.relative(artifact,destination).replaceAll('\\','/'),rawBytes:raw.length,storedBytes:output.length})
}
for(const file of fs.readdirSync(scratch)){
 if(/\.log$/.test(file))copy(path.join(scratch,file),'validation/'+file)
}
for(const file of ['launch.ps1','launch-before.ps1','native-host.ts','shutdown.ps1','recovery-shutdown.ps1','verify-files.mjs','archive.mjs'])copy(path.join(scratch,file),'reviewed-scripts/'+file)
const rootEvidence=path.join(repo,'.tmp-codex-file-root-01a133')
for(const file of fs.readdirSync(rootEvidence)){
 if(/\.json$|\.log$/.test(file))copy(path.join(rootEvidence,file),'root-contract/'+file)
}
const runs=[['before-failed','explorer-before-01a133'],['before02','explorer-before-02-01a133'],['after','explorer-after-01a133']]
for(const [prefix,run] of runs){
 const directory=path.join('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-13',run)
 for(const file of ['startup.json','launch-owner.json','recovery-launch-owner.json','stdout.log','stderr.log']){
  const source=path.join(directory,file)
  if(fs.existsSync(source))copy(source,'runtime/'+prefix+'/'+file)
 }
 const evidence=path.join(directory,'evidence')
 if(fs.existsSync(evidence))for(const file of fs.readdirSync(evidence))if(/\.json$/.test(file))copy(path.join(evidence,file),'runtime/'+prefix+'/'+file)
}
fs.writeFileSync(path.join(artifact,'archive-manifest.json'),JSON.stringify({rows,boundary:'Exact owned sources only; log gzip verified by restored bytes. No summary or mutable-source digest acceptance.'},null,2)+'\n')
console.log(JSON.stringify({archived:rows.length}))
