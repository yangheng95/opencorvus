import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,prior=path.resolve(root,'../git-selection-cost-519'),input=JSON.parse(fs.readFileSync(prior+'/input-private.json','utf8'))
assert.equal(input.source,'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/config-admitted-discovery-518-after')
const database=input.source+'/runtime/data/opencorvus.db',canonical=input.source+'/runtime/config/opencorvus.jsonc'
assert(fs.readFileSync(database).equals(fs.readFileSync(prior+'/database-private.bin')));assert(fs.readFileSync(canonical).equals(fs.readFileSync(prior+'/canonical-private.bin')))
for(const [file,metadata]of [[database,input.databaseMetadata],[canonical,input.canonicalMetadata]]){const stat=fs.statSync(file);assert.equal(stat.size,metadata.size);assert.equal(stat.mtimeMs,metadata.mtimeMs)}
for(const item of input.projects){const stat=await fsp.stat(item.worktree,{bigint:true});assert.equal(String(stat.dev),item.device);assert.equal(String(stat.ino),item.inode);assert.equal(await fsp.realpath(item.worktree),item.physical)}
const result={at:new Date().toISOString(),source:input.source,baseline:'Actual closed519 byte snapshots and complete directory observations',database:'Exact original bytes/size/mtime',canonical:'Exact complete original bytes/size/mtime',directories:input.projects.length,physical:'Every original dev/inode/realpath exact',boundary:'Actual immutable closed-source data identity/integrity comparison;no source initializer or mutable-code hash check;original rows independently verified in both scope preservation results'}
const output=process.argv[2]??'source-bytes-and-directories.json';assert(/^[a-z0-9-]+\.json$/.test(output))
fs.writeFileSync(root+'/'+output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result))
