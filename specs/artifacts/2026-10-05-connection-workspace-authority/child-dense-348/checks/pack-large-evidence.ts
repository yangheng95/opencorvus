import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {gzipSync,gunzipSync} from 'node:zlib'
const root=path.resolve('specs/artifacts/2026-10-05-connection-workspace-authority/child-dense-348')
const scratch=path.resolve('.tmp-product-iteration/child-dense-348')
const receipts=[]
for(const name of ['child-dense-348-live-01-final-provider-audit.json','child-dense-348-live-01-http-summary.json']){
 const from=path.join(root,'live-01',name),dest=path.join(scratch,name),raw=fs.readFileSync(from),zip=gzipSync(raw,{level:9})
 assert.equal(gunzipSync(zip).equals(raw),true)
 fs.writeFileSync(from+'.gz',zip,{flag:'wx'});if(fs.existsSync(dest))throw Error('Preserve private original')
 fs.renameSync(from,dest);receipts.push({archive:'live-01/'+name+'.gz',privateOriginal:dest,rawBytes:raw.length,archiveBytes:zip.length,integrity:'Actual decompressed bytes equal full redacted original'})
}
fs.writeFileSync(path.join(root,'checks/large-evidence-archives.json'),JSON.stringify(receipts,null,2)+'\n',{flag:'wx'})
fs.copyFileSync(path.join(scratch,'pack-large-evidence.ts'),path.join(root,'checks/pack-large-evidence.ts'),fs.constants.COPYFILE_EXCL)
console.log(JSON.stringify(receipts))
