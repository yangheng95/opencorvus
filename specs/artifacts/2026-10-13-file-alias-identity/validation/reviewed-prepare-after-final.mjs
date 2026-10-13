import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
const run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-13/file-alias-after-final-01a133'
const evidence=path.resolve('specs/artifacts/2026-10-13-file-alias-identity/after-final')
const ready=JSON.parse(fs.readFileSync(path.join(run,'evidence/preflight-ready.json'),'utf8')).preflight
if(ready.credential!=='usable'||ready.catalog!=='projected'||ready.actualModel!=='gpt-6.1-sol'||!ready.streaming)throw Error('Provider qualification required')
const project=path.join(run,'project'), file=path.join(project,'notes.txt'), outside=path.join(run,'outside.txt')
const baseline='first line\r\nAlias ORIGINAL\r\nthird line\r\n', content='first line edited\r\nAlias ORIGINAL\r\nthird line\r\n', external='External alias source\n'
fs.mkdirSync(path.join(project,'folder'),{recursive:true})
fs.writeFileSync(file,baseline,{flag:'wx'})
fs.writeFileSync(outside,external,{flag:'wx'})
for(const args of [['--literal-pathspecs','add','--','notes.txt'],['commit','-m','owned alias file baseline']]){
 const result=spawnSync('git',args,{cwd:project,encoding:'utf8',windowsHide:true})
 if(result.status!==0)throw Error('Owned Git baseline failed: '+result.stderr)
}
fs.writeFileSync(file,content)
fs.writeFileSync(path.join(evidence,'authored-inputs.json'),JSON.stringify({file,baseline,content,outside,external},null,2)+'\n',{flag:'wx'})
const links=[
 '- [Canonical](notes.txt:2:4)',
 '- [Current folder](./notes.txt:2:4)',
 '- [Parent segment](folder/../notes.txt:2:4)',
 '- [Return to project](../project/notes.txt:2:4)',
 '- [Internal absolute]('+project.replaceAll('\\','/')+'/folder/../notes.txt:2:4)',
 '- [External absolute]('+project.replaceAll('\\','/')+'/../outside.txt:1)',
]
const prompt='请真实读取 notes.txt 一次（offset=2,limit=1），然后原样回复下面的Markdown列表。都是我创建的验收文件。不要修改文件，不创建任务或调用成员。\n'+links.join('\n')
fs.writeFileSync('.tmp-codex-file-alias-01a133/after-final-request.txt',prompt,{flag:'wx'})
console.log(JSON.stringify({prepared:true,file,baselineBytes:Buffer.byteLength(baseline),currentBytes:Buffer.byteLength(content)}))
