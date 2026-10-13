import fs from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import prettier from 'prettier'
import {structuredPatch,applyPatch} from '../node_modules/.bun/diff@8.0.3/node_modules/diff/libesm/index.js'
const files=['packages/opencorvus/src/provider/operations.ts','packages/opencorvus/test/provider-connection-test.test.ts','packages/overlay/src/components/settings/ProvidersPanel.tsx','packages/overlay/src/services/llm.ts','packages/overlay/src/services/provider-refresh.ts','packages/overlay/test/llm-provider-operation-scope.test.ts','packages/overlay/test/provider-refresh.test.ts']
const report=[]
for(const file of files){
 const current=await fs.readFile(file,'utf8')
 let head
 try{head=execFileSync('git',['show',`HEAD:${file}`],{encoding:'utf8',stdio:['ignore','pipe','pipe']})}catch{head=''}
 const own=structuredPatch(file,file,head.replaceAll('\r\n','\n'),current.replaceAll('\r\n','\n'),'', '',{context:0})
 const normalized=current.replaceAll('\r\n','\n')
 const formatted=await prettier.format(normalized,{...await prettier.resolveConfig(file),filepath:file})
 const formatting=structuredPatch(file,file,normalized,formatted,'','',{context:0})
 const selected=formatting.hunks.filter(h=>own.hunks.some(o=>h.oldStart<=o.newStart+Math.max(o.newLines,1)&&h.oldStart+Math.max(h.oldLines,1)>=o.newStart))
 const patched=applyPatch(normalized,{...formatting,hunks:selected})
 if(patched===false)throw new Error(`Failed own formatting ${file}`)
 await fs.writeFile(file,patched)
 report.push({file,applied:selected.length,untouchedBaseline:formatting.hunks.length-selected.length})
}
await fs.writeFile('.tmp-codex-provider-test-observation-01a133/format-owned.json',JSON.stringify(report,null,2))
console.log(report)
