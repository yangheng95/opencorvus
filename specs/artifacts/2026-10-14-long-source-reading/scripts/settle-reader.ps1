param([Parameter(Mandatory=$true)][string]$DiagnosticRoot)
$ErrorActionPreference='Stop'
$taskBase='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14'
$taskResolved=[IO.Path]::GetFullPath($DiagnosticRoot)
if([IO.Path]::GetDirectoryName($taskResolved) -ne [IO.Path]::GetFullPath($taskBase) -or [IO.Path]::GetFileName($taskResolved) -ne 'long-source-reading-406-diagnostic-03'){throw 'Exact diagnostic occurrence directory required'}
$taskReady=Get-Content -Raw -LiteralPath "$taskResolved/evidence/native-host-ready.json" | ConvertFrom-Json
$taskSettled=Get-Content -Raw -LiteralPath "$taskResolved/evidence/native-host-settled.json" | ConvertFrom-Json
if($taskSettled.occurrence -cne $taskReady.occurrence -or !$taskSettled.physicalCompletion -or !$taskSettled.outputDrainComplete -or !$taskSettled.requestCleanupComplete -or $taskSettled.target.processInstanceID -cne $taskReady.target.processInstanceID){throw 'Physical native settlement required before pair retirement'}
. 'D:/myhexin-local/opencorvus/.tmp-product-iteration/live-sol-long-source-reading-406-launch.ps1' -FunctionsOnly
$taskChain=@($taskReady.host,$taskReady.target)|ForEach-Object {@{identity=$_;state=(Get-OwnedNativeState $_)}}
if(@($taskChain|Where-Object state -NE 'dead_or_reused').Count){throw 'Exact process occurrence remains live'}
if(@(Get-NetTCPConnection -State Listen -LocalPort 18521 -ErrorAction SilentlyContinue).Count){throw 'Diagnostic port still listening'}
$taskData=[IO.Path]::GetFullPath("$taskBase/long-source-reading-406-live/runtime/data")
foreach($taskDir in @("$taskBase/long-source-reading-406-live","$taskBase/long-source-reading-406-live/runtime",$taskData)){
 if((Get-Item -LiteralPath $taskDir).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Pair ancestor is a reparse point'}
}
$taskPair=@()
foreach($taskName in @('auth.json','models.json')){
 $taskPath=[IO.Path]::GetFullPath((Join-Path $taskData $taskName))
 if([IO.Path]::GetDirectoryName($taskPath) -ne $taskData){throw 'Pair target escaped owned data'}
 if(Test-Path -LiteralPath $taskPath){
  if((Get-Item -LiteralPath $taskPath).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Pair member is a reparse point'}
  Remove-Item -LiteralPath $taskPath -ErrorAction Stop
 }
 $taskPair+=@{name=$taskName;outcome='retired'}
}
@{occurrence=$taskReady.occurrence;observedAtUtc=[DateTime]::UtcNow.ToString('o');native=$taskSettled;chain=$taskChain;copiedPair=$taskPair;physicalCompletion=$true;pairedCleanupComplete=$true}|ConvertTo-Json -Depth 10|Set-Content -LiteralPath "$taskResolved/evidence/physical-terminal-and-pair-cleanup.json"
