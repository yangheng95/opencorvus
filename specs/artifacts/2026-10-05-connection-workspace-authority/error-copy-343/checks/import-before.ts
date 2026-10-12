import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-12/error-copy-343-before-01'
const source='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-12/skill-loader-341-live-01'
if(fs.existsSync(run)) throw Error('Fresh import destination required')
for(const [key,dir] of Object.entries({HOME:'home',USERPROFILE:'home',APPDATA:'appdata',LOCALAPPDATA:'localappdata',TEMP:'temp',TMP:'temp',XDG_CONFIG_HOME:'xdg-config',XDG_DATA_HOME:'xdg-data',XDG_CACHE_HOME:'xdg-cache',XDG_STATE_HOME:'xdg-state',OPENCORVUS_HOME:'runtime'})){
 process.env[key]=path.join(run,dir);fs.mkdirSync(process.env[key]!,{recursive:true})
}
process.env.OPENCORVUS_DISABLE_AUTOUPDATE='1'
process.env.OPENCORVUS_DISABLE_EXTERNAL_SKILLS='1'
for(const key of ['OPENCORVUS_CONFIG','OPENCORVUS_CONFIG_DIR','OPENCORVUS_CONFIG_CONTENT','OPENCORVUS_DISABLE_PROJECT_CONFIG'])delete process.env[key]
fs.mkdirSync(path.join(run,'runtime/config'),{recursive:true})
fs.copyFileSync(path.join(source,'runtime/config/opencorvus.jsonc'),path.join(run,'runtime/config/opencorvus.jsonc'))
const {installProcessShims}=await import('../../packages/opencorvus/src/runtime/shims');installProcessShims()
const {Instance}=await import('../../packages/opencorvus/src/project/instance')
const {Session}=await import('../../packages/opencorvus/src/session')
const {Database}=await import('../../packages/opencorvus/src/storage/db')
const {importSessionData}=await import('../../packages/opencorvus/src/cli/cmd/import')
const snapshot=JSON.parse(fs.readFileSync(new URL('./actual-session-export.json',import.meta.url),'utf8'))
await Instance.provide({directory:path.join(source,'project'),fn:async()=>{
 assert.equal(Instance.project.id,snapshot.info.projectID)
 await importSessionData(snapshot)
 const actual=await Session.messages({sessionID:snapshot.info.id})
 assert.deepEqual(actual.map(m=>m.info),snapshot.messages.map((m:any)=>m.info))
 const error=actual.find(m=>m.info.id==='msg_g0VXofL0v00voJgQANZ1')!.info
 fs.writeFileSync(path.join(run,'import-custody.json'),JSON.stringify({source,run,project:Instance.directory,projectID:Instance.project.id,sessionID:snapshot.info.id,messages:actual.length,parts:actual.reduce((n,m)=>n+m.parts.length,0),error,contract:'Actual source readonly export through current schemas/tool projection, formal importSessionData, persisted Message.Info equality; no generated messages or background memory copied'},null,2)+'\n',{flag:'wx'})
}})
await Instance.disposeAll()
await Database.awaitEffectIdle(30000)
Database.close()
console.log('Formal actual Session import completed and disposed')
