import fs from 'node:fs'
import path from 'node:path'
const scratch=path.resolve('.tmp-codex-directory-target-01a133')
for(const host of ['node','bun']){
 const root=path.join(scratch,'entry-native-'+host)
 const lines=fs.readFileSync(path.join(root,'evidence/native-host-stdout.bin'),'utf8').trimEnd().split('\n').map(line=>JSON.parse(line))
 const observations=lines.filter(line=>line.type==='original-entry-name-observation').map(({record:r})=>({id:r.id,operand:r.operand,status:r.status,inputBasename:r.inputBasename,metadata:r.metadata,finalPath:r.finalPath,nativeSize:r.native?.finalPath?.sizeCall,nativeRead:r.native?.finalPath?.readCall&&{supplied:r.native.finalPath.readCall.suppliedCodeUnits,written:r.native.finalPath.readCall.returnValue,terminator:r.native.finalPath.readCall.terminatorCodeUnit},close:r.native?.close,firstCause:r.firstCause,shortCoverage:r.shortCoverage,entryIdentityStable:r.entryIdentityStable}))
 const result={host,library:lines.find(line=>line.type==='actual-library'),abi:lines.filter(line=>line.type==='abi-layout'||line.type==='entry-name-abi'),observations,complete:lines.at(-1),settled:JSON.parse(fs.readFileSync(path.join(root,'evidence/native-host-settled.json'),'utf8')),parent:JSON.parse(fs.readFileSync(path.join(root,'parent-joined.json'),'utf8')),parentStderr:fs.readFileSync(path.join(root,'stderr.bin')).toString('utf8')}
 fs.writeFileSync(path.join(scratch,'entry-results-'+host+'.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify(result))
}
