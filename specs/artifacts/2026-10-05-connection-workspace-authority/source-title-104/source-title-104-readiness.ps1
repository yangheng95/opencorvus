param(
 [Parameter(Mandatory=$true)][string]$RunRoot,
 [Parameter(Mandatory=$true)][string]$EvidenceRoot
)
$ErrorActionPreference='Stop'
$sourceRun104=[IO.Path]::GetFullPath($RunRoot)
$sourceEvidence104=[IO.Path]::GetFullPath($EvidenceRoot)
$sourceOwner104=Get-Content -Raw -LiteralPath "$sourceRun104/launch-owner.json" | ConvertFrom-Json
if($sourceOwner104.port -ne 18061 -or $sourceOwner104.evidencePrefix -ne 'source-title-104-01' -or [IO.Path]::GetFullPath($sourceOwner104.runRoot) -ne $sourceRun104 -or [IO.Path]::GetFullPath($sourceOwner104.settlementEvidenceRoot) -ne $sourceEvidence104){throw 'Exact104 scope required'}
$sourceStartup104=Get-Content -Raw -LiteralPath "$sourceRun104/startup.json" | ConvertFrom-Json
if($sourceStartup104.outcome -ne 'listening' -or $sourceStartup104.occurrenceID -ne $sourceOwner104.occurrence -or $sourceStartup104.pid -ne $sourceOwner104.nativeTarget.pid){throw 'Actual104 startup is not listening'}
. (Join-Path $PSScriptRoot 'live-sol-launch.ps1') -FunctionsOnly
if((Get-OwnedNativeState $sourceOwner104.host) -ne 'exact_live' -or (Get-OwnedNativeState $sourceOwner104.nativeTarget) -ne 'exact_live'){throw 'Exact native104 owners required'}
$sourceListeners104=@(Get-NetTCPConnection -ErrorAction Stop | Where-Object {$_.State -eq 'Listen' -and $_.LocalPort -eq $sourceOwner104.port} | Select-Object LocalAddress,LocalPort,OwningProcess)
if($sourceListeners104.Count -ne 1 -or $sourceListeners104[0].OwningProcess -ne $sourceOwner104.nativeTarget.pid){throw 'Actual104 listener owner mismatch'}
$sourceHTTP104=Invoke-WebRequest -Uri ('http://127.0.0.1:'+$sourceOwner104.port+'/ui') -TimeoutSec 10
$sourceAsset104=[regex]::Match($sourceHTTP104.Content,'/assets/main-[A-Za-z0-9_-]+\.js').Value
if($sourceHTTP104.StatusCode -ne 200 -or $sourceAsset104 -ne '/assets/main-C9tW15xL.js'){throw 'Actual103 current UI asset/readiness mismatch'}
Write-OwnedLaunchFact "$sourceEvidence104/actual-http-readiness.json" @{observedAtUtc=[DateTime]::UtcNow.ToString('o');owner=$sourceOwner104;startup=$sourceStartup104;listeners=$sourceListeners104;uiStatus=$sourceHTTP104.StatusCode;asset=$sourceAsset104;boundary='HTTP/native asset admission only; no UI or visual assertion'}
Write-Output ('Actual104 HTTP '+$sourceHTTP104.StatusCode+'; '+$sourceAsset104+'; target '+$sourceOwner104.nativeTarget.pid)
