param([Parameter(Mandatory=$true)][ValidatePattern('^sol-[0-9]+$')][string]$Stage)
$ErrorActionPreference='Stop'
$taskRepo='D:/myhexin-local/opencorvus'
$taskRun=Join-Path $taskRepo ('.tmp-codex-provider-empty-declarations-01a133/'+$Stage)
if(Test-Path -LiteralPath $taskRun){throw 'Fresh model qualification occurrence required'}
if(@(Get-NetTCPConnection -State Listen -LocalPort 18592 -ErrorAction SilentlyContinue).Count){throw 'Owned model qualification port is occupied'}
foreach($name in @('project','home','appdata','localappdata','temp','runtime','xdg-config','xdg-data','xdg-cache','xdg-state','managed')){[IO.Directory]::CreateDirectory((Join-Path $taskRun $name))|Out-Null}
$taskInfo=[Diagnostics.ProcessStartInfo]::new()
$taskInfo.FileName=Join-Path $taskRepo '.tmp-product-iteration/sse-compression-305/bun140/bun-windows-x64/bun.exe'
$taskInfo.ArgumentList.Add((Join-Path $taskRepo '.tmp-codex-provider-empty-declarations-01a133/sol.ts'))
$taskInfo.ArgumentList.Add($taskRun)
$taskInfo.ArgumentList.Add('C:/Users/hengu/AppData/Local/opencorvus/data/auth.json')
$taskInfo.WorkingDirectory=Join-Path $taskRepo 'packages/opencorvus'
$taskInfo.UseShellExecute=$false
$taskInfo.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
$taskInfo.RedirectStandardOutput=$true
$taskInfo.RedirectStandardError=$true
$taskInfo.Environment.Clear()
foreach($name in @('PATH','SystemRoot','WINDIR','ComSpec','PATHEXT')){if([Environment]::GetEnvironmentVariable($name)){$taskInfo.Environment[$name]=[Environment]::GetEnvironmentVariable($name)}}
foreach($entry in @(@('HOME','home'),@('USERPROFILE','home'),@('APPDATA','appdata'),@('LOCALAPPDATA','localappdata'),@('TEMP','temp'),@('TMP','temp'),@('XDG_CONFIG_HOME','xdg-config'),@('XDG_DATA_HOME','xdg-data'),@('XDG_CACHE_HOME','xdg-cache'),@('XDG_STATE_HOME','xdg-state'),@('OPENCORVUS_HOME','runtime'),@('OPENCORVUS_TEST_MANAGED_CONFIG_DIR','managed'))){$taskInfo.Environment[$entry[0]]=Join-Path $taskRun $entry[1]}
$taskInfo.Environment['OPENCORVUS_PROJECT_DIR']=Join-Path $taskRun 'project'
$taskInfo.Environment['OPENCORVUS_DISABLE_AUTOUPDATE']='1'
$taskInfo.Environment['OPENCORVUS_DISABLE_EXTERNAL_SKILLS']='1'
$taskInfo.Environment['OPENCORVUS_TASK_PROCESS_MODE']='native'
$taskProcess=[Diagnostics.Process]::Start($taskInfo)
$taskStdout=$taskProcess.StandardOutput.ReadToEndAsync()
$taskStderr=$taskProcess.StandardError.ReadToEndAsync()
[IO.File]::WriteAllText((Join-Path $taskRun 'owner.json'),(@{pid=$taskProcess.Id;birthUtc=$taskProcess.StartTime.ToUniversalTime().ToString('o');port=18592;purpose='Authorized isolated GPT-6.1 Sol Provider runnable stream regression';pair='Existing OpenAI credential with complete adjacent model catalog; copy refresh forbidden'}|ConvertTo-Json))
$taskProcess.WaitForExit()
[IO.File]::WriteAllText((Join-Path $taskRun 'stdout.log'),$taskStdout.GetAwaiter().GetResult())
[IO.File]::WriteAllText((Join-Path $taskRun 'stderr.log'),$taskStderr.GetAwaiter().GetResult())
$taskPhysical=@{pid=$taskProcess.Id;exitCode=$taskProcess.ExitCode;observedUtc=[DateTime]::UtcNow.ToString('o');ownedPortListeners=@(Get-NetTCPConnection -State Listen -LocalPort 18592 -ErrorAction SilentlyContinue).Count;copiedPairCleanup=@()}
if($taskPhysical.ownedPortListeners){throw 'Owned qualification port still has a listener; retain pair'}
foreach($name in @('auth.json','models.json')){
  $taskFile=Join-Path $taskRun ('runtime/data/'+$name)
  if([IO.Path]::GetFullPath($taskFile).StartsWith([IO.Path]::GetFullPath($taskRun)+[IO.Path]::DirectorySeparatorChar) -eq $false){throw 'Owned cleanup path escaped exact runtime'}
  if(Test-Path -LiteralPath $taskFile){Remove-Item -LiteralPath $taskFile}
  $taskPhysical.copiedPairCleanup+=@{name=$name;removed=!(Test-Path -LiteralPath $taskFile)}
}
[IO.File]::WriteAllText((Join-Path $taskRun 'physical-exit-pair-cleanup.json'),($taskPhysical|ConvertTo-Json -Depth 8))
Write-Output ('Owned GPT-6.1 Sol Provider qualification process exited '+$taskProcess.ExitCode)
exit $taskProcess.ExitCode
