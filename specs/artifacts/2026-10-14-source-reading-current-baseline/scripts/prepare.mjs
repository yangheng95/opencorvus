import fs from 'node:fs'
import path from 'node:path'
const root=path.resolve('.tmp-product-iteration')
const scratch=path.join(root,'source-reading-405')
const old='live-sol-activity-input-391-after'
const next='live-sol-source-reading-405'
for(const suffix of ['.ts','-launch.ps1','-shutdown.ps1']) {
 let s=fs.readFileSync(path.join(root,old+suffix),'utf8').replaceAll(old,next)
 s=s.replaceAll('2026-10-13/activity-input-projection-391-after-bundle','2026-10-14/source-reading-405-bundle')
 fs.writeFileSync(path.join(root,next+suffix),s,{flag:'wx'})
}
fs.writeFileSync(path.join(scratch,'builtin.json'),JSON.stringify({kind:'builtin',id:'base',namespace:'builtin'})+'\n',{flag:'wx'})
const bundle='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/source-reading-405-bundle/bin'
fs.mkdirSync(bundle,{recursive:true})
fs.copyFileSync(path.join(root,'sse-compression-305/bun140/bun-windows-x64/bun.exe'),path.join(bundle,'bun.exe'),fs.constants.COPYFILE_EXCL)
console.log('Prepared owned NativeService paths and Bun 1.4.0; no credential read or server launch yet.')
