param([Parameter(Mandatory=$true)][ValidateSet('before','after','final','postfix','shortbase')][string]$Stage,[Parameter(Mandatory=$true)][string]$UiDirectory)
$ErrorActionPreference='Stop'
$taskRepo='D:/myhexin-local/opencorvus'
$taskBackendPort=if($Stage -eq 'before'){18614}elseif($Stage -eq 'after'){18616}elseif($Stage -eq 'final'){18618}elseif($Stage -eq 'postfix'){18620}else{18622}
$taskParticipantPort=if($Stage -eq 'before'){18615}elseif($Stage -eq 'after'){18617}elseif($Stage -eq 'final'){18619}elseif($Stage -eq 'postfix'){18621}else{18623}
$taskRun=Join-Path $taskRepo ('.tmp-codex-provider-test-lifecycle-01a133/'+$Stage)
if(Test-Path -LiteralPath $taskRun){throw 'Fresh page runtime occurrence required'}
if(@(Get-NetTCPConnection -State Listen -LocalPort $taskBackendPort -ErrorAction SilentlyContinue).Count){throw 'Owned page port occupied'}
if(@(Get-NetTCPConnection -State Listen -LocalPort $taskParticipantPort -ErrorAction SilentlyContinue).Count){throw 'Own registry participant port occupied'}
foreach($name in @('project','home','appdata','localappdata','temp','runtime/data','xdg-config','xdg-data','xdg-cache','xdg-state','managed')){[IO.Directory]::CreateDirectory((Join-Path $taskRun $name))|Out-Null}
$taskInfo=[Diagnostics.ProcessStartInfo]::new()
$taskInfo.FileName=Join-Path $taskRepo '.tmp-product-iteration/sse-compression-305/bun140/bun-windows-x64/bun.exe'
$taskInfo.ArgumentList.Add((Join-Path $taskRepo '.tmp-codex-provider-test-lifecycle-01a133/runtime.ts'))
$taskInfo.ArgumentList.Add($taskRun)
$taskInfo.ArgumentList.Add($UiDirectory)
$taskInfo.ArgumentList.Add([string]$taskBackendPort)
$taskInfo.ArgumentList.Add([string]$taskParticipantPort)
$taskInfo.WorkingDirectory=Join-Path $taskRepo 'packages/opencorvus'
$taskInfo.UseShellExecute=$false
$taskInfo.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
$taskInfo.RedirectStandardOutput=$true
$taskInfo.RedirectStandardError=$true
$taskInfo.Environment.Clear()
foreach($name in @('PATH','SystemRoot','WINDIR','ComSpec','PATHEXT')){if([Environment]::GetEnvironmentVariable($name)){$taskInfo.Environment[$name]=[Environment]::GetEnvironmentVariable($name)}}
foreach($entry in @(@('HOME','home'),@('USERPROFILE','home'),@('APPDATA','appdata'),@('LOCALAPPDATA','localappdata'),@('TEMP','temp'),@('TMP','temp'),@('XDG_CONFIG_HOME','xdg-config'),@('XDG_DATA_HOME','xdg-data'),@('XDG_CACHE_HOME','xdg-cache'),@('XDG_STATE_HOME','xdg-state'),@('OPENCORVUS_HOME','runtime'),@('OPENCORVUS_TEST_MANAGED_CONFIG_DIR','managed'))){$taskInfo.Environment[$entry[0]]=Join-Path $taskRun $entry[1]}
$taskInfo.Environment['OPENCORVUS_MODELS_URL']="http://127.0.0.1:$taskParticipantPort"
$taskInfo.Environment['OWNED_PROVIDER_API_KEY']='owned-env-presence-sample'
$taskInfo.Environment['OWNED_DIAGNOSTIC_VALUE']='diagnostic-env-sample'
$taskInfo.Environment['OPENCORVUS_PROJECT_DIR']=Join-Path $taskRun 'project'
$taskInfo.Environment['OPENCORVUS_DISABLE_AUTOUPDATE']='1'
$taskInfo.Environment['OPENCORVUS_DISABLE_EXTERNAL_SKILLS']='1'
$taskInfo.Environment['OPENCORVUS_TASK_PROCESS_MODE']='native'
$taskProcess=[Diagnostics.Process]::Start($taskInfo)
$taskStdout=$taskProcess.StandardOutput.ReadToEndAsync()
$taskStderr=$taskProcess.StandardError.ReadToEndAsync()
[IO.File]::WriteAllText((Join-Path $taskRun 'owner.json'),(@{pid=$taskProcess.Id;birthUtc=$taskProcess.StartTime.ToUniversalTime().ToString('o');port=$taskBackendPort;purpose='Root own Provider Test lifecycle /ui with generated fictional Auth; no copied user credential or real Sol request'}|ConvertTo-Json))
$taskProcess.WaitForExit()
[IO.File]::WriteAllText((Join-Path $taskRun 'stdout.log'),$taskStdout.GetAwaiter().GetResult())
[IO.File]::WriteAllText((Join-Path $taskRun 'stderr.log'),$taskStderr.GetAwaiter().GetResult())
$taskListeners=@(Get-NetTCPConnection -State Listen -LocalPort $taskBackendPort,$taskParticipantPort -ErrorAction SilentlyContinue).Count
if($taskListeners){throw 'Own ports still listening after actual process exit; keep credential pair'}
$taskCleanup=@()
foreach($name in @('auth.json','models.json')){
  $taskFile=Join-Path $taskRun ('runtime/data/'+$name)
  if([IO.Path]::GetFullPath($taskFile).StartsWith([IO.Path]::GetFullPath($taskRun)+[IO.Path]::DirectorySeparatorChar) -eq $false){throw 'Own cleanup path escaped exact runtime'}
  if(Test-Path -LiteralPath $taskFile){Remove-Item -LiteralPath $taskFile}
  $taskCleanup+=@{name=$name;removed=!(Test-Path -LiteralPath $taskFile)}
}
[IO.File]::WriteAllText((Join-Path $taskRun 'physical-pair-cleanup.json'),(@{pid=$taskProcess.Id;actualExit=$taskProcess.ExitCode;listeners=$taskListeners;pair=$taskCleanup}|ConvertTo-Json -Depth 6))
[IO.File]::WriteAllText((Join-Path $taskRun 'exit.json'),(@{pid=$taskProcess.Id;exitCode=$taskProcess.ExitCode;observedUtc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json))
Write-Output ('Owned credential presence page process exited '+$taskProcess.ExitCode)
exit $taskProcess.ExitCode
