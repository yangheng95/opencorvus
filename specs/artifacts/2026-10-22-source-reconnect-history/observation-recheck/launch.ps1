param([Parameter(Mandatory=$true)][ValidateSet('before','after')][string]$Stage)
$ErrorActionPreference='Stop'
$taskRepo='D:/myhexin-local/opencorvus'
$taskBase='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22'
$taskRun="$taskBase/source-reconnect-observation-535-$Stage"
$taskAuthority="$taskBase/source-reconnect-observation-535-$Stage-authority"
$taskBun="$taskBase/source-reconnect-observation-535-$Stage-bundle/bin/bun.exe"
$taskBudget=[int](Get-Content -Raw -LiteralPath "$PSScriptRoot/plan.json"|ConvertFrom-Json).maximumRequestsPerStartedScope
$taskWrapper="$taskRepo/.tmp-product-iteration/live-sol-task-guidance-413.ts"
$taskPort=if($Stage -eq 'before'){19051}else{19051}
if(@(Get-NetTCPConnection -State Listen -LocalPort $taskPort -ErrorAction SilentlyContinue).Count){throw 'Owned port occupied'}
if(Test-Path -LiteralPath "$taskRun/evidence/native-host-ready.json"){throw 'Fresh diagnostic occurrence required'}
foreach($taskName in @('auth.json','models.json')){if(Test-Path -LiteralPath "$taskRun/runtime/data/$taskName"){throw 'Owned runtime authority must be fresh before paired staging'}}
if(!(Test-Path -LiteralPath ((Split-Path -Parent $taskBun)+'/ui/index.html'))){throw 'Owned formal UI bundle missing'}
$taskOriginal=@{}
Get-ChildItem Env:|ForEach-Object {$taskOriginal[$_.Name]=$_.Value}
$taskEnvironment=@{}
foreach($taskName in @('PATH','SystemRoot','WINDIR','ComSpec','PATHEXT','LANG','LC_ALL','LC_CTYPE')){if($taskOriginal.ContainsKey($taskName)){$taskEnvironment[$taskName]=$taskOriginal[$taskName]}}
$taskEnvironment.OPENCORVUS_HOME="$taskRun/runtime"
$taskEnvironment.HOME="$taskRun/home"
$taskEnvironment.USERPROFILE="$taskRun/home"
$taskEnvironment.HOMEDRIVE='C:'
$taskEnvironment.HOMEPATH=([IO.Path]::GetFullPath("$taskRun/home")).Substring(2)
$taskEnvironment.APPDATA="$taskRun/appdata"
$taskEnvironment.LOCALAPPDATA="$taskRun/localappdata"
$taskEnvironment.OPENCORVUS_DISABLE_EXTERNAL_SKILLS='1'
$taskEnvironment.OPENCORVUS_DISABLE_AUTOUPDATE='1'
$taskEnvironment.OPENCORVUS_TASK_PROCESS_MODE='native'
$taskEnvironment.OPENCORVUS_PROCESS_SUPERVISOR="$taskRepo/.tmp-product-iteration/native-parent-query-446/release-target/release/opencorvus-process-supervisor.exe"
$taskEnvironment.TEMP="$taskRun/runtime/tmp"
$taskEnvironment.TMP=$taskEnvironment.TEMP
$taskEnvironment.TMPDIR=$taskEnvironment.TEMP
$taskOccurrence='source-reconnect-observation-535-'+$Stage+'-'+[Guid]::NewGuid().ToString()
$taskDeadline=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+1200000
try{
 Get-ChildItem Env:|ForEach-Object {[Environment]::SetEnvironmentVariable($_.Name,$null,'Process')}
 foreach($taskName in $taskEnvironment.Keys){[Environment]::SetEnvironmentVariable($taskName,$taskEnvironment[$taskName],'Process')}
 & $taskBun $taskWrapper --owned-host "$taskRun/evidence" $taskOccurrence ([string]$taskDeadline) $taskBun "D:\myhexin-local\opencorvus/.tmp-product-iteration/task-member-stream-504/serve.ts" "$taskAuthority/auth.json" "$taskRun/runtime" 'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh/project' "$taskRun/evidence" "$taskRun/startup.json" ([string]$taskPort) $taskOccurrence "$taskRun/selection.json" "$taskRepo/.tmp-product-iteration/long-source-reading-406/builtin.json" ([string]$taskBudget) 'NativeService'
 $taskExit=$LASTEXITCODE
 if(Test-Path -LiteralPath "$taskRun/runtime/log/dev.log"){Copy-Item -LiteralPath "$taskRun/runtime/log/dev.log" -Destination "$taskRun/runtime-dev-private.log"}
}finally{
 Get-ChildItem Env:|ForEach-Object {[Environment]::SetEnvironmentVariable($_.Name,$null,'Process')}
 foreach($taskName in $taskOriginal.Keys){[Environment]::SetEnvironmentVariable($taskName,$taskOriginal[$taskName],'Process')}
}
@{originalChildExit=$taskExit;observedAtUtc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath "$taskRun/evidence/launcher-child-exit.json"
exit $taskExit
