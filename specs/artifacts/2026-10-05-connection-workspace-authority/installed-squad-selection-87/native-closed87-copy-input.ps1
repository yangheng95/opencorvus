param([string]$CaseRun,[string]$CaseEvidence,[string]$CaseLabel,[int]$CasePort,[string]$CasePurpose)
$ErrorActionPreference='Stop'
$copyRun=[IO.Path]::GetFullPath($CaseRun);$copyEvidence=[IO.Path]::GetFullPath($CaseEvidence);$copyLabel=$CaseLabel;$copyPort=$CasePort;$copyPurpose=$CasePurpose
$sourceRun='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-07/installed-selection-before-87'
if(Test-Path -LiteralPath $copyRun){throw 'Preserve existing copy occurrence'}
if(@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -eq $copyPort).Count){throw 'Fresh port occupied'}
. (Join-Path $PSScriptRoot 'live-sol-launch.ps1') -FunctionsOnly
$sourceOwner=Get-Content -Raw -LiteralPath (Join-Path $sourceRun 'launch-owner.json')|ConvertFrom-Json -AsHashtable -DateKind String
$states=@(@{expected=$sourceOwner.host;state=(Get-OwnedNativeState $sourceOwner.host)},@{expected=$sourceOwner.nativeTarget;state=(Get-OwnedNativeState $sourceOwner.nativeTarget)})
if(@($states|Where-Object state -ne 'dead_or_reused').Count){throw 'Source87 exact native identity is live'}
foreach($name in @('auth.json','models.json')){if(Test-Path -LiteralPath (Join-Path $sourceRun ('runtime/data/'+$name))){throw 'Source pair not absent'}}
[IO.Directory]::CreateDirectory($copyRun)|Out-Null
[IO.Directory]::CreateDirectory($copyEvidence)|Out-Null
Copy-Item -LiteralPath (Join-Path $sourceRun 'runtime') -Destination (Join-Path $copyRun 'runtime') -Recurse -ErrorAction Stop
foreach($name in @('auth.json','models.json')){if(Test-Path -LiteralPath (Join-Path $copyRun ('runtime/data/'+$name))){throw 'Copied pair must be absent'}}
Write-OwnedLaunchFact (Join-Path $copyEvidence ($copyLabel+'-history-copy.json')) @{observedAtUtc=[DateTime]::UtcNow.ToString('o');source=$sourceRun;clone=$copyRun;project=$sourceOwner.project;sourceNativeStates=$states;port=$copyPort;credentialStaging='None; source87 closed native inventory retained; no Task requested';taskID=$null;producerSessionID=$null;purpose=$copyPurpose}
Write-Output ($copyLabel+' fresh CLOSED87 copy prepared; pair absent.')
