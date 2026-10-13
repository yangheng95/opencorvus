param([Parameter(Mandatory=$true)][ValidateSet('before','after','final')][string]$Stage,[Parameter(Mandatory=$true)][string]$UiDirectory)
$ErrorActionPreference='Stop'
$taskRepo='D:/myhexin-local/opencorvus'
$taskRun=Join-Path $taskRepo ('.tmp-codex-config-diagnostics-01a133/'+$Stage)
if(Test-Path -LiteralPath $taskRun){throw 'Fresh page runtime occurrence required'}
if(@(Get-NetTCPConnection -State Listen -LocalPort 18586 -ErrorAction SilentlyContinue).Count){throw 'Owned page port occupied'}
if(@(Get-NetTCPConnection -State Listen -LocalPort 18587 -ErrorAction SilentlyContinue).Count){throw 'Own registry participant port occupied'}
foreach($name in @('project','home','appdata','localappdata','temp','runtime/data','xdg-config','xdg-data','xdg-cache','xdg-state','managed')){[IO.Directory]::CreateDirectory((Join-Path $taskRun $name))|Out-Null}
$taskInfo=[Diagnostics.ProcessStartInfo]::new()
$taskInfo.FileName=Join-Path $taskRepo '.tmp-product-iteration/sse-compression-305/bun140/bun-windows-x64/bun.exe'
$taskInfo.ArgumentList.Add((Join-Path $taskRepo '.tmp-codex-config-diagnostics-01a133/runtime.ts'))
$taskInfo.ArgumentList.Add($taskRun)
$taskInfo.ArgumentList.Add($UiDirectory)
$taskInfo.WorkingDirectory=Join-Path $taskRepo 'packages/opencorvus'
$taskInfo.UseShellExecute=$false
$taskInfo.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
$taskInfo.RedirectStandardOutput=$true
$taskInfo.RedirectStandardError=$true
$taskInfo.Environment.Clear()
foreach($name in @('PATH','SystemRoot','WINDIR','ComSpec','PATHEXT')){if([Environment]::GetEnvironmentVariable($name)){$taskInfo.Environment[$name]=[Environment]::GetEnvironmentVariable($name)}}
foreach($entry in @(@('HOME','home'),@('USERPROFILE','home'),@('APPDATA','appdata'),@('LOCALAPPDATA','localappdata'),@('TEMP','temp'),@('TMP','temp'),@('XDG_CONFIG_HOME','xdg-config'),@('XDG_DATA_HOME','xdg-data'),@('XDG_CACHE_HOME','xdg-cache'),@('XDG_STATE_HOME','xdg-state'),@('OPENCORVUS_HOME','runtime'),@('OPENCORVUS_TEST_MANAGED_CONFIG_DIR','managed'))){$taskInfo.Environment[$entry[0]]=Join-Path $taskRun $entry[1]}
$taskInfo.Environment['OPENCORVUS_MODELS_URL']='http://127.0.0.1:18587'
$taskInfo.Environment['OWNED_PROVIDER_API_KEY']='owned-env-presence-sample'
$taskInfo.Environment['OWNED_DIAGNOSTIC_VALUE']='diagnostic-env-sample'
$taskInfo.Environment['OPENCORVUS_MODELS_PATH']=Join-Path $taskRun 'runtime/data/models.json'
$taskInfo.Environment['OPENCORVUS_PROJECT_DIR']=Join-Path $taskRun 'project'
$taskInfo.Environment['OPENCORVUS_DISABLE_AUTOUPDATE']='1'
$taskInfo.Environment['OPENCORVUS_DISABLE_EXTERNAL_SKILLS']='1'
$taskInfo.Environment['OPENCORVUS_TASK_PROCESS_MODE']='native'
$taskProcess=[Diagnostics.Process]::Start($taskInfo)
$taskStdout=$taskProcess.StandardOutput.ReadToEndAsync()
$taskStderr=$taskProcess.StandardError.ReadToEndAsync()
[IO.File]::WriteAllText((Join-Path $taskRun 'owner.json'),(@{pid=$taskProcess.Id;birthUtc=$taskProcess.StartTime.ToUniversalTime().ToString('o');port=18586;purpose='Own bootstrap discovery /ui with generated sample credential and loopback participant'}|ConvertTo-Json))
$taskProcess.WaitForExit()
[IO.File]::WriteAllText((Join-Path $taskRun 'stdout.log'),$taskStdout.GetAwaiter().GetResult())
[IO.File]::WriteAllText((Join-Path $taskRun 'stderr.log'),$taskStderr.GetAwaiter().GetResult())
[IO.File]::WriteAllText((Join-Path $taskRun 'exit.json'),(@{pid=$taskProcess.Id;exitCode=$taskProcess.ExitCode;observedUtc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json))
Write-Output ('Owned credential presence page process exited '+$taskProcess.ExitCode)
exit $taskProcess.ExitCode
