$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/config-source-order-520-final-read')
$taskReady=Get-Content -LiteralPath "$taskRoot/evidence/native-host-ready.json" -Raw | ConvertFrom-Json
$taskNative=Get-Content -LiteralPath "$taskRoot/evidence/native-host-settled.json" -Raw | ConvertFrom-Json
$taskLauncher=Get-Content -LiteralPath "$taskRoot/evidence/launcher-child-exit.json" -Raw | ConvertFrom-Json
$taskAudit=Get-Content -LiteralPath "$taskRoot/evidence/provider-audit-current.json" -Raw | ConvertFrom-Json
$taskShutdown=Get-Content -LiteralPath "$taskRoot/evidence/shutdown.json" -Raw | ConvertFrom-Json
if(!$taskNative.physicalCompletion -or !$taskNative.outputDrainComplete -or !$taskNative.requestCleanupComplete -or $taskNative.terminal.exitCode -ne 0 -or $taskLauncher.originalChildExit -ne 0 -or $taskShutdown.statusCode -ne 200){throw 'Original final whole-chain success required'}
if($taskAudit.maximum -ne 0 -or $taskAudit.actual -ne 0 -or $taskAudit.exhausted){throw 'Original zero-model bound required'}
. 'D:/myhexin-local/opencorvus/.tmp-product-iteration/live-sol-long-source-reading-406-launch.ps1' -FunctionsOnly
$taskChain=@($taskReady.host,$taskReady.target)|ForEach-Object {@{identity=$_;state=(Get-OwnedNativeState $_)}}
if(@($taskChain|Where-Object state -ne 'dead_or_reused').Count){throw 'Original final physical occurrence remains live'}
$taskCatalog=[IO.Path]::GetFullPath((Join-Path $taskRoot 'runtime/data/models.json'))
if([IO.Path]::GetDirectoryName($taskCatalog) -cne [IO.Path]::GetFullPath((Join-Path $taskRoot 'runtime/data'))){throw 'Exact owned public catalog required'}
if((Get-Item -LiteralPath $taskCatalog).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Catalog is a reparse point'}
$taskCatalogBytes=(Get-Item -LiteralPath $taskCatalog).Length
Remove-Item -LiteralPath $taskCatalog -ErrorAction Stop
@{at=[DateTime]::UtcNow.ToString('o');originalHandle=43298;originalExit=0;native=$taskNative;launcher=$taskLauncher;shutdown=$taskShutdown;chain=$taskChain;provider=$taskAudit;publicCatalog=@{bytes=$taskCatalogBytes;outcome='retired after original full physical/output/request/launcher settlement'};credentials='None staged or used';boundary='Final exact production source/API/manual page on actual Windows case-equivalent resource directory;no model/credential qualification claim'}|ConvertTo-Json -Depth 16 | Set-Content -LiteralPath "$taskRoot/evidence/physical-terminal.json"
Write-Output 'Final source-read scope fully settled;0/0 requests;public catalog retired'
