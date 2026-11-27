import fs from 'node:fs/promises'
import {createRequire} from 'node:module'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const scratch=path.dirname(fileURLToPath(import.meta.url))
const require=createRequire(import.meta.url)
const sharp=require('D:/myhexin-local/opencorvus/node_modules/.bun/sharp@0.35.5+0cfa9f940267aaa3/node_modules/sharp')
const name=process.argv[2]
if(!['light','dark'].includes(name))throw new Error('Explicit downloaded export required')
const input=await fs.readFile(path.join(scratch,name+'.svg'))
await sharp(input,{density:72}).png().toFile(path.join(scratch,name+'-render.png'))
const meta=await sharp(path.join(scratch,name+'-render.png')).metadata()
for(const [section,top] of [['top',0],['middle',1700],['bottom',Math.max(0,meta.height-1000)]]) {
 await sharp(path.join(scratch,name+'-render.png')).extract({left:Math.floor((meta.width-1200)/2),top,width:1200,height:1000}).png().toFile(path.join(scratch,name+'-'+section+'.png'))
}
console.log(JSON.stringify({file:name+'.svg',decoder:'installed sharp 0.35.5 / librsvg; no browser, JavaScript or network rendering',output:name+'-render.png',width:meta.width,height:meta.height,crops:'top/middle/bottom at original scale for manual document review'}))
