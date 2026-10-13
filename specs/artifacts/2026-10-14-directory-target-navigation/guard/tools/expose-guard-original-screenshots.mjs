import fs from 'node:fs'
import path from 'node:path'
import {gunzipSync} from 'node:zlib'
const root=path.resolve('specs/artifacts/2026-10-14-directory-target-navigation')
const manifestPath=path.join(root,'guard/archive-manifest.json')
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'))
const changes=[]
for(const item of manifest.files){
 if(!item.target.startsWith('guard/screenshots/')||!item.target.endsWith('.jpg.gz'))continue
 const packedPath=path.resolve(root,item.target)
 if(path.dirname(packedPath)!==path.join(root,'guard/screenshots'))throw Error('Exact owned screenshot directory required')
 const bytes=gunzipSync(fs.readFileSync(packedPath)),original=fs.readFileSync(item.source)
 if(!bytes.equals(original))throw Error('Original JPEG bytes differ: '+item.target)
 const previous={target:item.target,storedBytes:item.storedBytes,gzip:item.gzip}
 const target=item.target.slice(0,-3),nativePath=path.resolve(root,target)
 fs.writeFileSync(nativePath,bytes,{flag:'wx'})
 if(!fs.readFileSync(nativePath).equals(original))throw Error('Native JPEG storage differs: '+target)
 fs.unlinkSync(packedPath)
 item.target=target;item.storedBytes=bytes.length;item.gzip=false
 item.previousGzipStorage=previous
 changes.push({target,originalBytes:bytes.length,exactOriginalBytes:true})
}
if(changes.length!==11)throw Error('Exactly eleven current original screenshots required')
manifest.screenshotPresentation={atUtc:new Date().toISOString(),qualification:'Expose the same immutable original JPEG bytes for direct visual review; no image editing or regeneration',changes}
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n')
fs.writeFileSync(path.resolve('.tmp-codex-directory-target-01a133/guard-screenshot-presentation.json'),JSON.stringify(manifest.screenshotPresentation,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({screenshots:changes.length,allExactOriginalJpegBytes:true}))
