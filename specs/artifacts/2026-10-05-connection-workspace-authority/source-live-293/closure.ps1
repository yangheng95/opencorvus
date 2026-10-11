param([string]$CaseRun,[string]$CaseEvidence)
$ErrorActionPreference='Stop'
$runClosure231=[IO.Path]::GetFullPath($CaseRun); $evidenceClosure231=[IO.Path]::GetFullPath($CaseEvidence)
$ownerClosure231=Get-Content -Raw -LiteralPath (Join-Path $runClosure231 'launch-owner.json') | ConvertFrom-Json -AsHashtable -DateKind String
. 'D:/myhexin-local/opencorvus/.tmp-product-iteration/live-sol-launch.ps1' -FunctionsOnly
$statesClosure231=@(@{expected=$ownerClosure231.host;state=(Get-OwnedNativeState $ownerClosure231.host)},@{expected=$ownerClosure231.nativeTarget;state=(Get-OwnedNativeState $ownerClosure231.nativeTarget)})
$portsClosure231=@(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object LocalPort -eq $ownerClosure231.port | Select-Object LocalPort,OwningProcess)
$pairClosure231=@('auth.json','models.json' | ForEach-Object {@{name=$_;present=(Test-Path -LiteralPath (Join-Path $runClosure231 ('runtime/data/'+$_)))}})
$nativeClosure231=Get-OwnedNativeSettlement $ownerClosure231
if(!$nativeClosure231 -or $nativeClosure231.terminal.exitCode -ne 0 -or @($statesClosure231 | Where-Object state -ne 'dead_or_reused').Count -or $portsClosure231.Count -or @($pairClosure231 | Where-Object present).Count){throw 'Exact real Provider service closure incomplete'}
Write-OwnedLaunchFact (Join-Path $evidenceClosure231 'closure-readback.json') @{observedAtUtc=[DateTime]::UtcNow.ToString('o');qualificationKind=$ownerClosure231.qualificationKind;occurrence=$ownerClosure231.occurrence;states=$statesClosure231;listeners=$portsClosure231;pair=$pairClosure231;native=$nativeClosure231;boundary='Independent actual NativeService physical/output/request birth-port-pair readback; original live-sol foreground already joined. Real service emits owner/startup/preflight receipts, not full-history copy launcher receipts.'}
Write-Output 'Independent actual real Provider closure verified.'
