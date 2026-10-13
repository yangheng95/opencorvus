import fs from 'node:fs'
import path from 'node:path'
const scratch=path.resolve('.tmp-codex-directory-target-01a133'),service='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/copy-kind-after-01a133'
const report={reviewer:'Root alone',atUtc:new Date().toISOString(),tests:[]}
for(const label of ['before','after','final']){
 const file=path.join(scratch,'copy-kind-'+label+'-tests.log'),bytes=fs.readFileSync(file),lines=bytes.toString('utf8').split(/\r?\n/),requests=[]
 for(const [index,line] of lines.entries()){const match=line.match(/^\[([^\]]+) HTTP\] (.+)$/);if(match)requests.push({line:index+1,channel:match[1],value:JSON.parse(match[2])})}
 const statuses={};for(const row of requests){const status=row.value.result.status;statuses[status]=(statuses[status]??0)+1}
 const item={label,originalBytes:bytes.length,exit:JSON.parse(fs.readFileSync(path.join(scratch,'copy-kind-'+label+'-tests.exit.json'),'utf8')),requests,statuses,summary:lines.filter(line=>/^ [0-9]+ (pass|fail|expect)|DONE|Cannot find module/.test(line))}
 report.tests.push(item);console.log(JSON.stringify({label,originalBytes:item.originalBytes,exit:item.exit,http:requests.length,statuses,summary:item.summary}))
}
const stderr=fs.readFileSync(path.join(service,'stderr.log')),stdout=fs.readFileSync(path.join(service,'stdout.log'))
report.runtime={stdoutBytes:stdout.length,stderrBytes:stderr.length,diagnostics:stderr.toString('utf8').split(/\r?\n/).flatMap((line,index)=>/warn|error|timeout|ETIMEDOUT/i.test(line)?[{line:index+1,value:line}]:[])}
report.physical=JSON.parse(fs.readFileSync(path.join(scratch,'copy-kind-after-tools/copy-kind-after/copy-kind-after-physical-terminal-and-credential-free.json'),'utf8'))
report.native=JSON.parse(fs.readFileSync(path.join(service,'evidence/native-host-settled.json'),'utf8'))
report.browser=JSON.parse(fs.readFileSync(path.join(scratch,'copy-kind-after-tools/screenshots/browser-warnings-errors.json'),'utf8'))
fs.writeFileSync(path.join(scratch,'copy-delivery-root-review.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({runtime:report.runtime,physicalCompletion:report.physical.physicalCompletion,nativeTerminal:report.native.terminal,joins:report.native.originalJoins.map(row=>({kind:row.kind,status:row.status})),writes:report.native.outputFacts,browser:report.browser}))
