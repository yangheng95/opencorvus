$ErrorActionPreference='Stop'
$taskRun='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/long-source-reading-406-live'
$taskDiag='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/long-source-reading-406-diagnostic-02'
$taskBun='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/long-source-reading-406-diagnostic-bundle/bin/bun.exe'
$taskWrapper='D:/myhexin-local/opencorvus/.tmp-product-iteration/live-sol-long-source-reading-406.ts'
if(Test-Path -LiteralPath $taskDiag){throw 'Fresh diagnostic occurrence already exists'}
if(Test-Path -LiteralPath "$taskRun/runtime/data/auth.json"){throw 'History reader expects the already-retired credential copy'}
if(@(Get-NetTCPConnection -State Listen -LocalPort 18521 -ErrorAction SilentlyContinue).Count){throw 'Reader port occupied'}
New-Item -ItemType Directory -Path "$taskDiag/evidence" -Force | Out-Null
$taskOccurrence='long-source-reader-'+[Guid]::NewGuid().ToString()
$taskDeadline=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+900000
$taskOriginal=@{}
Get-ChildItem Env: | ForEach-Object {$taskOriginal[$_.Name]=$_.Value}
$taskEnvironment=@{}
foreach($taskName in @('PATH','SystemRoot','WINDIR','ComSpec','PATHEXT','LANG','LC_ALL','LC_CTYPE')){if($taskOriginal.ContainsKey($taskName)){$taskEnvironment[$taskName]=$taskOriginal[$taskName]}}
$taskEnvironment.OPENCORVUS_HOME="$taskRun/runtime"
$taskEnvironment.USERPROFILE="$taskRun/home"
$taskEnvironment.HOMEDRIVE='C:'
$taskEnvironment.HOMEPATH=([IO.Path]::GetFullPath("$taskRun/home")).Substring(2)
$taskEnvironment.APPDATA="$taskRun/appdata"
$taskEnvironment.LOCALAPPDATA="$taskRun/localappdata"
$taskEnvironment.OPENCORVUS_DISABLE_EXTERNAL_SKILLS='1'
$taskEnvironment.OPENCORVUS_DISABLE_AUTOUPDATE='1'
$taskEnvironment.OPENCORVUS_TASK_PROCESS_MODE='native'
$taskEnvironment.TEMP="$taskRun/runtime/tmp"
$taskEnvironment.TMP=$taskEnvironment.TEMP
$taskEnvironment.TMPDIR=$taskEnvironment.TEMP
try{
 Get-ChildItem Env: | ForEach-Object {[Environment]::SetEnvironmentVariable($_.Name,$null,'Process')}
 foreach($taskName in $taskEnvironment.Keys){[Environment]::SetEnvironmentVariable($taskName,$taskEnvironment[$taskName],'Process')}
 & $taskBun $taskWrapper --owned-host "$taskDiag/evidence" $taskOccurrence ([string]$taskDeadline) $taskBun --cwd D:/myhexin-local/opencorvus/packages/opencorvus ./src/index.ts serve --hostname 127.0.0.1 --port 18521 --project-dir "$taskRun/project" --startup-receipt "$taskDiag/startup.json" --startup-occurrence $taskOccurrence
 $taskExit=$LASTEXITCODE
}finally{
 Get-ChildItem Env: | ForEach-Object {[Environment]::SetEnvironmentVariable($_.Name,$null,'Process')}
 foreach($taskName in $taskOriginal.Keys){[Environment]::SetEnvironmentVariable($taskName,$taskOriginal[$taskName],'Process')}
}
exit $taskExit
