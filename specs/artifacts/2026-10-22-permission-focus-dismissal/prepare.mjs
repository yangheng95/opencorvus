import fs from 'node:fs'
import path from 'node:path'
const root=import.meta.dirname,prior=path.resolve(root,'../source-live-owner-continuity-529')
for(const file of ['prepare-data.ts','launch.ps1','shutdown.ps1','settle.ps1','prepare-authority.mjs','retire-authority.mjs','preserve.ts','build.mjs','send.ts','http-json.ts']){
 let code=fs.readFileSync(prior+'/'+file,'utf8').replaceAll('source-live-owner-continuity-529','permission-focus-dismissal-530').replaceAll('19025','19029').replaceAll('19027','19031').replaceAll('2026-10-22-source-live-owner-continuity.md','2026-10-22-permission-focus-dismissal.md')
 if(file==='send.ts'){
  const start=code.indexOf("const text="),end=code.indexOf("const sessionID=")
  code=code.slice(0,start)+`const text='PERMISSION530START。这是既有普通成员的一次有限公开来源阅读输入，不是新的委派。请用webfetch各读取一次 https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ 和 https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText ，按实际工具结果说明各自能支持什么结论；若失败如实记录，不用其他URL重试。不读写项目文件、不运行命令、不新建或委派成员/Task/Mission/Goal。最后输出4节中文，三级标题依次“权限阅读第01节”至“权限阅读第04节”，每节约150字，说明读取状态、来源身份和原文与推断边界，不声称实际操作或验收界面，另起一段PERMISSION530END。所有正文和工具结果保持正常可见。'\n`+code.slice(end)
 }
 fs.writeFileSync(root+'/'+file,code,{flag:'wx'})
}
fs.writeFileSync(root+'/plan.json',JSON.stringify({name:'permission-focus-dismissal-530',maximumBatchRequests:16,scopeBudgets:{before:8,conditionalAfter:8},ports:{before:19029,after:19031},model:'gpt-6.1-sol',stream:true,source:'Closed528-after complete90 tables/schema3/canonical',oneVisibleMemberInputPerScope:true,ui:'Real ordinary Tab/Escape/outside click;no UI tests;passive before close-cause observation'},null,2)+'\n',{flag:'wx'})
console.log('Fresh530 helpers prepared;paired authority and processes not yet staged')
