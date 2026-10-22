import fs from 'node:fs'
import assert from 'node:assert/strict'
import {prepareModelImageInput,readModelImageDimensions} from '../../packages/opencorvus/src/session/model-image-input'
const file=process.argv[2],output=process.argv[3];assert(file&&output)
const before=fs.statSync(file),bytes=fs.readFileSync(file),startedAt=Date.now()
const prepared=await prepareModelImageInput({mime:'image/png',bytes,source:'537 actual arXiv tool attachment'})
assert.equal(prepared.mime,'image/png');assert(prepared.bytes.length>0)
const dimensions=readModelImageDimensions(prepared.bytes);assert(dimensions&&dimensions.width>0&&dimensions.height>0)
assert.deepEqual(fs.readFileSync(file),bytes);assert.equal(fs.statSync(file).mtimeMs,before.mtimeMs)
const nativeModules=Object.keys(require.cache).filter(key=>key.endsWith('.node')&&key.includes('sharp'))
assert(nativeModules.some(key=>key.endsWith('sharp-win32-x64-0.35.5.node')))
const result={at:new Date().toISOString(),runtime:Bun.version,revision:Bun.revision,source:'Original persisted 537 arXiv PNG;input bytes and mtime retained',input:{bytes:bytes.length,dimensions:readModelImageDimensions(bytes)},output:{bytes:prepared.bytes.length,mime:prepared.mime,dimensions,crop:prepared.crop,resize:prepared.resize},nativeModules,elapsedMs:Date.now()-startedAt,contract:'Actual production prepareModelImageInput including sharp trim/encode;positive output;no Provider or UI automation'}
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result))
