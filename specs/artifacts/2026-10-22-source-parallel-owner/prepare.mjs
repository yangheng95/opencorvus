import fs from 'node:fs'
import path from 'node:path'
const root=import.meta.dirname,prior=path.resolve(root,'../permission-focus-dismissal-530')
for(const file of ['prepare-data.ts','launch.ps1','shutdown.ps1','settle.ps1','prepare-authority.mjs','retire-authority.mjs','preserve.ts','build.mjs','send.ts','http-json.ts']){
 let code=fs.readFileSync(prior+'/'+file,'utf8').replaceAll('permission-focus-dismissal-530','source-parallel-owner-532').replaceAll('19029','19037').replaceAll('19031','19039').replaceAll('task-scope-empty-state-528-after','dialog-opener-focus-531-after').replaceAll('2026-10-22-permission-focus-dismissal.md','2026-10-22-source-parallel-owner.md')
 if(file==='send.ts'){
  const start=code.indexOf('const text='),end=code.indexOf('const sessionID=')
  code=code.slice(0,start)+`const text='PARALLEL532START。这是既有普通成员一次有限公开文档阅读，不是新委派。请在同一步并行各调用一次webfetch，读取 https://www.w3.org/TR/wai-aria-1.2/ 和 https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText ，各URL只调用一次；失败如实记下，不用其他URL重试。不读取/修改项目文件、不执行命令、不创建/委派成员、Task、Mission或Goal。根据实际结果输出6节中文，三级标题依次“并行来源第01节”至“并行来源第06节”，每节约150字，区分引用内容和你自己的推断，不声称实际操作/验收界面。最后另起一段PARALLEL532END。所有正文与工具结果保持正常可见。'\n`+code.slice(end)
 }
 fs.writeFileSync(root+'/'+file,code,{flag:'wx'})
}
let diagnostic=fs.readFileSync(path.resolve(root,'../source-live-owner-continuity-529/build-diagnostic.mjs'),'utf8').replaceAll('source-live-owner-continuity-529','source-parallel-owner-532').replaceAll('529','532')
const insert=fs.readFileSync(root+'/source-diagnostic.txt','utf8')
diagnostic=diagnostic.replace('  if(file.endsWith(\'/components/text-part-model.ts\')){',insert+'\n  if(file.endsWith(\'/components/text-part-model.ts\')){')
fs.writeFileSync(root+'/build-diagnostic.mjs',diagnostic,{flag:'wx'})
fs.writeFileSync(root+'/plan.json',JSON.stringify({scope:'source-parallel-owner-532',source:'Closed531-after complete90 tables158027 original rows/schema3/canonical',ports:{before:19037,after:19039},maximumRequestsPerStartedScope:8,initiallyStartedScopes:['before'],model:'gpt-6.1-sol',qualification:'Actual same-message Tool overlap/completion/Source order;manual UI and passive owner observations;no production edits before evidence',sourceRevision:'bbcdcbc0b65f939a444b14a21a046f45256af7bc'},null,2)+'\n',{flag:'wx'})
console.log('Fresh532 helpers prepared;no authority or service staged')
