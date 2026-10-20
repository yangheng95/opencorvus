param([Parameter(Mandatory=$true)][ValidateSet('control-before','control-after')][string]$Stage)
$ErrorActionPreference='Stop'
$taskRepo='D:/myhexin-local/opencorvus'
$taskBase='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21'
$taskRun="$taskBase/git-executable-flow-492-$Stage"
$taskAuthority="$taskBase/git-executable-flow-492-authority"
$taskBun="$taskBase/dependency-redirect-hardening-488-after-bundle/bin/bun.exe"
$taskWrapper="$taskRepo/.tmp-product-iteration/live-sol-task-guidance-413.ts"
$taskPort=if($Stage -eq 'control-before'){18867}else{18869}
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
$taskOccurrence='git-executable-flow-492-'+$Stage+'-'+[Guid]::NewGuid().ToString()
$taskDeadline=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+240000
$taskPreloads=@(); if($Stage -eq 'control-before'){$taskPreloads=@('--preload',"$taskRepo/.tmp-product-iteration/git-executable-flow-492/before-loader.ts")}
try{
 Get-ChildItem Env:|ForEach-Object {[Environment]::SetEnvironmentVariable($_.Name,$null,'Process')}
 foreach($taskName in $taskEnvironment.Keys){[Environment]::SetEnvironmentVariable($taskName,$taskEnvironment[$taskName],'Process')}
 & $taskBun $taskWrapper --owned-host "$taskRun/evidence" $taskOccurrence ([string]$taskDeadline) $taskBun @taskPreloads "$taskRepo/.tmp-product-iteration/git-executable-flow-492/api-wrapper.ts" "$taskAuthority/auth.json" "$taskRun/runtime" 'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh/project' "$taskRun/evidence" "$taskRun/startup.json" ([string]$taskPort) $taskOccurrence "$taskRun/selection.json" "$taskRepo/.tmp-product-iteration/long-source-reading-406/builtin.json" '0' 'NativeService'
 $taskExit=$LASTEXITCODE
 if(Test-Path -LiteralPath "$taskRun/runtime/log/dev.log"){Copy-Item -LiteralPath "$taskRun/runtime/log/dev.log" -Destination "$taskRun/runtime-dev-private.log"}
}finally{
 Get-ChildItem Env:|ForEach-Object {[Environment]::SetEnvironmentVariable($_.Name,$null,'Process')}
 foreach($taskName in $taskOriginal.Keys){[Environment]::SetEnvironmentVariable($taskName,$taskOriginal[$taskName],'Process')}
}
@{originalChildExit=$taskExit;observedAtUtc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath "$taskRun/evidence/launcher-child-exit.json"
exit $taskExit
