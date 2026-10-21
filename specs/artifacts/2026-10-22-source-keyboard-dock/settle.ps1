param([Parameter(Mandatory=$true)][ValidateSet('before','after')][string]$Stage,[Parameter(Mandatory=$true)][int]$OriginalHandle)
$ErrorActionPreference='Stop'
$taskPort=@{before=18979;after=18981}[$Stage]
$taskEvidence="C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/source-keyboard-dock-517-$Stage-service/evidence"
$taskReady=Get-Content -Raw -LiteralPath "$taskEvidence/native-host-ready.json"|ConvertFrom-Json
$taskSettled=Get-Content -Raw -LiteralPath "$taskEvidence/native-host-settled.json"|ConvertFrom-Json
$taskLauncher=Get-Content -Raw -LiteralPath "$taskEvidence/launcher-child-exit.json"|ConvertFrom-Json
$taskShutdown=Get-Content -Raw -LiteralPath "$taskEvidence/public-shutdown.json"|ConvertFrom-Json
if(!$taskSettled.physicalCompletion -or !$taskSettled.outputDrainComplete -or !$taskSettled.requestCleanupComplete -or $taskSettled.occurrence -cne $taskReady.occurrence -or $taskSettled.target.processInstanceID -cne $taskReady.target.processInstanceID -or $taskLauncher.childExitCode -ne 0 -or $taskShutdown.statusCode -ne 200){throw 'Original native/output/request/launcher/public-shutdown settlement required'}
. 'D:/myhexin-local/opencorvus/.tmp-product-iteration/live-sol-long-source-reading-406-launch.ps1' -FunctionsOnly
$taskChain=@($taskReady.host,$taskReady.target)|ForEach-Object {@{identity=$_;state=(Get-OwnedNativeState $_)}}
if(@($taskChain|Where-Object state -NE 'dead_or_reused').Count){throw 'Original process occurrence remains live'}
if(@(Get-NetTCPConnection -State Listen -LocalPort $taskPort -ErrorAction SilentlyContinue).Count){throw 'Owned port still live'}
$taskAudit=Get-Content -Raw -LiteralPath "$taskEvidence/provider-audit-current.json"|ConvertFrom-Json
if($taskAudit.maximum -ne 0 -or $taskAudit.actual -ne 0 -or $taskAudit.exhausted){throw 'Zero model qualification scope was exceeded'}
@{provider=$taskAudit;native=$taskSettled;chain=$taskChain;launcher=$taskLauncher;shutdown=$taskShutdown;originalHandle=$OriginalHandle;originalExit=0;observedAtUtc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Depth 12|Set-Content -LiteralPath "$taskEvidence/physical-terminal.json"
Write-Output "Original $OriginalHandle native/output/request/launcher physically settled;public shutdown200"
