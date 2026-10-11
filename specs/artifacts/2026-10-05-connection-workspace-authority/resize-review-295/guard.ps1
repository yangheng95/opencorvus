$ErrorActionPreference='Stop'
$taskManifest=Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'history-manifest.json') | ConvertFrom-Json -AsHashtable -DateKind String
. 'D:/myhexin-local/opencorvus/.tmp-product-iteration/live-sol-launch.ps1' -FunctionsOnly
$taskSource=$taskManifest.sourceRun
$taskOwner=Get-Content -Raw -LiteralPath (Join-Path $taskSource 'launch-owner.json') | ConvertFrom-Json -AsHashtable -DateKind String
if($taskOwner.occurrence -cne $taskManifest.sourceOccurrence -or [IO.Path]::GetFullPath($taskOwner.project) -ne [IO.Path]::GetFullPath($taskManifest.sourceProject)){throw 'Exact original source owner required'}
$taskStates=@(@{expected=$taskOwner.host;state=(Get-OwnedNativeState $taskOwner.host)},@{expected=$taskOwner.nativeTarget;state=(Get-OwnedNativeState $taskOwner.nativeTarget)})
$taskListeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object LocalPort -eq $taskOwner.port)
$taskPair=@('auth.json','models.json') | ForEach-Object { @{name=$_;present=(Test-Path -LiteralPath (Join-Path $taskSource ('runtime/data/'+$_)))} }
$taskNative=Get-OwnedNativeSettlement $taskOwner
if(@($taskStates | Where-Object state -ne 'dead_or_reused').Count -or $taskListeners.Count -or @($taskPair | Where-Object present).Count -or !$taskNative -or $taskNative.terminal.exitCode -ne 0){throw 'Original physical/runtime closure incomplete'}
Write-OwnedLaunchFact (Join-Path $taskManifest.readinessEvidence 'guard.json') @{readQualified=$true;sourceRun=$taskSource;occurrence=$taskOwner.occurrence;observedAtUtc=[DateTime]::UtcNow.ToString('o');states=$taskStates;listenerCount=$taskListeners.Count;pair=$taskPair;native=$taskNative;parent=@{originalSession=8944;originalActualExit=0;receipt='specs/artifacts/2026-10-05-connection-workspace-authority/stream-reading-plan-294.md';boundary='Prior actual joined foreground receipt; no new parent execution inferred'};boundary='Fresh295 exact original process birth, listener, pair, physical/output/request settlement; canonical startup/readiness remains required'}
Write-Output 'Original294 current physical closure qualified.'
