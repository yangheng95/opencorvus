import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,names=['resolve-a','ordinary-a','selected-a','selected-b','ordinary-b','resolve-b']
const results=names.map(name=>JSON.parse(fs.readFileSync(root+'/'+name+'-result.json','utf8')))
const expected=results.find(r=>r.run==='ordinary-a').outputs.map(({id,stdout,stderr,executable})=>({id,stdout,stderr,executable}))
for(const result of results){
 assert.equal(result.completed,166);assert.equal(result.metrics.live,0);assert(result.outcomes.every(o=>o.status==='fulfilled'))
 if(result.mode!=='resolve')assert.deepEqual(result.outputs.map(({id,stdout,stderr,executable})=>({id,stdout,stderr,executable})),expected)
 for(const item of result.timings)assert.equal(path.normalize(item.executable).toLowerCase(),path.normalize('C:/Program Files/Git/cmd/git.exe').toLowerCase())
}
const summary={at:new Date().toISOString(),projects:166,gitProjects:165,modelRequests:0,maximumGitQueries:660,actualGitQueries:results.reduce((n,r)=>n+r.queries,0),fullOutputComparison:'All four original scopes match by Project id/stdout/stderr/formal resolved executable',runs:results.map(({run,mode,runtime,owner,completed,queries,wallMs,parentCpuUserMs,parentCpuSystemMs,mainMaxTickMs,concurrency,metrics})=>({run,mode,runtime,owner,completed,queries,wallMs,parentCpuUserMs,parentCpuSystemMs,mainMaxTickMs,concurrency,metrics})),boundary:'Complete original166 directory component control;not mixed configuration,UI or production acceptance. Formal Git for Windows cmd entry retained. CPU only parent. First resolution durations overlap command windows and are not additive.'}
fs.writeFileSync(root+'/analysis.json',JSON.stringify(summary,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(summary))
