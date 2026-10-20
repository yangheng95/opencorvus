import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import assert from 'node:assert/strict'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=path.join(repo,'specs/artifacts/2026-10-21-git-startup-floor')
assert.equal(fs.existsSync(out),false);fs.mkdirSync(out)
for(const name of ['prepare.mjs','launch.ps1','measure.ts','analyse.mjs','verify-physical.ps1','verify-source.ts','archive.mjs','official-assets.json','analysis.json','physical-scopes.json','source-preserved.json'])fs.copyFileSync(root+'/'+name,out+'/'+name,fs.constants.COPYFILE_EXCL)
const input=JSON.parse(fs.readFileSync(root+'/input-private.json','utf8'))
fs.writeFileSync(out+'/input-projects.json',JSON.stringify(input.projects,null,2)+'\n',{flag:'wx'})
for(const run of ['query-a','version-a','cmd-a','cmd-b','version-b','query-b']){
 for(const suffix of ['-result.json','.log'])fs.copyFileSync(root+'/'+run+suffix,out+'/'+run+suffix,fs.constants.COPYFILE_EXCL)
 const bytes=fs.readFileSync(root+'/'+run+'-raw.json'),compressed=zlib.gzipSync(bytes,{level:9});assert.deepEqual(zlib.gunzipSync(compressed),bytes)
 fs.writeFileSync(out+'/'+run+'-raw.json.gz',compressed,{flag:'wx'})
}
const wrapper=fs.readFileSync(root+'/mingw-w64-git/git-wrapper.c','utf8').split(/\r?\n/)
fs.writeFileSync(out+'/published-source-observation.json',JSON.stringify({observedAt:new Date().toISOString(),release:'https://github.com/git-for-windows/git/releases/tag/v2.45.1.windows.1',sourceAsset:'https://github.com/git-for-windows/git/releases/download/v2.45.1.windows.1/mingw-w64-git-2.45.1.1.965b16798d-1.src.tar.gz',packageBuild:'https://github.com/git-for-windows/git/releases/download/v2.45.1.windows.1/PKGBUILD.v2.45.1.windows.1',sourceTag:'2.45.1.windows.1',sourcePackage:'2.45.1.1.965b16798d',sourceLicense:'GPL2 as declared by release PKGBUILD;external source read only,not executed or redistributed here',sourceWrapperLines:wrapper.length,bundleHead:'65321f91fed131ecdba739e57195fb78d999a6dc refs/heads/git-2.45.1',installed:{path:'C:/Program Files/Git/cmd/git.exe',fileVersion:'2.45.1.windows.1',productVersion:'2.45.1.windows.1',originalFilename:'git.exe'},facts:[{lines:'672-710',observation:'maybe_read_config reads installation etc/git-bash.config MSYS settings'},{lines:'880-932',observation:'No console branch sets standard handles and CREATE_NO_WINDOW,then CreateProcess and waits for exit'}],boundary:'Official published version source plus installed version metadata,not a reproducible binary build or proof of an OS bottleneck. No mutable-source checksum gate.'},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({files:fs.readdirSync(out).length,sourceDatabase:'excluded',sourceCredentialCopies:0,modelRequests:0}))
