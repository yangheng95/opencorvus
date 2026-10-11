param([Parameter(Mandatory=$true)][string]$Stage)
$ErrorActionPreference='Stop'
$repoP228='D:/myhexin-local/opencorvus'
$runP228='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-11/source-location-281-'+$Stage.Replace('live','live-')
$evidenceP228=Join-Path $repoP228 ('specs/artifacts/2026-10-05-connection-workspace-authority/source-location-281/'+$Stage.Replace('live','live-'))
$ownerP228=Get-Content -Raw -LiteralPath (Join-Path $runP228 'launch-owner.json') | ConvertFrom-Json -AsHashtable -DateKind String
. (Join-Path $repoP228 '.tmp-product-iteration/live-sol-launch.ps1') -FunctionsOnly
if((Get-OwnedNativeState $ownerP228.host) -ne 'dead_or_reused' -or (Get-OwnedNativeState $ownerP228.nativeTarget) -ne 'dead_or_reused'){throw 'Own process chain must be terminal'}
$birthP228=[DateTime]::new([Int64]$ownerP228.nativeTarget.processInstanceID.Replace('win32:',''),[DateTimeKind]::Utc)
$fromRootP228=[IO.Path]::GetFullPath((Join-Path $repoP228 'packages/opencorvus/bun/@t@'))
$toRootP228=[IO.Path]::GetFullPath((Join-Path $repoP228 ('.tmp-product-iteration/source-location-281/generated-bun-'+$Stage)))
[IO.Directory]::CreateDirectory($toRootP228) | Out-Null
$filesP228=@()
foreach($nameP228 in @('091d165574530ade.debug.pile','69cc5fa7b1dcf631.debug.pile','7a87559fbb4087c4.debug.pile','cf86f20c120ce818.debug.pile','f9ce0c567348c89d.debug.pile')){
 $fromP228=[IO.Path]::GetFullPath((Join-Path $fromRootP228 $nameP228));$toP228=[IO.Path]::GetFullPath((Join-Path $toRootP228 $nameP228))
 if(!$fromP228.StartsWith($fromRootP228+[IO.Path]::DirectorySeparatorChar) -or !$toP228.StartsWith($toRootP228+[IO.Path]::DirectorySeparatorChar)){throw 'Single file archive boundary failed'}
 $itemP228=Get-Item -LiteralPath $fromP228
 if($itemP228.CreationTimeUtc -lt $birthP228 -or $itemP228.CreationTimeUtc -gt $birthP228.AddSeconds(2) -or (Test-Path -LiteralPath $toP228)){throw 'Exact current native file birth required'}
 $filesP228+=@{name=$nameP228;bytes=$itemP228.Length;birthUtc=$itemP228.CreationTimeUtc.ToString('o');destination=$toP228}
 Move-Item -LiteralPath $fromP228 -Destination $toP228
}
$settledP230=Get-Content -Raw -LiteralPath (Join-Path $runP228 'evidence/native-host-settled.json') | ConvertFrom-Json -AsHashtable -DateKind String
Write-OwnedLaunchFact (Join-Path $evidenceP228 'owned-native-pile-archive.json') @{observedAtUtc=[DateTime]::UtcNow.ToString('o');targetBirthUtc=$birthP228.ToString('o');files=$filesP228;nativeTerminal=$settledP230.terminal;qualification='Exact owned Host/Native terminal state and bounded single-file birth/path checks verified. Caller UI/checker joins require their original receipts and are not inferred by this helper. Native outcome retained, not converted into exit0.'}
