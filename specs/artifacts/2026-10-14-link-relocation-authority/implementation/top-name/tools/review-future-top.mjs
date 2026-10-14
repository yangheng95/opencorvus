import fs from 'node:fs'
import path from 'node:path'
const scratch=path.resolve('.tmp-codex-directory-target-01a133'),input=JSON.parse(fs.readFileSync(path.join(scratch,'future-top-name.inputs.json'),'utf8'))
const report={reviewer:'Root independently',atUtc:new Date().toISOString(),qualification:'Original top-level OS rename/access semantics only; not FileRoutes or UI',phases:[]}
for(const phase of ['prepare-node','read-node','read-bun']){
 const root=path.join(scratch,'future-top-native-'+phase),bytes=fs.readFileSync(path.join(root,'stdout.bin')),rows=bytes.toString('utf8').trim().split('\n').map(JSON.parse),joined=JSON.parse(fs.readFileSync(path.join(root,'parent-joined.json'),'utf8')),settled=JSON.parse(fs.readFileSync(path.join(root,'evidence/native-host-settled.json'),'utf8'))
 if(joined.terminal.code!==0||settled.terminal.exitCode!==0||settled.originalJoins.some(r=>r.status!=='fulfilled')||settled.outputFacts.some(r=>r.status!=='fulfilled')||!settled.physicalCompletion||!settled.outputDrainComplete||!settled.requestCleanupComplete||rows.some(r=>r.type==='phase-original-failure'))throw Error('Original qualification/settlement differs')
 const cases=rows.filter(r=>r.type==='completed-case-originals').map(r=>r.result),brief=[]
 for(const c of cases){
  const declared=input.cases.find(spec=>spec.id===c.caseID),{source,target}=declared.operations[0]
  const before=c.before.find(r=>r.relative===source),after=c.after.find(r=>r.relative===target),beforeU=c.before.find(r=>r.relative===source+'/u/marker.txt'),afterU=c.after.find(r=>r.relative===target+'/u/marker.txt'),oldLink=c.before.find(r=>r.relative===source+'/u'),newLink=c.after.find(r=>r.relative===target+'/u'),marker=c.after.find(r=>r.relative===target+'/r/marker.txt')
  const matches=before.lstat.status==='fulfilled'&&after.lstat.status==='fulfilled'&&['dev','ino','birthtimeNs'].every(key=>before.lstat.value.fields[key]===after.lstat.value.fields[key])
  if(!matches||marker.bytes?.value?.utf8!=='TOP ROOT NOTE\r\n'||oldLink.readlink.value!==newLink.readlink.value)throw Error('Moved entry/body/text qualification differs')
  brief.push({caseID:c.caseID,source,target,beforeShort:before.shortPath.path,afterShort:after.shortPath.path,movedIdentityRetained:matches,originalText:oldLink.readlink.value,afterText:newLink.readlink.value,beforeU:{status:beforeU.stat.status,code:beforeU.stat.code,bytes:beforeU.bytes?.value},afterU:{status:afterU.stat.status,code:afterU.stat.code,bytes:afterU.bytes?.value},actualMarker:marker.bytes.value})
 }
 if(phase.startsWith('read')&&cases.length!==4)throw Error('Original cases incomplete')
 report.phases.push({phase,records:rows.length,stdoutBytes:bytes.length,stderrBytes:fs.readFileSync(path.join(root,'stderr.bin')).length,fixtureID:rows.find(r=>r.fixtureID)?.fixtureID,joined,settled,nativeObservations:rows.filter(r=>r.type==='native-entry-observation').length,brief,cases})
}
fs.writeFileSync(path.join(scratch,'future-top-root-review.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({phases:report.phases.map(r=>({phase:r.phase,fixtureID:r.fixtureID,records:r.records,stdoutBytes:r.stdoutBytes,stderrBytes:r.stderrBytes,nativeObservations:r.nativeObservations,brief:r.brief}))},null,2))
