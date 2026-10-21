import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {gunzipSync} from 'node:zlib'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=repo+'/specs/artifacts/2026-10-22-config-source-order'
fs.copyFileSync(root+'/scan-delivery.mjs',out+'/scan-delivery.mjs',fs.constants.COPYFILE_EXCL)
const authPath='C:/Users/hengu/.codex/auth.json',original=fs.readFileSync(authPath),metadata=fs.statSync(authPath),source=JSON.parse(original)
const values=[...new Set([source.OPENAI_API_KEY,source.tokens?.id_token,source.tokens?.access_token,source.tokens?.refresh_token].filter(v=>typeof v==='string'&&v.length>=20))].map(v=>Buffer.from(v));assert(values.length>=3)
let files=0,bytes=0,decodedPayloads=0,decodedBytes=0,matches=0
const scan=data=>{matches+=values.some(value=>data.includes(value))?1:0}
const fileScan=file=>{const data=fs.readFileSync(file);files++;bytes+=data.length;scan(data);if(file.endsWith('.gz')){const decoded=gunzipSync(data);decodedPayloads++;decodedBytes+=decoded.length;scan(decoded)}}
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);assert(!fs.lstatSync(file).isSymbolicLink());if(e.isDirectory())walk(file);else fileScan(file)}}
walk(out)
for(const file of ['specs/README.md','specs/records/2026-10/README.md','specs/artifacts/README.md','specs/records/2026-10/2026-10-22-config-source-order.md','packages/opencorvus/src/config/config.ts','packages/opencorvus/test/config-source-precedence.test.ts','packages/opencorvus/test/fixture/config-source-reader.ts','specs/current/architecture/05-config.md'])fileScan(repo+'/'+file)
assert.equal(matches,0,'Actual credentials in final scoped delivery');assert(fs.readFileSync(authPath).equals(original));assert.equal(fs.statSync(authPath).mtimeMs,metadata.mtimeMs)
const result={at:new Date().toISOString(),files,bytes,decodedPayloads,decodedBytes,actualCredentialValueMatches:matches,scope:'All current520 artifacts/gzip decoded payloads/production/tests/architecture/record/three indexes;actual values read locally only;source auth bytes/mtime retained;scanner itself stages no authority and calls no provider;batch actual4of8 is recorded in resource-summary'}
fs.writeFileSync(out+'/credential-scan-delivery.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result))
