import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {gunzipSync} from 'node:zlib'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=repo+'/specs/artifacts/2026-10-22-config-admitted-discovery'
fs.copyFileSync(root+'/scan-packed.mjs',out+'/scan-packed.mjs',fs.constants.COPYFILE_EXCL)
const authPath='C:/Users/hengu/.codex/auth.json',original=fs.readFileSync(authPath),metadata=fs.statSync(authPath),source=JSON.parse(original)
const values=[...new Set([source.OPENAI_API_KEY,source.tokens?.id_token,source.tokens?.access_token,source.tokens?.refresh_token].filter(v=>typeof v==='string'&&v.length>=20))].map(v=>Buffer.from(v));assert(values.length>=3)
let files=0,bytes=0,decodedPayloads=0,decodedBytes=0,matches=0
const scan=data=>{matches+=values.some(value=>data.includes(value))?1:0}
const fileScan=file=>{const data=fs.readFileSync(file);files++;bytes+=data.length;scan(data);if(file.endsWith('.gz')){const decoded=gunzipSync(data);decodedPayloads++;decodedBytes+=decoded.length;scan(decoded)}}
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);assert(!fs.lstatSync(file).isSymbolicLink());if(e.isDirectory())walk(file);else fileScan(file)}}
walk(out)
for(const file of ['specs/README.md','specs/records/2026-10/README.md','specs/artifacts/README.md','specs/records/2026-10/2026-10-22-config-admitted-discovery.md','packages/opencorvus/src/project/project.ts','packages/opencorvus/test/project-git-discovery.test.ts','specs/current/architecture/task-runtime-directory.md'])fileScan(repo+'/'+file)
assert.equal(matches,0,'Actual credentials in final scoped delivery');assert(fs.readFileSync(authPath).equals(original));assert.equal(fs.statSync(authPath).mtimeMs,metadata.mtimeMs)
const result={at:new Date().toISOString(),files,bytes,decodedPayloads,decodedBytes,actualCredentialValueMatches:matches,scope:'All scoped raw artifacts,current518record,indexes,production,tests,architecture and all gzip decoded payloads;actual values read locally only;original source auth bytes/mtime retained'}
fs.writeFileSync(out+'/credential-scan-packed.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result))
