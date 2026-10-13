param([Parameter(Mandatory=$true)][string]$Stage,[Parameter(Mandatory=$true)][string]$UiDirectory)
$ErrorActionPreference='Stop'
$taskRepo='D:/myhexin-local/opencorvus'
$taskRun=Join-Path $taskRepo ('.tmp-artifact-action-focus-384/'+$Stage)
foreach($name in @('project','home','appdata','localappdata','temp','runtime','xdg-config','xdg-data','xdg-cache','xdg-state')){[IO.Directory]::CreateDirectory((Join-Path $taskRun $name))|Out-Null}
$taskInfo=[Diagnostics.ProcessStartInfo]::new()
$taskInfo.FileName=Join-Path $taskRepo '.tmp-product-iteration/sse-compression-305/bun140/bun-windows-x64/bun.exe'
$taskInfo.ArgumentList.Add((Join-Path $taskRepo '.tmp-artifact-action-focus-384/review-server.ts'))
$taskInfo.ArgumentList.Add($taskRun)
$taskInfo.ArgumentList.Add($UiDirectory)
$taskChat=Get-Content -Raw -LiteralPath (Join-Path $taskRepo '.tmp-artifact-action-focus-384/chat-accepted.json')|ConvertFrom-Json
$taskCanonicalRuntime=Join-Path $taskRepo '.tmp-artifact-action-focus-384/provider-before-02/runtime'
$taskCleanup=Get-Content -Raw -LiteralPath (Join-Path $taskRepo '.tmp-artifact-action-focus-384/before-02-live/artifact-action-focus-384-before-02-physical-terminal-and-pair-cleanup.json')|ConvertFrom-Json
if(-not $taskCleanup.physicalCompletion -or -not $taskCleanup.pairedCleanupComplete){throw 'Original model owner and paired authority must have completed cleanup'}
if(Test-Path -LiteralPath (Join-Path $taskCanonicalRuntime 'data/auth.json')){throw 'Credentialless review requires no authorization file'}
$taskInfo.ArgumentList.Add([string]$taskChat.session.directory)
$taskInfo.WorkingDirectory=Join-Path $taskRepo 'packages/opencorvus'
$taskInfo.UseShellExecute=$false;$taskInfo.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
$taskInfo.RedirectStandardOutput=$true;$taskInfo.RedirectStandardError=$true
$taskInfo.Environment.Clear()
foreach($name in @('PATH','SystemRoot','WINDIR','ComSpec','PATHEXT')){if([Environment]::GetEnvironmentVariable($name)){$taskInfo.Environment[$name]=[Environment]::GetEnvironmentVariable($name)}}
foreach($entry in @(@('HOME','home'),@('USERPROFILE','home'),@('APPDATA','appdata'),@('LOCALAPPDATA','localappdata'),@('TEMP','temp'),@('TMP','temp'),@('XDG_CONFIG_HOME','xdg-config'),@('XDG_DATA_HOME','xdg-data'),@('XDG_CACHE_HOME','xdg-cache'),@('XDG_STATE_HOME','xdg-state'),@('OPENCORVUS_HOME','runtime'))){$taskInfo.Environment[$entry[0]]=Join-Path $taskRun $entry[1]}
$taskInfo.Environment['OPENCORVUS_HOME']=$taskCanonicalRuntime
$taskInfo.Environment['OPENCORVUS_PROJECT_DIR']=[string]$taskChat.session.directory
$taskInfo.Environment['OPENCORVUS_DISABLE_AUTOUPDATE']='1'
$taskInfo.Environment['OPENCORVUS_DISABLE_EXTERNAL_SKILLS']='1'
$taskInfo.Environment['OPENCORVUS_TASK_PROCESS_MODE']='native'
$taskProcess=[Diagnostics.Process]::Start($taskInfo)
$taskStdout=$taskProcess.StandardOutput.ReadToEndAsync();$taskStderr=$taskProcess.StandardError.ReadToEndAsync()
[IO.File]::WriteAllText((Join-Path $taskRun 'owner.json'),(@{pid=$taskProcess.Id;birthUtc=$taskProcess.StartTime.ToUniversalTime().ToString('o');port=18499;purpose='Own credentialless artifact action page review'}|ConvertTo-Json))
$taskProcess.WaitForExit()
[IO.File]::WriteAllText((Join-Path $taskRun 'stdout.log'),$taskStdout.GetAwaiter().GetResult())
[IO.File]::WriteAllText((Join-Path $taskRun 'stderr.log'),$taskStderr.GetAwaiter().GetResult())
Write-Output ('Own artifact action process exited '+$taskProcess.ExitCode)
exit $taskProcess.ExitCode
