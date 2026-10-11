$ErrorActionPreference='Stop'
$repo299='D:/myhexin-local/opencorvus'
$source299='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-11/live-child-298-live-01'
$out299=Join-Path $repo299 'specs/artifacts/2026-10-05-connection-workspace-authority/tool-failure-299/readiness'
. (Join-Path $repo299 '.tmp-product-iteration/live-sol-launch.ps1') -FunctionsOnly
$owner299=Get-Content -Raw -LiteralPath (Join-Path $source299 'launch-owner.json')|ConvertFrom-Json -AsHashtable -DateKind String
$joined299=Get-Content -Raw -LiteralPath (Join-Path $owner299.settlementEvidenceRoot 'original-exec-joined.json')|ConvertFrom-Json -AsHashtable -DateKind String
if($joined299.sessionID -ne 98045 -or $joined299.exit_code -ne 0 -or $joined299.output -notmatch [regex]::Escape($owner299.occurrence)){throw 'Original actual exec completion identity required'}
$states299=@(@{expected=$owner299.host;state=(Get-OwnedNativeState $owner299.host)},@{expected=$owner299.nativeTarget;state=(Get-OwnedNativeState $owner299.nativeTarget)})
$ports299=@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object {$_.LocalPort -in @($owner299.port,18259)})
$pair299=@('auth.json','models.json'|ForEach-Object{@{name=$_;present=(Test-Path -LiteralPath (Join-Path $source299 ('runtime/data/'+$_)))}})
$native299=Get-OwnedNativeSettlement $owner299
if(@($states299|Where-Object state -ne 'dead_or_reused').Count -or $ports299.Count -or @($pair299|Where-Object present).Count -or !$native299 -or $native299.terminal.exitCode -ne 0){throw 'Original current source closure requires investigation'}
Write-OwnedLaunchFact (Join-Path $out299 'guard.json') @{readQualified=$true;sourceRun=$source299;occurrence=$owner299.occurrence;observedAtUtc=[DateTime]::UtcNow.ToString('o');states=$states299;listeners=$ports299;pair=$pair299;native=$native299;originalExec=$joined299;boundary='Current exact original Host/Native birth and source/new ports; actual original exec joined0 retained. Canonical startup frontiers still require read-only qualification.'}
Write-Output 'Original298 current native closure and actual exec join qualified.'
