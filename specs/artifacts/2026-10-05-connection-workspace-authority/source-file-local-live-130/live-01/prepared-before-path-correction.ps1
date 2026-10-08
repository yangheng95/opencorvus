[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$RunRoot,
 [Parameter(Mandatory=$true)][string]$EvidenceRoot
)
$ErrorActionPreference='Stop'
$expectedRun='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-08/source-file-local-live-130-01'
$expectedEvidence='D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/source-file-local-live-130/live01'
if([IO.Path]::GetFullPath($RunRoot) -ne [IO.Path]::GetFullPath($expectedRun) -or [IO.Path]::GetFullPath($EvidenceRoot) -ne [IO.Path]::GetFullPath($expectedEvidence)){throw 'Exact130 scope required'}
$owner=Get-Content -Raw -LiteralPath "$RunRoot/launch-owner.json" | ConvertFrom-Json
$preflight=Get-Content -Raw -LiteralPath "$RunRoot/evidence/preflight-ready.json" | ConvertFrom-Json
$project=[IO.Path]::GetFullPath((Join-Path $RunRoot 'project'))
if($owner.evidencePrefix -ne 'source-file-local-live-130-01' -or $owner.port -ne 18090 -or [IO.Path]::GetFullPath($owner.project) -ne $project -or [IO.Path]::GetFullPath($owner.runRoot) -ne [IO.Path]::GetFullPath($RunRoot)){throw 'Exact130 launch owner required'}
if($preflight.occurrence -ne $owner.occurrence -or $preflight.pid -ne $owner.nativeTarget.pid -or $preflight.owner.processInstanceID -ne $owner.nativeTarget.processInstanceID -or $preflight.preflight.credential -ne 'usable' -or $preflight.preflight.catalog -ne 'projected' -or $preflight.preflight.actualModel -ne 'gpt-6.1-sol' -or !$preflight.preflight.streaming){throw 'Exact130 actual preflight required'}
if((Get-Item -LiteralPath $project).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Project root reparse point rejected'}
$references=Join-Path $project 'references'
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
 $target=Join-Path $references $item.name
 $stream=[IO.File]::Open($target,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
 try{$stream.Write($item.bytes,0,$item.bytes.Length)}finally{$stream.Dispose()}
 $actual=[IO.File]::ReadAllBytes($target)
 $equal=$actual.Length -eq $item.bytes.Length
 for($j=0;$equal -and $j -lt $actual.Length;$j++){if($actual[$j] -ne $item.bytes[$j]){$equal=$false}}
 $facts+=@{originalPath=$item.source;targetPath=$target;originalLength=$item.bytes.Length;targetLength=$actual.Length;directByteEquality=$equal;sourceDiff=$item.diff}
 if(!$equal){throw 'Actual target byte equality failed'}
}
$fact=@{occurrence=$owner.occurrence;nativeTarget=$owner.nativeTarget;project=$project;sourceHead=$head;observedAt=[DateTime]::UtcNow.ToString('o');files=$facts}
$destination=Join-Path $EvidenceRoot 'actual-input-staging-provenance.json'
$stage=$destination+'.'+[Guid]::NewGuid().ToString()+'.stage'
[IO.File]::WriteAllText($stage,($fact|ConvertTo-Json -Depth 12),[Text.UTF8Encoding]::new($false))
[IO.File]::Move($stage,$destination)
$fact|ConvertTo-Json -Depth 12
