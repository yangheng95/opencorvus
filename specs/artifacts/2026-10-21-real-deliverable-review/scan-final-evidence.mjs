import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),artifact=repo+'/specs/artifacts/2026-10-21-real-deliverable-review'
const meta=JSON.parse(fs.readFileSync(root+'/authority-preparation.json'))
const stat=fs.statSync(meta.source);assert.equal(stat.size,meta.sourceBytes);assert.equal(stat.mtimeMs,meta.sourceModifiedAtMs)
const auth=JSON.parse(fs.readFileSync(meta.source)),values=[auth.OPENAI_API_KEY,auth.tokens?.id_token,auth.tokens?.access_token,auth.tokens?.refresh_token].filter(value=>typeof value==='string'&&value.length>=20)
assert(values.length>=3)
const files=fs.readdirSync(artifact).map(name=>artifact+'/'+name).filter(file=>fs.statSync(file).isFile())
files.push(repo+'/specs/records/2026-10/2026-10-21-real-deliverable-review.md')
let bytes=0,hits=0
for(const file of files){const data=fs.readFileSync(file);bytes+=data.length;for(const value of values)if(data.includes(Buffer.from(value)))hits++}
assert.equal(hits,0,'Actual source credential value found in owned evidence')
const result={observedAt:new Date().toISOString(),files:files.length,bytes,actualCredentialValueMatches:hits,originalSourceAuthBytesAndModifiedAt:'Exact original preparation metadata',privateAuthorityPairs:'Already retired;none staged for recovery scopes'}
fs.writeFileSync(root+'/final-credential-scan.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
fs.copyFileSync(root+'/final-credential-scan.json',artifact+'/final-credential-scan.json',fs.constants.COPYFILE_EXCL)
fs.copyFileSync(root+'/scan-final-evidence.mjs',artifact+'/scan-final-evidence.mjs',fs.constants.COPYFILE_EXCL)
console.log(JSON.stringify(result))
