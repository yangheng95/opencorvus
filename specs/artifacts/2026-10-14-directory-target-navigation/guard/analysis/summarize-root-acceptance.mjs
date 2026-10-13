import fs from 'node:fs'
import path from 'node:path'
const scratch=path.resolve('.tmp-codex-directory-target-01a133')
const report={reviewer:'Root, independently after all child agents were stopped',reviewedAtUtc:new Date().toISOString(),runs:[]}
for(const label of ['first','final']){
 const file=path.join(scratch,'guard-functional-'+label+'.log'),bytes=fs.readFileSync(file),lines=bytes.toString('utf8').split(/\r?\n/)
 const requests=[],identities=[],contents=[],passes=[],other=[]
 for(const [index,line] of lines.entries()){
  const record={line:index+1}
  if(line.startsWith('[link entry HTTP] ')){record.value=JSON.parse(line.slice(18));requests.push(record)}
  else if(line.startsWith('[root mutation HTTP] ')){record.value=JSON.parse(line.slice(21));requests.push(record)}
  else if(line.startsWith('[link entry identity] ')){record.value=JSON.parse(line.slice(22));identities.push(record)}
  else if(line.startsWith('[link target bytes] ')){record.value=JSON.parse(line.slice(20));contents.push(record)}
  else if(line.startsWith('(pass)'))passes.push({line:index+1,value:line})
  else if(line.trim())other.push({line:index+1,value:line})
 }
 const statusCounts={}
 for(const request of requests){const status=request.value.result.status;statusCounts[status]=(statusCounts[status]??0)+1}
 const run={label,file,originalBytes:bytes.length,exit:JSON.parse(fs.readFileSync(path.join(scratch,'guard-functional-'+label+'.exit.json'),'utf8')),requests,statusCounts,identities,contents,passes,other,qualifications:['Real loopback TCP/FileRoutes and production File code; no UI/model acceptance inferred','Original nullable request IDs preserved; global middleware is not part of the small Hono route harness','Identity/notification assertions not printed in original log are not manufactured into a journal']}
 report.runs.push(run)
 console.log(JSON.stringify({label,bytes:bytes.length,exitCode:run.exit.exitCode,http:requests.length,statusCounts,pass:passes.length,identities:identities.length,contents:contents.length,otherLines:other.length}))
}
const serviceRoot='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/directory-target-guard-after-01a133'
const stderr=fs.readFileSync(path.join(serviceRoot,'stderr.log'))
report.service={stderrBytes:stderr.length,firstRawLines:stderr.toString('utf8').split(/\r?\n/).slice(0,2),matchingDiagnostics:stderr.toString('utf8').split(/\r?\n/).flatMap((line,index)=>/error|warn|timeout|ETIMEDOUT/i.test(line)?[{line:index+1,value:line}]:[])}
fs.writeFileSync(path.join(scratch,'root-acceptance-review.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({serviceStderrBytes:stderr.length,diagnosticLines:report.service.matchingDiagnostics.length,firstRawLines:report.service.firstRawLines,diagnostics:report.service.matchingDiagnostics}))
