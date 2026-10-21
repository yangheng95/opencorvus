$ErrorActionPreference='Stop'
$taskRoot='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/config-source-order-520-final-read'
$taskRepo='D:/myhexin-local/opencorvus'
$taskBun="$taskRoot-bundle/bin/bun.exe"
$taskPort=18991
if(Test-Path -LiteralPath "$taskRoot/evidence/native-host-ready.json"){throw 'Fresh zero-model occurrence required'}
if(Test-Path -LiteralPath "$taskRoot/runtime/data/auth.json"){throw 'No credentials allowed in final read scope'}
if(!(Test-Path -LiteralPath "$taskRoot/runtime/data/models.json")){throw 'Complete public model catalog required'}
if(@(Get-NetTCPConnection -State Listen -LocalPort $taskPort -ErrorAction SilentlyContinue).Count){throw 'Owned port occupied'}
$taskOriginal=@{}
Get-ChildItem Env:|ForEach-Object {$taskOriginal[$_.Name]=$_.Value}
$taskEnvironment=@{}
foreach($taskName in @('PATH','SystemRoot','WINDIR','ComSpec','PATHEXT','LANG','LC_ALL','LC_CTYPE')){if($taskOriginal.ContainsKey($taskName)){$taskEnvironment[$taskName]=$taskOriginal[$taskName]}}
$taskEnvironment.OPENCORVUS_HOME="$taskRoot/runtime"
$taskEnvironment.HOME="$taskRoot/home"
$taskEnvironment.USERPROFILE="$taskRoot/home"
$taskEnvironment.APPDATA="$taskRoot/appdata"
$taskEnvironment.LOCALAPPDATA="$taskRoot/localappdata"
$taskEnvironment.OPENCORVUS_CONFIG="$taskRoot/custom.jsonc"
$taskEnvironment.OPENCORVUS_CONFIG_DIR=([IO.Path]::GetFullPath("$taskRoot/runtime/config")).ToUpperInvariant()+'/.'
$taskEnvironment.OPENCORVUS_TEST_MANAGED_CONFIG_DIR="$taskRoot/managed"
if(!(Test-Path -LiteralPath $taskEnvironment.OPENCORVUS_CONFIG_DIR)){throw 'Actual Windows case-equivalent directory required'}
$taskEnvironment.OPENCORVUS_DISABLE_EXTERNAL_SKILLS='1'
$taskEnvironment.OPENCORVUS_DISABLE_AUTOUPDATE='1'
$taskEnvironment.OPENCORVUS_TASK_PROCESS_MODE='native'
$taskEnvironment.OPENCORVUS_PROCESS_SUPERVISOR="$taskRepo/.tmp-product-iteration/native-parent-query-446/release-target/release/opencorvus-process-supervisor.exe"
$taskEnvironment.TEMP="$taskRoot/runtime/tmp"
$taskEnvironment.TMP=$taskEnvironment.TEMP
$taskEnvironment.TMPDIR=$taskEnvironment.TEMP
$taskOccurrence='config-source-order-520-final-read-'+[Guid]::NewGuid().ToString()
$taskDeadline=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+1200000
try{
 Get-ChildItem Env:|ForEach-Object {[Environment]::SetEnvironmentVariable($_.Name,$null,'Process')}
 foreach($taskName in $taskEnvironment.Keys){[Environment]::SetEnvironmentVariable($taskName,$taskEnvironment[$taskName],'Process')}
 & $taskBun "$taskRepo/.tmp-product-iteration/live-sol-task-guidance-413.ts" --owned-host "$taskRoot/evidence" $taskOccurrence ([string]$taskDeadline) $taskBun "$taskRepo/.tmp-product-iteration/config-source-order-520/serve-final-read.ts" "$taskRoot/runtime" "$taskRoot/project" "$taskRoot/evidence" "$taskRoot/startup.json" ([string]$taskPort) $taskOccurrence
 $taskExit=$LASTEXITCODE
}finally{
 Get-ChildItem Env:|ForEach-Object {[Environment]::SetEnvironmentVariable($_.Name,$null,'Process')}
 foreach($taskName in $taskOriginal.Keys){[Environment]::SetEnvironmentVariable($taskName,$taskOriginal[$taskName],'Process')}
}
@{originalChildExit=$taskExit;observedAtUtc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath "$taskRoot/evidence/launcher-child-exit.json"
exit $taskExit
