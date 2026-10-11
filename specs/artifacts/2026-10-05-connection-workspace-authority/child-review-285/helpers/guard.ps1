$ErrorActionPreference='Stop'
$taskRepo='D:/myhexin-local/opencorvus'
$taskSource='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-08/store-card-accessor-after-153-01'
$taskOut=Join-Path $taskRepo 'specs/artifacts/2026-10-05-connection-workspace-authority/child-review-285/history-readiness'
. (Join-Path $taskRepo '.tmp-product-iteration/live-sol-launch.ps1') -FunctionsOnly
$taskOwner=Get-Content -Raw -LiteralPath (Join-Path $taskSource 'launch-owner.json') | ConvertFrom-Json -AsHashtable -DateKind String
$taskPrior=Get-Content -Raw -LiteralPath (Join-Path $taskRepo 'specs/artifacts/2026-10-05-connection-workspace-authority/child-source-272/history-readiness/guard.json') | ConvertFrom-Json -AsHashtable -DateKind String
if($taskPrior.occurrence -cne $taskOwner.occurrence -or !$taskPrior.parent.joined -or $taskPrior.parent.parentExit -ne 0 -or $taskPrior.parent.parentSession -ne 30224 -or (Get-Item -LiteralPath $taskPrior.parent.rawPrivatePath).Length -ne $taskPrior.parent.rawLength){throw 'Original parent custody mismatch'}
$taskStates=@(@{expected=$taskOwner.host;state=(Get-OwnedNativeState $taskOwner.host)},@{expected=$taskOwner.nativeTarget;state=(Get-OwnedNativeState $taskOwner.nativeTarget)})
$taskListeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object {$_.LocalPort -in @($taskOwner.port,18232)})
$taskPair=@('auth.json','models.json' | ForEach-Object {@{name=$_;present=(Test-Path -LiteralPath (Join-Path $taskSource ('runtime/data/'+$_)))}})
$taskNative=Get-OwnedNativeSettlement $taskOwner
if(@($taskStates | Where-Object state -ne 'dead_or_reused').Count -or $taskListeners.Count -or @($taskPair | Where-Object present).Count -or !$taskNative -or $taskNative.terminal.exitCode -ne 0){throw 'Original physical/runtime closure incomplete'}
Write-OwnedLaunchFact (Join-Path $taskOut 'guard.json') @{readQualified=$true;sourceRun=$taskSource;occurrence=$taskOwner.occurrence;observedAtUtc=[DateTime]::UtcNow.ToString('o');states=$taskStates;listenerCount=$taskListeners.Count;pair=$taskPair;native=$taskNative;parent=$taskPrior.parent;boundary='Fresh285 exact original process birth, listeners, pair, physical/output/request settlement; original parent30224 receipt and original raw length retained, not a fresh parent execution'}
Write-Output 'Fresh original physical closure verified; current schema and complete startup facts remain to be inspected.'
