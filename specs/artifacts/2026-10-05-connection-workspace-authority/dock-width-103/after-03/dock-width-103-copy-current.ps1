$ErrorActionPreference='Stop'
$copy103Source='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-07/dock-width-before-103-02'
$copy103Run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-07/dock-width-after-103-03'
$copy103Evidence='D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/dock-width-103/after-03'
$copy103Facts=Get-Content -Raw -LiteralPath 'D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/dock-width-103/before-02/root-task-lifecycle-facts.json'|ConvertFrom-Json -AsHashtable -DateKind String
$copy103Owner=Get-Content -Raw -LiteralPath (Join-Path $copy103Source 'launch-owner.json')|ConvertFrom-Json -AsHashtable -DateKind String
if(Test-Path -LiteralPath $copy103Run){throw 'Preserve existing103 history destination'}
if(@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -eq 18056).Count){throw 'Current103 history port occupied'}
. (Join-Path $PSScriptRoot 'live-sol-launch.ps1') -FunctionsOnly
$copy103States=@(@{expected=$copy103Owner.host;state=(Get-OwnedNativeState $copy103Owner.host)},@{expected=$copy103Owner.nativeTarget;state=(Get-OwnedNativeState $copy103Owner.nativeTarget)})
if(@($copy103States|Where-Object state -ne 'dead_or_reused').Count){throw 'Original103 native identity remains live'}
$copy103Settlement=Get-OwnedNativeSettlement $copy103Owner
if(!$copy103Settlement){throw 'Original103 native settlement missing'}
if($copy103Facts.task.id -ne 'tsk_g00VXN4oUA00rn0BZH4H' -or $copy103Facts.task.project_id -ne 'prj_h0J2tt3Nzvyc9sYXnBgd' -or $copy103Facts.task.request_id -ne 'f125d744-daae-4f54-b927-93cc71d59a1a' -or @($copy103Facts.promptOwners).Count -or @($copy103Facts.waits).Count){throw 'Actual103 source facts mismatch'}
$copy103Boundary=@($copy103Facts.events|Where-Object type -in @('task.execution.opened','task.execution.reopened','task.completed','task.failed','task.cancelled')|Sort-Object seq)
$copy103Last=$copy103Boundary[-1]
$copy103Payload=$copy103Last.payload|ConvertFrom-Json -AsHashtable -DateKind String
if($copy103Last.type -ne 'task.failed' -or $copy103Payload.execution_epoch -ne 1 -or $copy103Last.emitted_at -ne 1791380931955){throw 'Actual103 failed epoch identity missing'}
foreach($copy103Name in @('auth.json','models.json')){if(Test-Path -LiteralPath (Join-Path $copy103Source ('runtime/data/'+$copy103Name))){throw 'Original103 pair remains'}}
[IO.Directory]::CreateDirectory($copy103Run)|Out-Null
[IO.Directory]::CreateDirectory($copy103Evidence)|Out-Null
Copy-Item -LiteralPath (Join-Path $copy103Source 'runtime') -Destination (Join-Path $copy103Run 'runtime') -Recurse
foreach($copy103Name in @('auth.json','models.json')){if(Test-Path -LiteralPath (Join-Path $copy103Run ('runtime/data/'+$copy103Name))){throw 'Copied103 pair must remain absent'}}
Write-OwnedLaunchFact (Join-Path $copy103Evidence 'current-history-copy.json') @{observedAtUtc=[DateTime]::UtcNow.ToString('o');source=$copy103Source;clone=$copy103Run;project=$copy103Owner.project;sourceNativeStates=$copy103States;sourceNativeSettlement=$copy103Settlement;taskID=$copy103Facts.task.id;projectID=$copy103Facts.task.project_id;requestID=$copy103Facts.task.request_id;terminal=$copy103Last;credentialStaging='None; original failed epoch kept; no SQL edits or Task rearm';port=18056}
Write-Output 'Current103 failed-history copy bound to actual native/Task terminal facts; pair absent.'
