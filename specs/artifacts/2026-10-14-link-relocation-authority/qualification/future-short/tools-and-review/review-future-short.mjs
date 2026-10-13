import fs from 'node:fs'
import path from 'node:path'
const scratch=path.resolve('.tmp-codex-directory-target-01a133'),norm=text=>text.replaceAll('\\','/')
const manifest=JSON.parse(fs.readFileSync('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/future-short-input-01a133/original-fixture.json','utf8'))
const report={reviewer:'Root independently',atUtc:new Date().toISOString(),fixtureID:manifest.fixtureID,qualification:'Complete parsed original OS/library and native receipt observations; not FileRoutes or UI acceptance',phases:[]}
for(const phase of ['prepare-node','read-node','read-bun']){
 const root=path.join(scratch,'future-short-native-'+phase),stdout=fs.readFileSync(path.join(root,'stdout.bin')),stderr=fs.readFileSync(path.join(root,'stderr.bin')),rows=stdout.toString('utf8').trim().split('\n').map(JSON.parse)
 const joined=JSON.parse(fs.readFileSync(path.join(root,'parent-joined.json'),'utf8')),settled=JSON.parse(fs.readFileSync(path.join(root,'evidence/native-host-settled.json'),'utf8'))
 if(joined.terminal?.code!==0||joined.outputJoins.some(row=>row.status!=='fulfilled')||settled.terminal?.exitCode!==0||settled.originalJoins.some(row=>row.status!=='fulfilled')||settled.outputFacts.some(row=>row.status!=='fulfilled')||settled.physicalCompletion!==true||settled.outputDrainComplete!==true||settled.requestCleanupComplete!==true)throw Error('Original physical/output/request settlement differs: '+phase)
 if(rows.some(row=>row.type==='phase-original-failure'))throw Error('Original qualifier failure: '+phase)
 const cases=rows.filter(row=>row.type==='completed-case-originals').map(row=>row.result)
 if(phase.startsWith('read')&&cases.length!==4)throw Error('Missing original cases')
 const host=phase.endsWith('node')?'node':'bun',brief=cases.map(c=>{
  const before=c.before.find(row=>norm(row.relative)==='A/deep/tree/u/marker.txt'),after=c.after.find(row=>norm(row.relative)==='A/result/u/marker.txt')
  const alias=c.after.find(row=>norm(row.relative)==='A/result/'+path.basename(manifest.hosts[host].find(row=>row.id===c.caseID).shortPath.path))
  const bytes=row=>({status:row?.bytes?.status??row?.stat?.status,code:row?.bytes?.code??row?.stat?.code,realpath:row?.realpath?.value,utf8:row?.bytes?.value?.utf8,base64:row?.bytes?.value?.base64})
  return {caseID:c.caseID,method:c.operations[0].method,uBefore:bytes(before),uAfter:bytes(after),originalAliasAfter:{operand:alias?.operand,tag:alias?.native?.query?.output?.ReparseTag,actualEntryAddress:alias?.native?.finalPath?.path,directory:alias?.lstat?.value?.directory,link:alias?.lstat?.value?.link},junctionsAfter:c.after.filter(row=>norm(row.relative).startsWith('A/result/junction-')).map(row=>({relative:row.relative,actualShortPath:row.shortPath?.path,actualTag:row.native?.query?.output?.ReparseTag,actualAddress:row.native?.finalPath?.path})),originalMembers:c.beforeMembers.length}
 })
 report.phases.push({phase,stdoutBytes:stdout.length,stderrBytes:stderr.length,recordCount:rows.length,joined,settled,brief,cases,nativeObservations:rows.filter(row=>row.type==='native-entry-observation').length,copyLinkObservations:rows.filter(row=>row.type==='actual-copy-link-entry').length,copyLinkCreations:rows.filter(row=>row.type==='actual-copy-link-created').length,originalShortQueries:rows.filter(row=>row.type==='original-short-path').length})
}
fs.writeFileSync(path.join(scratch,'future-short-root-review.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({fixtureID:report.fixtureID,phases:report.phases.map(row=>({phase:row.phase,stdoutBytes:row.stdoutBytes,stderrBytes:row.stderrBytes,recordCount:row.recordCount,nativeObservations:row.nativeObservations,copyLinkObservations:row.copyLinkObservations,copyLinkCreations:row.copyLinkCreations,brief:row.brief}))},null,2))
