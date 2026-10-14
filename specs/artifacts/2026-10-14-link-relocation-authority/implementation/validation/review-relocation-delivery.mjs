import fs from 'node:fs'
import path from 'node:path'
const scratch=path.resolve('.tmp-codex-directory-target-01a133'),report={reviewer:'Root independently, no delegation',atUtc:new Date().toISOString(),checks:[],clients:[]}
for(const name of ['relocation-first-link-tests','relocation-repaired-link-tests','relocation-final-focused-tests','relocation-final-ignore-tests']){
 const log=fs.readFileSync(path.join(scratch,name+'.log'),'utf8'),exit=JSON.parse(fs.readFileSync(path.join(scratch,name+'.exit.json'),'utf8')),requests=[]
 for(const line of log.split('\n'))for(const prefix of ['[link entry HTTP] ','[root mutation HTTP] ','[ignore coordinate HTTP] '])if(line.startsWith(prefix))requests.push(JSON.parse(line.slice(prefix.length)))
 const counts=[...log.matchAll(/^ (\d+) (pass|fail|expect\(\) calls)/gm)].map(match=>({count:Number(match[1]),kind:match[2]}))
 report.checks.push({name,exit,counts,requests,failures:log.split('\n').filter(line=>line.startsWith('(fail)')||line.includes('Cannot call test.each()()')||line.includes('Cannot find module')),httpCounts:Object.fromEntries([...new Set(requests.map(row=>row.result.status))].map(status=>[status,requests.filter(row=>row.result.status===status).length]))})
}
for(const name of ['relocation-first-typecheck','relocation-final-typecheck'])report.checks.push({name,exit:JSON.parse(fs.readFileSync(path.join(scratch,name+'.exit.json'),'utf8')),completeOriginalLog:fs.readFileSync(path.join(scratch,name+'.log'),'utf8')})
const tools=path.join(scratch,'relocation-permission-after-tools'),evidence=path.join(tools,'relocation-permission-after')
for(const phase of ['prepare','register','before','after']){
 const root=path.join(scratch,'relocation-ui-native-'+phase+'-node'),joined=JSON.parse(fs.readFileSync(path.join(root,'parent-joined.json'),'utf8')),settled=JSON.parse(fs.readFileSync(path.join(root,'evidence/native-host-settled.json'),'utf8'))
 if(joined.terminal.code!==0||settled.terminal.exitCode!==0||settled.originalJoins.some(row=>row.status!=='fulfilled')||settled.outputFacts.some(row=>row.status!=='fulfilled')||!settled.physicalCompletion||!settled.outputDrainComplete||!settled.requestCleanupComplete)throw Error('Original client qualification incomplete: '+phase)
 report.clients.push({phase,joined,settled})
}
report.before=JSON.parse(fs.readFileSync(path.join(evidence,'relocation-before-complete.json'),'utf8'))
report.after=JSON.parse(fs.readFileSync(path.join(evidence,'relocation-after-complete.json'),'utf8'))
if(report.before.requests.length!==8||report.after.requests.length!==11||report.after.published.length!==2)throw Error('Actual readonly matrix incomplete')
report.runtime={joined:JSON.parse(fs.readFileSync(path.join(evidence,'relocation-permission-after-launcher-joined.json'),'utf8')),physical:JSON.parse(fs.readFileSync(path.join(evidence,'relocation-permission-after-physical-terminal-and-credential-free.json'),'utf8')),native:JSON.parse(fs.readFileSync('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/relocation-permission-after-01a133/evidence/native-host-settled.json','utf8'))}
if(report.runtime.native.terminal.exitCode!==0||report.runtime.native.originalJoins.some(row=>row.status!=='fulfilled')||report.runtime.native.outputFacts.some(row=>row.status!=='fulfilled')||!report.runtime.native.physicalCompletion||!report.runtime.native.outputDrainComplete||!report.runtime.native.requestCleanupComplete)throw Error('Original UI service settlement incomplete')
const stderr=fs.readFileSync('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/relocation-permission-after-01a133/stderr.log','utf8')
report.runtime.originalStderrBytes=Buffer.byteLength(stderr)
report.runtime.diagnosticRows=stderr.split('\n').filter(row=>/\b(ERROR|WARN|timeout|Timeout)\b/.test(row))
report.browserLogs=JSON.parse(fs.readFileSync(path.join(tools,'screenshots/browser-warning-errors.json'),'utf8'))
report.boundaries=['Original first test registration failure, four separator expectation failures, wrong ignore filename and first shutdown binding failure remain failures','Final actual checker output is 49 link/468 assertions, 18 root/294 assertions and corrected ignore13/79 assertions; source typecheck0','Root manually performed four mutations and viewed six original JPEGs; no UI automated assertions','No new model request, Provider credential use or user-process operation','Non-Windows real-host qualification, case-sensitive Windows volumes and atomic external retarget protection remain unqualified; directory-link navigation still outstanding']
fs.writeFileSync(path.join(scratch,'relocation-delivery-root-review.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({checks:report.checks.map(row=>({name:row.name,exit:row.exit.exitCode,counts:row.counts,http:row.httpCounts})),clients:report.clients.map(row=>({phase:row.phase,exit:row.joined.terminal.code,streams:row.joined.outputJoins})),beforeHTTP:report.before.requests.length,afterHTTP:report.after.requests.length,published:report.after.published.map(row=>({source:row.source,target:row.target,tag:row.native.query.output.ReparseTag})),serviceExit:report.runtime.native.terminal.exitCode,browserLogs:report.browserLogs,serviceDiagnostics:report.runtime.diagnosticRows.map(row=>row.slice(0,800))},null,2))
