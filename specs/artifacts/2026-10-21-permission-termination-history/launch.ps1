param([Parameter(Mandatory=$true)][ValidateSet('before','after')][string]$Stage)
$ErrorActionPreference='Stop'
$taskRoot="C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/permission-termination-history-505-$Stage"
$taskDiag="$taskRoot-service"
$taskBun="$taskRoot-bundle/bin/bun.exe"
$taskRepo='D:/myhexin-local/opencorvus'
$taskPort=if($Stage -eq 'before'){18913}else{18915}
if(Test-Path -LiteralPath $taskDiag){throw 'Fresh diagnostic occurrence required'}
if(@(Get-NetTCPConnection -State Listen -LocalPort $taskPort -ErrorAction SilentlyContinue).Count){throw 'Owned test port occupied'}
if(!(Test-Path -LiteralPath ((Split-Path -Parent $taskBun)+'/ui/index.html'))){throw 'Formal477 UI required'}
$taskOriginal=@{}
Get-ChildItem Env: | ForEach-Object {$taskOriginal[$_.Name]=$_.Value}
$taskEnvironment=@{}
foreach($taskName in @('PATH','SystemRoot','WINDIR','ComSpec','PATHEXT','LANG','LC_ALL','LC_CTYPE')){if($taskOriginal.ContainsKey($taskName)){$taskEnvironment[$taskName]=$taskOriginal[$taskName]}}
$taskEnvironment.OPENCORVUS_HOME="$taskRoot/runtime"
$taskEnvironment.HOME="$taskRoot/home"
$taskEnvironment.USERPROFILE="$taskRoot/home"
$taskEnvironment.APPDATA="$taskRoot/appdata"
$taskEnvironment.LOCALAPPDATA="$taskRoot/localappdata"
$taskEnvironment.OPENCORVUS_DISABLE_EXTERNAL_SKILLS='1'
$taskEnvironment.OPENCORVUS_DISABLE_AUTOUPDATE='1'
$taskEnvironment.OPENCORVUS_TASK_PROCESS_MODE='native'
$taskEnvironment.OPENCORVUS_PROCESS_SUPERVISOR="$taskRepo/.tmp-product-iteration/native-parent-query-446/release-target/release/opencorvus-process-supervisor.exe"
$taskEnvironment.TEMP="$taskRoot/runtime/tmp"
$taskEnvironment.TMP=$taskEnvironment.TEMP
$taskEnvironment.TMPDIR=$taskEnvironment.TEMP
$taskOccurrence="permission-termination-history-505-$Stage-service-"+[Guid]::NewGuid().ToString()
$taskDeadline=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+1200000
New-Item -ItemType Directory -Path "$taskDiag/evidence" -Force|Out-Null
try{
 Get-ChildItem Env: | ForEach-Object {[Environment]::SetEnvironmentVariable($_.Name,$null,'Process')}
 foreach($taskName in $taskEnvironment.Keys){[Environment]::SetEnvironmentVariable($taskName,$taskEnvironment[$taskName],'Process')}
 & $taskBun "$taskRepo/.tmp-product-iteration/live-sol-task-guidance-413.ts" --owned-host "$taskDiag/evidence" $taskOccurrence ([string]$taskDeadline) $taskBun "$taskRepo/.tmp-product-iteration/permission-termination-history-505/serve.ts" "$taskRoot/runtime" 'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/real-deliverable-review-501-before/runtime/data/projects/2026/10/21/914ad776-f3b7-4073-a514-c2f97c293905' "$taskDiag/evidence" "$taskDiag/startup.json" ([string]$taskPort) $taskOccurrence
 $taskExit=$LASTEXITCODE
 Copy-Item -LiteralPath "$taskRoot/runtime/log/dev.log" -Destination "$taskDiag/runtime-dev-private.log"
}finally{
 Get-ChildItem Env: | ForEach-Object {[Environment]::SetEnvironmentVariable($_.Name,$null,'Process')}
 foreach($taskName in $taskOriginal.Keys){[Environment]::SetEnvironmentVariable($taskName,$taskOriginal[$taskName],'Process')}
}
@{childExitCode=$taskExit;observedAtUtc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath "$taskDiag/evidence/launcher-child-exit.json"
exit $taskExit
