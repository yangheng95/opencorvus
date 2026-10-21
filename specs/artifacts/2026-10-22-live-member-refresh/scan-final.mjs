import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),destination=repo+'/specs/artifacts/2026-10-22-live-member-refresh'
const preparation=JSON.parse(fs.readFileSync(root+'/before-authority-preparation.json','utf8')),source=JSON.parse(fs.readFileSync(preparation.source,'utf8'))
const values=[...new Set([source.OPENAI_API_KEY,source.tokens?.id_token,source.tokens?.access_token,source.tokens?.refresh_token].filter(value=>typeof value==='string'&&value.length>=20))].map(value=>Buffer.from(value))
assert(values.length>=3)
let files=0,bytes=0,matches=0
const scan=file=>{const buffer=fs.readFileSync(file);files++;bytes+=buffer.length;matches+=values.some(value=>buffer.includes(value))?1:0}
const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);assert(!fs.lstatSync(file).isSymbolicLink());if(entry.isDirectory())walk(file);else scan(file)}}
walk(destination)
for(const file of ['specs/README.md','specs/records/2026-10/README.md','specs/artifacts/README.md','specs/records/2026-10/2026-10-22-live-member-refresh.md'])scan(repo+'/'+file)
assert.equal(matches,0,'Actual credentials detected in scoped archive')
const result={at:new Date().toISOString(),files,bytes,actualCredentialValueMatches:matches,scope:'All current scoped artifact bytes including current images, current record and three indexes; actual original credential values read only for local equality scan, never exported'}
fs.writeFileSync(destination+'/archive-final-credential-scan.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify(result))
