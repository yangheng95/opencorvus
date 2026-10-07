$ErrorActionPreference='Stop'
$legacySource68='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-06/live-sol-edit-03'
$freshRun68='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-07/review-source-scope-before-68'
$freshEvidence68='D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/review-focus-scope'
$sourceProbe68=Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'review-scope-62-03-physical-readonly.json')|ConvertFrom-Json -AsHashtable -DateKind String
if(Test-Path -LiteralPath $freshRun68){throw 'Preserve existing68 occurrence'}
if(@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -eq 18026).Count){throw 'Fresh68 port occupied'}
if(@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -eq 17956).Count){throw 'Original03 source port live'}
. (Join-Path $PSScriptRoot 'live-sol-launch.ps1') -FunctionsOnly
$sourceStates68=@($sourceProbe68.knownOwnedChain|ForEach-Object {$expected68=@{pid=$_.pid;processInstanceID=('win32:'+([string]([DateTimeOffset]::Parse($_.expectedBirthUtc).UtcDateTime.Ticks)))};@{expected=$expected68;state=(Get-OwnedNativeState $expected68)}})
if(@($sourceStates68|Where-Object state -ne 'dead_or_reused').Count){throw 'Exact known source03 root/conhost not retired'}
foreach($name68 in @('auth.json','models.json')){if(Test-Path -LiteralPath (Join-Path $legacySource68 ('runtime/data/'+$name68))){throw 'Source03 pair must be absent'}}
[IO.Directory]::CreateDirectory($freshRun68)|Out-Null
[IO.Directory]::CreateDirectory($freshEvidence68)|Out-Null
Copy-Item -LiteralPath (Join-Path $legacySource68 'runtime') -Destination (Join-Path $freshRun68 'runtime') -Recurse -ErrorAction Stop
foreach($name68 in @('auth.json','models.json')){if(Test-Path -LiteralPath (Join-Path $freshRun68 ('runtime/data/'+$name68))){throw 'Copied68 pair must be absent'}}
Write-OwnedLaunchFact (Join-Path $freshEvidence68 'before-68-history-copy.json') @{observedAtUtc=[DateTime]::UtcNow.ToString('o');source=$legacySource68;clone=$freshRun68;project=(Join-Path $legacySource68 'project');sourceKnownStates=$sourceStates68;sourceParentBoundary=$sourceProbe68.unownedParent;port=18026;credentialStaging='None; one actual03 database copied, no source mutation/stitched history/new model call';projectID='prj_hA9BhfYfLEA7IQzO8QHf';sessionA='ses_-zUSn3IzNzzdZ2AxFWCU';sessionB='ses_-zUSn0xc3zzFGmP12qJE';purpose='Actual source62 ordinary file/text/file filter retirement baseline'}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'review-scope-62-03-physical-readonly.json') -Destination (Join-Path $freshEvidence68 'source-03-physical-readonly.json') -ErrorAction Stop
Write-Output 'Exact known source03 root/conhost retired; one fresh68 historical runtime ready; no authority pair.'
