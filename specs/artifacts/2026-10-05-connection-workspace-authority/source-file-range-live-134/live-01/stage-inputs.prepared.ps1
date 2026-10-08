[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$RunRoot,
 [Parameter(Mandatory=$true)][string]$EvidenceRoot,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9-]+$')][string]$ExpectedPrefix,
 [Parameter(Mandatory=$true)][ValidateRange(1,65535)][int]$ExpectedPort,
 [Parameter(Mandatory=$true)][ValidateRange(1,99999)][int]$EvidenceCase
)
$ErrorActionPreference='Stop'
$inputRunRoot=[IO.Path]::GetFullPath($RunRoot)
$inputEvidenceRoot=[IO.Path]::GetFullPath($EvidenceRoot)
$ownedRoot=[IO.Path]::GetFullPath('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-08')
$formalRoot=[IO.Path]::GetFullPath('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority')
if(!$inputRunRoot.StartsWith($ownedRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or !$inputEvidenceRoot.StartsWith($formalRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($inputRunRoot) -ne $ExpectedPrefix){throw 'Exact admitted owned run/evidence/prefix required'}
$owner=Get-Content -Raw -LiteralPath "$inputRunRoot/launch-owner.json" | ConvertFrom-Json
$preflight=Get-Content -Raw -LiteralPath "$inputRunRoot/evidence/preflight-ready.json" | ConvertFrom-Json
$project=[IO.Path]::GetFullPath((Join-Path $inputRunRoot 'project'))
if( $owner.evidencePrefix -ne $ExpectedPrefix -or $owner.port -ne $ExpectedPort -or [IO.Path]::GetFullPath($owner.project) -ne $project -or [IO.Path]::GetFullPath($owner.runRoot) -ne $inputRunRoot -or [IO.Path]::GetFullPath($owner.settlementEvidenceRoot) -ne $inputEvidenceRoot){throw 'Exact current launch owner required'}
if($preflight.occurrence -ne $owner.occurrence -or $preflight.pid -ne $owner.nativeTarget.pid -or $preflight.owner.processInstanceID -ne $owner.nativeTarget.processInstanceID -or $preflight.preflight.credential -ne 'usable' -or $preflight.preflight.catalog -ne 'projected' -or $preflight.preflight.actualModel -ne 'gpt-6.1-sol' -or !$preflight.preflight.streaming){throw 'Exact current actual preflight required'}
if((Get-Item -LiteralPath $project).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Project root reparse point rejected'}
. (Join-Path $PSScriptRoot 'live-sol-launch.ps1') -FunctionsOnly
if((Get-OwnedNativeState $owner.host) -ne 'exact_live' -or (Get-OwnedNativeState $owner.nativeTarget) -ne 'exact_live'){throw 'Current exact native Host/Target required'}
$startup=Get-Content -Raw -LiteralPath "$inputRunRoot/startup.json" | ConvertFrom-Json
if($startup.outcome -ne 'listening' -or $startup.occurrenceID -ne $owner.occurrence -or $startup.pid -ne $owner.nativeTarget.pid){throw 'Current exact startup required'}
$listeners=@(Get-NetTCPConnection -ErrorAction Stop | Where-Object {$_.State -eq 'Listen' -and $_.LocalPort -eq $ExpectedPort})
if($listeners.Count -ne 1 -or $listeners[0].OwningProcess -ne $owner.nativeTarget.pid){throw 'Current exact listener required'}
$references=Join-Path $project 'references'
$references=[IO.Path]::GetFullPath($references)
if(!$references.StartsWith($project+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'References outside exact project'}
if(Test-Path -LiteralPath $references){throw 'Fresh references directory required'}
$repo='D:/myhexin-local/opencorvus'
$relative=@('README.md','specs/current/architecture/07-panel.md','packages/overlay/src/components/SourceParts.tsx')
$names=@('README.md','07-panel.md','SourceParts.tsx')
# Provenance only; no source checksum or functional gate.
$head=(& git -C $repo rev-parse HEAD)
if($LASTEXITCODE -ne 0){throw 'Source HEAD observation failed'}
$prepared=@()
for($i=0;$i -lt $relative.Count;$i++){
 $source=[IO.Path]::GetFullPath((Join-Path $repo $relative[$i]))
 if((Get-Item -LiteralPath $source).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Source reparse point rejected'}
 $diff=(& git -C $repo diff HEAD -- $relative[$i] | Out-String)
 if($LASTEXITCODE -ne 0){throw 'Exact source diff observation failed'}
 $prepared+=@{source=$source;name=$names[$i];bytes=[IO.File]::ReadAllBytes($source);diff=$diff}
}
[IO.Directory]::CreateDirectory($references)|Out-Null
$facts=@()
foreach($item in $prepared){
 $target=[IO.Path]::GetFullPath((Join-Path $references $item.name))
 if(!$target.StartsWith($references+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Target outside owned references'}
 $stream=[IO.File]::Open($target,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
 try{$stream.Write($item.bytes,0,$item.bytes.Length)}finally{$stream.Dispose()}
 $actual=[IO.File]::ReadAllBytes($target)
 $equal=$actual.Length -eq $item.bytes.Length
 for($j=0;$equal -and $j -lt $actual.Length;$j++){if($actual[$j] -ne $item.bytes[$j]){$equal=$false}}
 $facts+=@{originalPath=$item.source;targetPath=$target;originalLength=$item.bytes.Length;targetLength=$actual.Length;directByteEquality=$equal;sourceDiff=$item.diff}
 if(!$equal){throw 'Actual target byte equality failed'}
}
$fact=@{evidenceCase=$EvidenceCase;evidencePrefix=$ExpectedPrefix;port=$ExpectedPort;occurrence=$owner.occurrence;nativeTarget=$owner.nativeTarget;project=$project;sourceHead=$head;observedAt=[DateTime]::UtcNow.ToString('o');files=$facts}
$destination=Join-Path $inputEvidenceRoot 'actual-input-staging-provenance.json'
$stage=$destination+'.'+[Guid]::NewGuid().ToString()+'.stage'
[IO.File]::WriteAllText($stage,($fact|ConvertTo-Json -Depth 12),[Text.UTF8Encoding]::new($false))
[IO.File]::Move($stage,$destination)
$fact|ConvertTo-Json -Depth 12
