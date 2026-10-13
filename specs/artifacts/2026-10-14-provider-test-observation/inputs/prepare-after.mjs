import fs from 'node:fs'
const scratch='.tmp-codex-provider-test-observation-01a133'
for(const file of ['launch.ps1','runtime.ts'])fs.copyFileSync(`${scratch}/${file}`,`${scratch}/before/${file}`)
let launch=fs.readFileSync(`${scratch}/launch.ps1`,'utf8')
launch=launch.replace("$taskRepo='D:/myhexin-local/opencorvus'","$taskRepo='D:/myhexin-local/opencorvus'\n$taskBackendPort=if($Stage -eq 'before'){18610}else{18612}\n$taskParticipantPort=if($Stage -eq 'before'){18611}else{18613}")
launch=launch.replaceAll('-LocalPort 18610,18611','-LocalPort $taskBackendPort,$taskParticipantPort').replaceAll('-LocalPort 18610 ','-LocalPort $taskBackendPort ').replaceAll('-LocalPort 18611 ','-LocalPort $taskParticipantPort ')
launch=launch.replace("$taskInfo.ArgumentList.Add('18610')",'$taskInfo.ArgumentList.Add([string]$taskBackendPort)').replace("$taskInfo.ArgumentList.Add('18611')",'$taskInfo.ArgumentList.Add([string]$taskParticipantPort)')
launch=launch.replace("='http://127.0.0.1:18611'",'="http://127.0.0.1:$taskParticipantPort"').replace('port=18610','port=$taskBackendPort')
fs.writeFileSync(`${scratch}/launch.ps1`,launch)
console.log('Saved executed before inputs; after owns separate 18612/18613 origin')
