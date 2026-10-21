import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=repo+'/specs/artifacts/2026-10-22-goal-home-hierarchy',base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/goal-home-hierarchy-513-'
const selected=['prepare.mjs','prepare-data.ts','build.mjs','serve.ts','launch.ps1','shutdown.ps1','settle.ps1','preserve.ts','archive.mjs','before-data-preparation.json','after-data-preparation.json','data-preservation-observation.json']
for(const name of fs.readdirSync(root))if(name.endsWith('.png'))selected.push(name)
for(const name of selected)fs.copyFileSync(root+'/'+name,out+'/'+name,fs.constants.COPYFILE_EXCL)
for(const stage of ['before','after'])fs.copyFileSync(base+stage+'-service/evidence/physical-terminal.json',out+'/'+stage+'-physical-terminal.json',fs.constants.COPYFILE_EXCL)
const runtimeLog=fs.readFileSync(base+'after/runtime/log/dev.log','utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line))
const assets=runtimeLog.filter(row=>row.service==='server'&&row.data?.path==='/ui/assets/main-uBAGKTCv.js'&&row.data.status==='completed').map(row=>({time:row.time,requestID:row.data.requestID,path:row.data.path,statusCode:row.data.statusCode}))
fs.writeFileSync(out+'/observations.json',JSON.stringify({sourceCommit:'dade6e2cbc9cd6ec3ea5c2849dad8da45ea12c85',at:new Date().toISOString(),scope:'Single developer agent;real source CLI /ui;manual screenshots and interactions only',assets,validation:[{command:'bun run --cwd packages/overlay typecheck',exitCode:0},{command:'bun run --cwd packages/overlay check:i18n',exitCode:0,observation:'2 locales;2527 top-level keys'},{command:'bun run --cwd packages/overlay check:css-tokens',exitCode:0,observation:'8879 references;268 global tokens'},{command:'node .tmp-product-iteration/goal-home-hierarchy-513/build.mjs after',exitCode:0,observation:'7313 modules;84 seconds;formal main-uBAGKTCv.js'},{command:'bun run docs:check',exitCode:0},{command:'bun run check:architecture-index',exitCode:0}],manual:{screenshots:9,locale:['en-US','zh-CN'],sidebarWidths:[280,493],flow:['Home','Goal form prefilled from real composer','Close retains composer draft','How it works','Real starter fills composer'],finalRects:{prompt:{y:94.4,width:760},composer:{y:171.2,width:760},starters:{y:306.8,width:760},goal:{y:352.8,width:760,height:121.6}}},provider:{maximum:0,actual:0,credentialsOrModelCatalogCopies:'None'},limits:['No new Goal model execution qualification','No right dock, mobile or continuous-frame Rendering qualification','No authentication transport qualification'],resources:{pages100and101:'Closed',originalHandles:[42877,99731],physical:'Original native/output/request/launcher/birth chains complete;public shutdown200',data:'Both scopes90 tables156566 original rows retained;schema3/canonical unchanged'}},null,2)+'\n',{flag:'wx'})
// Actual credential values stay local to this equality scan and are never emitted.
const authPath='C:/Users/hengu/.codex/auth.json',authBytes=fs.readFileSync(authPath),authStat=fs.statSync(authPath),auth=JSON.parse(authBytes)
const secrets=[...new Set([auth.OPENAI_API_KEY,auth.tokens?.id_token,auth.tokens?.access_token,auth.tokens?.refresh_token].filter(value=>typeof value==='string'&&value.length>=20))].map(value=>Buffer.from(value))
assert(secrets.length>=3)
let files=0,bytes=0,matches=0
function scan(file){const data=fs.readFileSync(file);files++;bytes+=data.length;matches+=secrets.some(secret=>data.includes(secret))?1:0}
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);assert(!fs.lstatSync(file).isSymbolicLink());if(entry.isDirectory())walk(file);else scan(file)}}
walk(out)
for(const file of ['specs/README.md','specs/records/2026-10/README.md','specs/artifacts/README.md','specs/records/2026-10/2026-10-22-goal-home-hierarchy.md','specs/current/architecture/07-panel.md','packages/overlay/src/components/App.tsx','packages/overlay/src/components/ContinuousGoalControl.tsx','packages/overlay/src/styles/surfaces/conversation.css','packages/overlay/src/styles/surfaces/continuous-goal.css','packages/overlay/src/i18n/en-US.json','packages/overlay/src/i18n/zh-CN.json'])scan(repo+'/'+file)
assert.equal(matches,0,'Actual credentials detected in scoped delivery')
assert(fs.readFileSync(authPath).equals(authBytes));assert.equal(fs.statSync(authPath).mtimeMs,authStat.mtimeMs)
const result={at:new Date().toISOString(),files,bytes,actualCredentialValueMatches:matches,scope:'Current archive images and helpers plus complete scoped source,record,indexes,architecture;original credentials read locally only;source bytes/mtime retained'}
fs.writeFileSync(out+'/credential-scan.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify(result))
