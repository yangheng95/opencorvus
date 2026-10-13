import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-13/file-alias-after-final-01a133'
const directory=path.join(run,'project'), expected=fs.readFileSync(path.join(directory,'notes.txt'),'utf8')
const rows=[]
for(const file of ['notes.txt','./notes.txt','folder/../notes.txt','missing/../notes.txt','../project/notes.txt']){
 const response=await fetch('http://localhost:18438/file/content?'+new URLSearchParams({directory,path:file}),{signal:AbortSignal.timeout(15000)})
 const body=await response.json()
 assert.equal(response.status,200)
 assert.equal(body.type,'text')
 assert.equal(body.content,expected)
 assert.equal(typeof body.revision,'string')
 assert.deepEqual(body.patch.hunks,[{oldStart:1,oldLines:3,newStart:1,newLines:3,lines:['-first line','+first line edited\r',' Alias ORIGINAL\r',' third line\r']}])
 if(rows.length)assert.equal(body.revision,rows[0].body.revision)
 rows.push({file,status:response.status,body})
}
fs.writeFileSync('specs/artifacts/2026-10-13-file-alias-identity/after-final/raw-alias-api.json',JSON.stringify({boundary:'Actual independent development service HTTP before manual save; unchanged authored Git baseline',rows},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({passed:true,aliases:rows.length,oldLines:3,newLines:3}))
