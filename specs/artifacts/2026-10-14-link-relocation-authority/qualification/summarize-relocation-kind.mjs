import fs from 'node:fs'
import path from 'node:path'
const scratch=path.resolve('.tmp-codex-directory-target-01a133')
const report={reviewer:'Root independently; all child agents remain stopped',reviewedAtUtc:new Date().toISOString(),qualification:'Complete original OS/cp/native output review; no FileRoutes/UI acceptance inferred',hosts:[]}
function compact(row){
 const info=row.native?.query?.output
 return {relative:row.relative,lstat:row.lstat.status==='fulfilled'?{identity:{dev:row.lstat.value.fields.dev,ino:row.lstat.value.fields.ino,birthtimeNs:row.lstat.value.fields.birthtimeNs},file:row.lstat.value.file,directory:row.lstat.value.directory,link:row.lstat.value.link}:{status:row.lstat.status,code:row.lstat.code},reparseTag:info?.ReparseTag,fileAttributes:info?.FileAttributes,directoryAttribute:info?(info.FileAttributes&16)!==0:null,entryName:row.native?.finalPath?.path,close:row.native?.close,readlink:row.readlink,realpath:row.realpath,followedStat:row.stat.status==='fulfilled'?{file:row.stat.value.file,directory:row.stat.value.directory,link:row.stat.value.link}:{status:row.stat.status,code:row.stat.code,error:row.stat.error},bytes:row.bytes}
}
for(const host of ['node','bun']){
 const root=path.join(scratch,'relocation-native-read-'+host),bytes=fs.readFileSync(path.join(root,'stdout.bin'))
 const records=bytes.toString('utf8').split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line))
 const complete=records.filter(row=>row.type==='completed-host-observations')
 if(complete.length!==1)throw Error('One original host completion required')
 const source=complete[0],settled=JSON.parse(fs.readFileSync(path.join(root,'evidence/native-host-settled.json'),'utf8')),parent=JSON.parse(fs.readFileSync(path.join(root,'parent-joined.json'),'utf8'))
 const nativeRows=records.filter(row=>row.type==='native-entry-observation')
 const rows=source.cases.map(item=>({caseID:item.caseID,operations:item.operations,before:item.before.map(compact),after:item.after.map(compact),originalMarkersAfter:item.originalMarkersAfter}))
 const fact={host,fixtureID:source.fixtureID,originalBytes:bytes.length,originalRecordCount:records.length,nativeRows:nativeRows.length,parent,settled,cases:rows}
 report.hosts.push(fact)
 const changes=[]
 for(const item of rows){for(const operation of item.operations){const original=item.before.find(row=>row.relative===operation.source),published=item.after.find(row=>row.relative===operation.target);if(original&&published)changes.push({caseID:item.caseID,method:operation.method,source:operation.source,target:operation.target,sourceTag:original.reparseTag,targetTag:published.reparseTag,sourceDirectoryAttribute:original.directoryAttribute,targetDirectoryAttribute:published.directoryAttribute,sourceReadlink:original.readlink?.value,targetReadlink:published.readlink?.value})}}
 console.log(JSON.stringify({host,fixtureID:fact.fixtureID,originalBytes:bytes.length,records:records.length,cases:rows.length,operations:rows.reduce((sum,item)=>sum+item.operations.length,0),nativeRows:nativeRows.length,parentExit:parent.terminal.code,terminal:settled.terminal,joins:settled.originalJoins.map(row=>({kind:row.kind,status:row.status})),writes:settled.outputFacts,changes,chains:rows.filter(item=>item.caseID.includes('junction')).map(item=>({caseID:item.caseID,before:item.before.filter(row=>row.relative.includes('/u')),after:item.after.filter(row=>row.relative.includes('/u'))})),selfCycle:rows.find(item=>item.caseID==='missing-to-self-cycle')}))
}
fs.writeFileSync(path.join(scratch,'relocation-kind-root-review.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'})
