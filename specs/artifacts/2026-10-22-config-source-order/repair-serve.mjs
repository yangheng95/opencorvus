import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,repo=path.resolve(root,'../..')
let code=fs.readFileSync(repo+'/.tmp-product-iteration/task-member-stream-504/serve.ts','utf8')
const start=code.indexOf('  assert.equal(await fs.realpath(project), await fs.realpath('),end=code.indexOf('\n  const { ExpertSquadRegistry }',start);assert(start>=0&&end>start)
code=code.slice(0,start)+`  assert.equal(await fs.realpath(project), await fs.realpath(path.join(path.dirname(runtime), 'project')))
  await publish('owned-project-admitted.json', {project,runtime,boundary:'Fresh owned ordinary project with explicit Base profile;complete original database preserved;no synthesized history'})`+code.slice(end)
fs.writeFileSync(root+'/serve.ts',code,{flag:'wx'})
const launch=fs.readFileSync(root+'/launch.ps1','utf8'),old='task-member-stream-504/serve.ts';assert(launch.includes(old));fs.copyFileSync(root+'/launch.ps1',root+'/launch-before-owned-project-repair.ps1',fs.constants.COPYFILE_EXCL)
fs.writeFileSync(root+'/launch.ps1',launch.replace(old,'config-source-order-520/serve.ts'))
let data=fs.readFileSync(root+'/prepare-data.ts','utf8');data+=`\nfs.mkdirSync(target+'/project/.opencorvus');fs.writeFileSync(target+'/project/.opencorvus/opencorvus.jsonc',JSON.stringify({prompt_profile:{active:'base'}})+'\\n',{flag:'wx'});console.log('Explicit owned project Base profile seeded before startup')\n`
fs.writeFileSync(root+'/prepare-data.ts',data)
const target='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/config-source-order-520-before/project/.opencorvus'
fs.mkdirSync(target);fs.writeFileSync(target+'/opencorvus.jsonc',JSON.stringify({prompt_profile:{active:'base'}})+'\n',{flag:'wx'})
console.log('Private NativeService admission repaired;original failed native chain retained;no provider calls')
