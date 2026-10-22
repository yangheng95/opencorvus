import fs from 'node:fs'
import path from 'node:path'
const root=import.meta.dirname,prior=path.resolve(root,'../member-stream-reading-524'),scope='clipboard-literal-525'
for(const file of ['prepare-data.ts','launch.ps1','shutdown.ps1','settle.ps1','prepare-authority.mjs','retire-authority.mjs','preserve.ts','copy-ui.mjs','build.mjs']){
 let code=fs.readFileSync(prior+'/'+file,'utf8').replaceAll('member-stream-reading-524',scope).replaceAll('19005','19009').replaceAll('19007','19011').replaceAll('2026-10-22-member-stream-reading.md','2026-10-22-clipboard-literal.md')
 code=code.replaceAll('modelInputBudget:24','modelInputBudget:16').replaceAll('modelInputBudget:12','modelInputBudget:8').replaceAll('maximumBatchRequests:24','maximumBatchRequests:16').replaceAll('scopeBudgets:{before:12,after:12}','scopeBudgets:{before:8,after:8}').replaceAll('$taskBudget=12','$taskBudget=8').replaceAll('$taskMaximum=12','$taskMaximum=8').replaceAll('proof.maximumRequests,12','proof.maximumRequests,8').replaceAll('proof.requests<=12','proof.requests<=8').replaceAll('fixed12 actual','fixed8 actual')
 if(file==='copy-ui.mjs')code=code.replaceAll('goal-current-experience-523-after-bundle/bin/ui','member-stream-reading-524-after-bundle/bin/ui').replaceAll('main-Dp2CjRPP','main-DJESc7Su')
 fs.writeFileSync(root+'/'+file,code,{flag:'wx'})
}
fs.writeFileSync(root+'/plan.json',JSON.stringify({scope,model:'gpt-6.1-sol',stream:true,maximumBatchRequests:16,scopeBudgets:{before:8,after:8},ports:{before:19009,after:19011},source:'Closed523-after complete schema3/canonical',promptMaximumPerScope:1,member:'ses_-zUS0WzzQzzDOGrIbYwN',parent:'ses_-zUS0X33CzzWEKMgCk98',beforeUI:'Current524 main-DJESc7Su',measurement:'Known native composer clipboard baseline before product Copy;no product warmup path',boundary:'Actual visible user input and real model stream;no fixture page/synthetic Message/UI assertion'},null,2)+'\n',{flag:'wx'})
console.log('Fresh525 helpers prepared;fixed8+8;no authority or process staged')
