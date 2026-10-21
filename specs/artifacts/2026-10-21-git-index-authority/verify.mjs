import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),read=name=>JSON.parse(fs.readFileSync(root+'/'+name,'utf8')),before=read('before-result.json'),after=read('after-result.json')
assert.equal(before.head,after.head);assert.equal(before.indexedFiles,71787);assert.equal(after.indexedFiles,before.indexedFiles)
const identity=rows=>rows.map(({file,objectId,mode})=>({file,objectId,mode}))
assert.deepEqual(identity(before.indexedSnapshots),identity(after.indexedSnapshots));assert.deepEqual(fs.readFileSync(repo+'/.git/index'),fs.readFileSync(root+'/index-before-private.bin'))
const tree=spawnSync('git',['-C',repo,'ls-tree','-r','-z','-l',after.head],{windowsHide:true,maxBuffer:64*1024*1024});if(tree.error)throw tree.error;assert.equal(tree.status,0,tree.stderr.toString())
const actual=tree.stdout.toString('utf8').split('\0').filter(Boolean).map(record=>{const tab=record.indexOf('\t'),[mode,type,objectId,size]=record.slice(0,tab).split(/\s+/);assert(['blob','commit'].includes(type));return{file:record.slice(tab+1),objectId,mode:Number.parseInt(mode,8),size:type==='commit'?0:Number(size)}})
assert.deepEqual(after.indexedSnapshots,actual,'New index sizes match the actual immutable tip objects,not stale stat cache')
const corrected=before.indexedSnapshots.flatMap((row,index)=>row.size===after.indexedSnapshots[index].size?[]:[{file:row.file,objectId:row.objectId,cachedSize:row.size,actualBlobSize:after.indexedSnapshots[index].size}])
const pick=({indexedSnapshots,records,...result})=>result
const comparison={observedAt:new Date().toISOString(),head:before.head,indexedFiles:71787,identities:'All original path/OID/mode identical;actual index bytes unchanged',sizes:'All after sizes equal actual immutable Git tree blob metadata',correctedCachedSizes:corrected.length,correctedExamples:corrected.slice(0,20),before:pick(before),after:pick(after),wallDeltaMs:after.wallMs-before.wallMs,ratio:after.wallMs/before.wallMs,disposition:'Keep positive correctness/security repair;sample is slightly slower,not a performance optimization',modelRequests:0,scope:'Index and credential checker only;not full Config or UI acceptance'}
fs.writeFileSync(root+'/comparison.json',JSON.stringify(comparison,null,2)+'\n',{flag:'wx'})
let physical=fs.readFileSync(path.resolve(root,'../push-secret-snapshots-494/verify-physical.ps1'),'utf8').replaceAll('push-secret-snapshots-494','git-index-authority-495')
fs.writeFileSync(root+'/verify-physical.ps1',physical,{flag:'wx'})
console.log(JSON.stringify({indexedFiles:71787,correctedCachedSizes:corrected.length,wallDeltaMs:comparison.wallDeltaMs,ratio:comparison.ratio,actualIndexPreserved:true}))
