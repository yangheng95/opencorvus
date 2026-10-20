param([Parameter(Mandatory=$true)][ValidateSet('benchmark')][string]$Stage,[Parameter(Mandatory=$true)][ValidateSet('before','after')][string]$Mode,[Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9-]+$')][string]$Run)
$ErrorActionPreference='Stop'
$taskRepo='D:/myhexin-local/opencorvus'
$taskScratch="$taskRepo/.tmp-product-iteration/push-secret-snapshots-494"
$taskRoot="$taskScratch/$Run-scope"
$taskDiag="$taskRoot/evidence"
$taskBun='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/dependency-redirect-hardening-488-after-bundle/bin/bun.exe'
if(Test-Path -LiteralPath $taskRoot){throw 'Fresh diagnostic occurrence required'}
foreach($taskDirectory in @('runtime/tmp','home','appdata','localappdata','evidence')){New-Item -ItemType Directory -Path "$taskRoot/$taskDirectory" -Force|Out-Null}
$taskOriginal=@{}
Get-ChildItem Env:|ForEach-Object {$taskOriginal[$_.Name]=$_.Value}
$taskEnvironment=@{}
foreach($taskName in @('PATH','SystemRoot','WINDIR','ComSpec','PATHEXT','LANG','LC_ALL','LC_CTYPE')){if($taskOriginal.ContainsKey($taskName)){$taskEnvironment[$taskName]=$taskOriginal[$taskName]}}
$taskEnvironment.OPENCORVUS_HOME="$taskRoot/runtime"
$taskEnvironment.HOME="$taskRoot/home"
$taskEnvironment.USERPROFILE="$taskRoot/home"
$taskEnvironment.APPDATA="$taskRoot/appdata"
$taskEnvironment.LOCALAPPDATA="$taskRoot/localappdata"
$taskEnvironment.OPENCORVUS_TASK_PROCESS_MODE='native'
$taskEnvironment.OPENCORVUS_PROCESS_SUPERVISOR=if($Stage -eq 'contracts'){"$taskScratch/native-target/release/opencorvus-process-supervisor.exe"}else{"$taskRepo/.tmp-product-iteration/native-parent-query-446/release-target/release/opencorvus-process-supervisor.exe"}
$taskEnvironment.OPENCORVUS_DIAGNOSTIC_LAUNCH_MODE=$Mode
$taskEnvironment.OPENCORVUS_DIAGNOSTIC_LAUNCH_RUN=$Run
$taskEnvironment.TEMP="$taskRoot/runtime/tmp"
$taskEnvironment.TMP=$taskEnvironment.TEMP
$taskEnvironment.TMPDIR=$taskEnvironment.TEMP
$taskOccurrence='push-secret-snapshots-494-'+$Run+'-'+[Guid]::NewGuid().ToString()
$taskDeadline=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+240000
try{
 Get-ChildItem Env:|ForEach-Object {[Environment]::SetEnvironmentVariable($_.Name,$null,'Process')}
 foreach($taskName in $taskEnvironment.Keys){[Environment]::SetEnvironmentVariable($taskName,$taskEnvironment[$taskName],'Process')}
 & $taskBun "$taskRepo/.tmp-product-iteration/live-sol-task-guidance-413.ts" --owned-host $taskDiag $taskOccurrence ([string]$taskDeadline) $taskBun "$taskScratch/$Stage.ts"
 $taskExit=$LASTEXITCODE
}finally{
 Get-ChildItem Env:|ForEach-Object {[Environment]::SetEnvironmentVariable($_.Name,$null,'Process')}
 foreach($taskName in $taskOriginal.Keys){[Environment]::SetEnvironmentVariable($taskName,$taskOriginal[$taskName],'Process')}
}
@{originalChildExit=$taskExit;observedAtUtc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath "$taskDiag/launcher-child-exit.json"
exit $taskExit
