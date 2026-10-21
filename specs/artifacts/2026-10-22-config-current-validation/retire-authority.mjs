import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const stage=process.argv[2];assert(stage==='before');const root=import.meta.dirname,repo=path.resolve(root,'../..'),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22',authority=base+'/config-current-validation-521-'+stage+'-authority',run=base+'/config-current-validation-521-'+stage
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),meta=read(root+'/'+stage+'-authority-preparation.json'),proof=read(run+'/evidence/physical-terminal-and-pair-cleanup.json'),source=read(meta.source),copy=read(authority+'/auth.json').openai.info
assert.equal(proof.pairedCleanupComplete,true);assert.equal(proof.maximumRequests,4);assert(proof.requests<=4)
for(const field of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[field],true)
const stat=fs.statSync(meta.source);assert.equal(stat.size,meta.sourceBytes);assert.equal(stat.mtimeMs,meta.sourceModifiedAtMs)
assert.equal(source.tokens.access_token,copy.access);assert.equal(source.tokens.refresh_token,copy.refresh)
const catalogStat=fs.statSync(meta.catalogSource);assert(fs.readFileSync(meta.catalogSource).equals(fs.readFileSync(authority+'/models.json')));assert.equal(catalogStat.mtimeMs,meta.catalogSourceModifiedAtMs)
const values=[...new Set([source.OPENAI_API_KEY,source.tokens?.id_token,source.tokens?.access_token,source.tokens?.refresh_token,copy.access,copy.refresh].filter(v=>typeof v==='string'&&v.length>=20))];assert(values.length>=3)
let scannedFiles=0,scannedBytes=0;const hits=[]
function scan(file){const data=fs.readFileSync(file,'utf8');scannedFiles++;scannedBytes+=Buffer.byteLength(data);if(values.some(value=>data.includes(value)))hits.push(file)}
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(fs.lstatSync(file).isSymbolicLink())continue;if(e.isDirectory())walk(file);else if(/\.(?:json|jsonl|log|ts|mjs|ps1|md|txt)$/i.test(e.name))scan(file)}}
for(const dir of [root,run])walk(dir)
scan(repo+'/specs/records/2026-10/2026-10-22-config-current-validation.md')
assert.equal(hits.length,0,'Owned outputs contain actual credential values')
assert.equal(path.dirname(authority),base)
for(const dir of [base,authority])assert.equal(fs.lstatSync(dir).isSymbolicLink(),false)
const retired=[]
for(const name of ['auth.json','models.json']){const file=path.resolve(authority,name);assert.equal(path.dirname(file),path.resolve(authority));const current=fs.lstatSync(file);assert(current.isFile()&&!current.isSymbolicLink());fs.unlinkSync(file);retired.push({name,bytes:current.size,outcome:'Retired after original native,source EOF,runtime pair retirement and actual-value scan'})}
const result={at:new Date().toISOString(),scannedFiles,scannedBytes,secretValueMatches:hits.length,sourceAuth:{bytes:stat.size,modifiedAtMs:stat.mtimeMs,access:'exact original',refresh:'exact original'},sourceCatalog:{bytes:catalogStat.size,currentModifiedAtMs:catalogStat.mtimeMs,bytesExact:true,modifiedBeforePreparation:true,boundary:'Original catalog mtime exactly matches preparation;complete bytes equal captured pair'},runtimePair:'Both members retired by original physical/source-EOF settlement',retired,requests:proof.requests,maximumRequests:proof.maximumRequests,allActualRequests:proof.providerQualificationPassed?'gpt-6.1-sol,stream=true,200,original source EOF':{qualification:'failed',originalFailures:proof.qualificationFailures},status:'Configured workspace review source/runtime pairs physically retired; actual Task outcome retained separately; no credential-bearing service remains'}
fs.writeFileSync(root+'/'+stage+'-authority-retirement.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({scannedFiles,scannedBytes,secretValueMatches:hits.length,privateAuthorityMembersRetired:retired.length,requests:proof.requests,maximum:proof.maximumRequests}))
