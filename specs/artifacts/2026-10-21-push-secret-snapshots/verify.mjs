import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),read=p=>JSON.parse(fs.readFileSync(p,'utf8'))
const before=read(root+'/before-result.json'),after=read(root+'/after-result.json')
assert.equal(before.head,after.head);assert.equal(before.indexedFiles,71757);assert.deepEqual(before.indexedSnapshots,after.indexedSnapshots)
assert.deepEqual(fs.readFileSync(repo+'/.git/index'),fs.readFileSync(root+'/index-before-private.bin'))
assert.deepEqual(before.hits,[]);assert.deepEqual(after.hits,[])
const pick=({indexedSnapshots,records,...result})=>result
const result={observedAt:new Date().toISOString(),fixedHead:before.head,indexedFiles:71757,indexSnapshots:'All71757 path/object/mode/size exactly equal;original index bytes unchanged',before:pick(before),after:pick(after),millisecondsSaved:before.wallMs-after.wallMs,ratio:after.wallMs/before.wallMs,security:'Historical CLI and real Git positive contracts checked separately;clean current-tree result is not the historical regression test',limits:'Full Config performance and UI/Sources/Rendering are not requalified by this backend tool change',modelRequests:0}
fs.writeFileSync(root+'/comparison.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
let physical=fs.readFileSync(path.resolve(root,'../git-startup-floor-493/verify-physical.ps1'),'utf8')
physical=physical.replaceAll('git-startup-floor-493','push-secret-snapshots-494').replace("@('query-a','version-a','cmd-a','cmd-b','version-b','query-b')","@('before','after')").replace('Six original scopes','Two original scopes')
fs.writeFileSync(root+'/verify-physical.ps1',physical,{flag:'wx'})
console.log(JSON.stringify({millisecondsSaved:result.millisecondsSaved,ratio:result.ratio,indexedFiles:71757,actualIndexPreserved:true}))
