param([Parameter(Mandatory=$true)][ValidateSet('control-before','control-after')][string]$Stage)
$ErrorActionPreference='Stop'
$taskRepo='D:/myhexin-local/opencorvus'
$taskRun="C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/git-executable-flow-492-$Stage/checker"
$taskBun='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/dependency-redirect-hardening-488-after-bundle/bin/bun.exe'
foreach($taskDirectory in @('runtime/tmp','home','appdata','localappdata','evidence')){New-Item -ItemType Directory -Path "$taskRun/$taskDirectory" -Force|Out-Null}
if(Test-Path -LiteralPath "$taskRun/evidence/native-host-ready.json"){throw 'Fresh checker occurrence required'}
$taskOriginal=@{};Get-ChildItem Env:|ForEach-Object {$taskOriginal[$_.Name]=$_.Value}
$taskEnv=@{};foreach($taskName in @('PATH','SystemRoot','WINDIR','ComSpec','PATHEXT','LANG','LC_ALL','LC_CTYPE')){if($taskOriginal.ContainsKey($taskName)){$taskEnv[$taskName]=$taskOriginal[$taskName]}}
$taskEnv.OPENCORVUS_HOME="$taskRun/runtime";$taskEnv.HOME="$taskRun/home";$taskEnv.USERPROFILE="$taskRun/home";$taskEnv.APPDATA="$taskRun/appdata";$taskEnv.LOCALAPPDATA="$taskRun/localappdata"
$taskEnv.OPENCORVUS_TASK_PROCESS_MODE='native';$taskEnv.OPENCORVUS_PROCESS_SUPERVISOR="$taskRepo/.tmp-product-iteration/native-parent-query-446/release-target/release/opencorvus-process-supervisor.exe"
$taskEnv.TEMP="$taskRun/runtime/tmp";$taskEnv.TMP=$taskEnv.TEMP;$taskEnv.TMPDIR=$taskEnv.TEMP
$taskOccurrence='git-executable-flow-492-checker-'+$Stage+'-'+[Guid]::NewGuid().ToString()
$taskDeadline=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+240000
try{
 Get-ChildItem Env:|ForEach-Object {[Environment]::SetEnvironmentVariable($_.Name,$null,'Process')}
 foreach($taskName in $taskEnv.Keys){[Environment]::SetEnvironmentVariable($taskName,$taskEnv[$taskName],'Process')}
 & $taskBun "$taskRepo/.tmp-product-iteration/live-sol-task-guidance-413.ts" --owned-host "$taskRun/evidence" $taskOccurrence ([string]$taskDeadline) $taskBun "$taskRepo/.tmp-product-iteration/git-executable-flow-492/check-control.ts" $Stage
 $taskExit=$LASTEXITCODE
}finally{
 Get-ChildItem Env:|ForEach-Object {[Environment]::SetEnvironmentVariable($_.Name,$null,'Process')}
 foreach($taskName in $taskOriginal.Keys){[Environment]::SetEnvironmentVariable($taskName,$taskOriginal[$taskName],'Process')}
}
@{originalChildExit=$taskExit;observedAtUtc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath "$taskRun/evidence/launcher-child-exit.json"
exit $taskExit
