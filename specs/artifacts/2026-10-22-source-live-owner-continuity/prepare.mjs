import fs from 'node:fs'
import path from 'node:path'
const root=import.meta.dirname,prior=path.resolve(root,'../clipboard-literal-525'),name='source-live-owner-continuity-529'
for(const file of ['prepare-data.ts','launch.ps1','shutdown.ps1','settle.ps1','prepare-authority.mjs','retire-authority.mjs','preserve.ts','build.mjs']){
 let code=fs.readFileSync(prior+'/'+file,'utf8').replaceAll('clipboard-literal-525',name).replaceAll('19009','19025').replaceAll('19011','19027').replaceAll('2026-10-22-clipboard-literal.md','2026-10-22-source-live-owner-continuity.md')
 if(file==='prepare-data.ts')code=code.replaceAll('goal-current-experience-523-after','task-scope-empty-state-528-after')
 fs.writeFileSync(root+'/'+file,code,{flag:'wx'})
}
let send=fs.readFileSync(prior+'/send.ts','utf8').replaceAll('clipboard-literal-525',name).replaceAll('19009','19025').replaceAll('19011','19027')
const start=send.indexOf("const first="),end=send.indexOf("const sessionID=")
send=send.slice(0,start)+`const text='SOURCE529START。本次是既有普通成员的一次有限来源阅读输入，不是新委派。请用webfetch各读取一次https://www.w3.org/WAI/ARIA/apg/patterns/tabs/和https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText，按实际工具结果说明两项来源能支持的结论；若失败如实说明，不重试其他URL。不读写项目文件、不运行命令、不创建或委派成员/Task/Mission/Goal。随后连续输出24节中文，三级标题依次“来源阅读第01节”至“来源阅读第24节”，每节约180字，具体解释来源身份、原文与推断、字符编码和长文阅读。第1节和第12节后各附一个三行JavaScript代码围栏，仅局部字符串示例。不省略中间节、不只列提纲、不人为等待、不声称实际操作或验收任何界面，最后另起一段SOURCE529END。工具结果与正文正常可见。'\n`+send.slice(end)
send=send.replace(',literalMaterials:{first,second}','')
fs.writeFileSync(root+'/send.ts',send,{flag:'wx'})
fs.writeFileSync(root+'/plan.json',JSON.stringify({name,model:'gpt-6.1-sol',stream:true,maximumBatchRequests:16,before:8,conditionalAfter:8,ports:[19025,19027],source:'Closed528-after complete 90 tables/schema3/canonical',oneVisibleInputPerScope:true,diagnostic:'Passive owner/identity/HTML-state observations,not UI test or fix comparison'},null,2)+'\n',{flag:'wx'})
console.log('Fresh529 helpers only;authority and service staged separately')
