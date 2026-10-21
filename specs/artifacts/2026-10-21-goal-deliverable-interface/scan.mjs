import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21',out=repo+'/specs/artifacts/2026-10-21-goal-deliverable-interface'
const source=JSON.parse(fs.readFileSync('C:/Users/hengu/.codex/auth.json','utf8'))
const values=[...new Set([source.OPENAI_API_KEY,source.tokens?.id_token,source.tokens?.access_token,source.tokens?.refresh_token].filter(v=>typeof v==='string'&&v.length>=20))];assert(values.length>=3)
const eligible=/\.(?:json|jsonl|log|ts|mjs|ps1|md|patch|txt)$/i,hits=[],skipped=[];let scannedFiles=0,scannedBytes=0
function scan(file){const body=fs.readFileSync(file,'utf8');scannedFiles++;scannedBytes+=Buffer.byteLength(body);if(values.some(v=>body.includes(v)))hits.push(file)}
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name),stat=fs.lstatSync(file);if(stat.isSymbolicLink()){skipped.push({file,reason:'symbolic link'});continue}if(stat.isDirectory())walk(file);else if(eligible.test(entry.name))scan(file)}}
for(const dir of [root,out,...['before','after'].map(s=>base+'/goal-deliverable-interface-500-'+s)])walk(dir)
for(const file of ['specs/records/2026-10/2026-10-21-goal-deliverable-interface.md','specs/README.md','specs/records/2026-10/README.md','specs/artifacts/README.md'])scan(path.join(repo,file))
assert.equal(hits.length,0,'Owned output contains actual credential values')
const result={observedAt:new Date().toISOString(),scannedFiles,scannedBytes,secretValueMatches:hits.length,skipped,boundary:'Actual current ID/access/refresh/API values checked only for security scanning;no values emitted. Owned text/scripts/logs/specs,including private full original-row JSON;DB/binary/images excluded. No raw DB or whole history JSON archived.',credentialMembersCopied:0,modelInputs:0,authority:'No runtime auth/models pair staged;source499 had no pair;no additional credential retirement necessary'}
fs.writeFileSync(root+'/secret-scan.json',JSON.stringify(result,null,2)+'\n')
fs.copyFileSync(root+'/secret-scan.json',out+'/secret-scan.json')
fs.copyFileSync(root+'/scan.mjs',out+'/scan.mjs')
console.log(JSON.stringify({scannedFiles,scannedBytes,secretValueMatches:hits.length,modelInputs:0}))
