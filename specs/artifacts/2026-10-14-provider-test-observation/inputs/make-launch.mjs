import fs from 'node:fs';
let text=fs.readFileSync('.tmp-codex-provider-post-save-01a133/launch.ps1','utf8')
 .replaceAll('provider-post-save','provider-test-observation')
 .replace("[ValidateSet('before','after','final')]","[ValidateSet('before','after')]")
 .replaceAll('18602','18610').replaceAll('18603','18611');
text=text.replace('$taskInfo.WorkingDirectory=',"$taskInfo.ArgumentList.Add('C:/Users/hengu/AppData/Local/opencorvus/data/auth.json')\n$taskInfo.ArgumentList.Add('18610')\n$taskInfo.ArgumentList.Add('18611')\n$taskInfo.WorkingDirectory=");
text=text.replace("purpose='Own bootstrap discovery /ui with generated sample credential and loopback participant'","purpose='Authorized own Provider Test /ui with fresh complete OpenAI pair and real model audit'");
const anchor="[IO.File]::WriteAllText((Join-Path $taskRun 'exit.json'),";
text=text.replace(anchor,`$taskListeners=@(Get-NetTCPConnection -State Listen -LocalPort 18610,18611 -ErrorAction SilentlyContinue).Count
if($taskListeners){throw 'Own ports still listening after actual process exit; keep credential pair'}
$taskCleanup=@()
foreach($name in @('auth.json','models.json')){
  $taskFile=Join-Path $taskRun ('runtime/data/'+$name)
  if([IO.Path]::GetFullPath($taskFile).StartsWith([IO.Path]::GetFullPath($taskRun)+[IO.Path]::DirectorySeparatorChar) -eq $false){throw 'Own cleanup path escaped exact runtime'}
  if(Test-Path -LiteralPath $taskFile){Remove-Item -LiteralPath $taskFile}
  $taskCleanup+=@{name=$name;removed=!(Test-Path -LiteralPath $taskFile)}
}
[IO.File]::WriteAllText((Join-Path $taskRun 'physical-pair-cleanup.json'),(@{pid=$taskProcess.Id;actualExit=$taskProcess.ExitCode;listeners=$taskListeners;pair=$taskCleanup}|ConvertTo-Json -Depth 6))
`+anchor);
fs.writeFileSync('.tmp-codex-provider-test-observation-01a133/launch.ps1',text);
console.log('Own launch uses literal PowerShell source, fresh complete pair and exact post-exit cleanup');
