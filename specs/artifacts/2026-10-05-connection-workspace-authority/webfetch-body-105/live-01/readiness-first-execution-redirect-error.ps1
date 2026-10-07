param(
 [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$RunRoot,
 [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$EvidenceRoot,
 [Parameter(Mandatory=$true)][ValidateRange(1,65535)][int]$ExpectedPort,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9-]+$')][string]$ExpectedPrefix,
 [Parameter(Mandatory=$true)][ValidatePattern('^/ui/assets/[A-Za-z0-9._-]+\.js$')][string]$ExpectedAsset
)
$ErrorActionPreference='Stop'
if(![IO.Path]::IsPathFullyQualified($RunRoot) -or ![IO.Path]::IsPathFullyQualified($EvidenceRoot)){throw 'Absolute owned run/evidence paths required'}
$runPath=[IO.Path]::GetFullPath($RunRoot)
$evidencePath=[IO.Path]::GetFullPath($EvidenceRoot)
$owner=Get-Content -Raw -LiteralPath (Join-Path $runPath 'launch-owner.json') | ConvertFrom-Json
if($owner.port -ne $ExpectedPort -or $owner.evidencePrefix -cne $ExpectedPrefix -or [IO.Path]::GetFullPath($owner.runRoot) -ne $runPath -or [IO.Path]::GetFullPath($owner.settlementEvidenceRoot) -ne $evidencePath){throw 'Exact admitted run scope required'}
$startup=Get-Content -Raw -LiteralPath (Join-Path $runPath 'startup.json') | ConvertFrom-Json
if($startup.outcome -ne 'listening' -or $startup.occurrenceID -ne $owner.occurrence -or $startup.pid -ne $owner.nativeTarget.pid){throw 'Actual startup is not listening for this occurrence'}
. (Join-Path $PSScriptRoot 'live-sol-launch.ps1') -FunctionsOnly
if((Get-OwnedNativeState $owner.host) -ne 'exact_live' -or (Get-OwnedNativeState $owner.nativeTarget) -ne 'exact_live'){throw 'Exact native Host/Target birth required'}
$listeners=@(Get-NetTCPConnection -ErrorAction Stop | Where-Object {$_.State -eq 'Listen' -and $_.LocalPort -eq $ExpectedPort} | Select-Object LocalAddress,LocalPort,OwningProcess)
if($listeners.Count -ne 1 -or $listeners[0].OwningProcess -ne $owner.nativeTarget.pid){throw 'Actual listener owner mismatch'}
$uiUri=[Uri]::new('http://127.0.0.1:'+$ExpectedPort+'/ui')
$ui=Invoke-WebRequest -Uri $uiUri -TimeoutSec 10
if($ui.StatusCode -ne 200){throw 'Actual UI HTML status mismatch'}
$scripts=@([regex]::Matches($ui.Content,'<script\b[^>]*\bsrc\s*=\s*["''](?<src>[^"'']+)["''][^>]*>',[Text.RegularExpressions.RegexOptions]::IgnoreCase))
$assets=@($scripts | ForEach-Object {[Uri]::new($uiUri,$_.Groups['src'].Value)} | Where-Object {$_.AbsolutePath -ceq $ExpectedAsset})
if($assets.Count -ne 1 -or $assets[0].Scheme -cne $uiUri.Scheme -or $assets[0].Authority -cne $uiUri.Authority -or $assets[0].Query -ne '' -or $assets[0].Fragment -ne ''){throw 'Actual HTML scriptSrc does not bind the exact admitted asset'}
$asset=Invoke-WebRequest -Uri $assets[0] -TimeoutSec 10
if($asset.StatusCode -ne 200){throw 'Actual UI asset GET status mismatch'}
Write-OwnedLaunchFact (Join-Path $evidencePath 'actual-http-readiness.json') @{observedAtUtc=[DateTime]::UtcNow.ToString('o');owner=$owner;startup=$startup;listeners=$listeners;uiUri=$uiUri.AbsoluteUri;uiStatus=$ui.StatusCode;scriptSrc=$assets[0].AbsoluteUri;asset=$ExpectedAsset;assetStatus=$asset.StatusCode;boundary='HTTP/native asset admission only; no UI or visual assertion'}
Write-Output ('Actual HTTP '+$ui.StatusCode+'; asset '+$asset.StatusCode+' '+$ExpectedAsset+'; target '+$owner.nativeTarget.pid)
