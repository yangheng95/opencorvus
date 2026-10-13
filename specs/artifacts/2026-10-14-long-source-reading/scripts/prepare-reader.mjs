import fs from 'node:fs'
import path from 'node:path'
const scratch=path.resolve('.tmp-product-iteration/long-source-reading-406')
let wrapper=fs.readFileSync('.tmp-product-iteration/live-sol-long-source-reading-406.ts','utf8')
const start=wrapper.indexOf('  // Establish the real Git identity')
const end=wrapper.indexOf('  const { ExpertSquadRegistry }',start)
if(start<0||end<0)throw Error('Reviewed wrapper sections missing')
wrapper=wrapper.slice(0,start)+`  assert.equal(await fs.realpath(project), await fs.realpath("C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/long-source-reading-406-live/project"))
  await publish("existing-history-admitted.json", { project, runtime, mainSessionID: "ses_-zUS2EY0ezzjFidQwBy1", boundary: "Reuse the completed real 406 history; no database or transcript initialization" })
`+wrapper.slice(end)
for(const [name,file] of [['globalConfig','globalConfigFile'],['projectConfig','projectConfigFile']]){
 const original=`await fs.writeFile(${file}, JSON.stringify(${name}, null, 2) + "\\n", { flag: "wx" })`
 if(!wrapper.includes(original))throw Error('Reviewed config initialization missing')
 wrapper=wrapper.replace(original,`assert.deepEqual(JSON.parse(await fs.readFile(${file}, "utf8")), ${name})`)
}
fs.writeFileSync('.tmp-product-iteration/live-sol-long-source-reader-406.ts',wrapper,{flag:'wx'})
let launcher=fs.readFileSync(path.join(scratch,'launch-reader.ps1'),'utf8')
launcher=launcher.replaceAll('long-source-reading-406-diagnostic-02','long-source-reading-406-diagnostic-03')
launcher=launcher.replaceAll('live-sol-long-source-reading-406.ts','live-sol-long-source-reader-406.ts')
launcher=launcher.replace('+900000','+600000')
launcher=launcher.replace('$taskBun --cwd D:/myhexin-local/opencorvus/packages/opencorvus ./src/index.ts serve --hostname 127.0.0.1 --port 18521 --project-dir "$taskRun/project" --startup-receipt "$taskDiag/startup.json" --startup-occurrence $taskOccurrence', '$taskBun $taskWrapper "C:/Users/hengu/AppData/Local/opencorvus/data/auth.json" "$taskRun/runtime" "$taskRun/project" "$taskDiag/evidence" "$taskDiag/startup.json" "18521" $taskOccurrence "$taskRun/reader-selection.json" "D:/myhexin-local/opencorvus/.tmp-product-iteration/long-source-reading-406/builtin.json" "20" "NativeService"')
fs.writeFileSync(path.join(scratch,'launch-reader-auth.ps1'),launcher,{flag:'wx'})
console.log('Prepared existing-history audited reader: maximum 20 requests, 600-second owned service lease; no launch yet.')
