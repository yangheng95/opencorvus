import fs from 'node:fs';
const record='2026-10-14-provider-test-observation',root='specs/artifacts/'+record;
fs.mkdirSync('.tmp-codex-provider-test-observation-01a133/screenshots',{recursive:true});
for(const [file,line]of [
 ['specs/README.md',`- [Provider Test 的结果事实](records/2026-10/${record}.md)：有效模型、当前语言与明确变更归属。`],
 ['specs/records/2026-10/README.md',`- [Provider Test 的结果事实](${record}.md)：目录选择、真实回执与轮次。`],
 ['specs/artifacts/README.md',`- [Provider Test 的结果事实](${record}/README.md)：前态、正向合同与实际模型/页面资格。`]
]){
 const text=fs.readFileSync(file,'utf8');if(text.includes(record))throw Error('Own entry already inserted');
 fs.writeFileSync(file,text.replace('- [',line+'\n\n- ['));
}
fs.copyFileSync('.tmp-codex-provider-post-save-01a133/intake-batch13-test-ui.md',root+'/inputs/intake-batch13-test-ui.md');
console.log('Formal spec/indexes and independent evidence prepared; product unchanged');
