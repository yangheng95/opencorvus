$ErrorActionPreference='Stop'
$taskPath=Join-Path $PSScriptRoot 'after-manifest.json'
$taskManifest=Get-Content -Raw -LiteralPath $taskPath | ConvertFrom-Json -AsHashtable -DateKind String
$taskReady=Get-Content -Raw -LiteralPath (Join-Path $taskManifest.readinessEvidence 'result-startup.json') | ConvertFrom-Json -AsHashtable -DateKind String
$taskGuard=Get-Content -Raw -LiteralPath (Join-Path $taskManifest.readinessEvidence 'guard.json') | ConvertFrom-Json -AsHashtable -DateKind String
. 'D:/myhexin-local/opencorvus/.tmp-product-iteration/live-sol-launch.ps1' -FunctionsOnly
if(!$taskGuard.readQualified -or $taskGuard.occurrence -cne $taskManifest.sourceOccurrence -or [IO.Path]::GetFullPath($taskReady.sourceRun) -ne [IO.Path]::GetFullPath($taskManifest.sourceRun) -or $taskReady.schemaDrift){throw 'Current same-source schema/closure required'}
foreach($taskField in @('tasks','checkpoints','providerPending','toolPending','unsettledPublications','unsettledDeliveries')){if(@($taskReady[$taskField]).Count){throw "Unqualified source frontier: $taskField"}}
if(@($taskReady.recoveryTableCounts | Where-Object rows -gt 0).Count -or @($taskReady.messages | Where-Object {($_.role -eq 'assistant' -and !$_.completed_at) -or $_.pending_delivery}).Count){throw 'Unqualified recovery or Message frontier'}
if(@($taskReady.controls | Where-Object event_kind -ne 'consumed').Count -or @($taskReady.permissions | Where-Object {!$_.outcome_id -or !$_.result_at}).Count){throw 'Control/permission evidence requires explicit review'}
foreach($taskMemory in $taskReady.memoryDocuments){if($taskMemory.snapshot.status -ne 'idle' -or $taskMemory.snapshot.pendingCount -ne 0 -or $taskMemory.organizerLease){throw 'Memory frontier requires explicit review'}}
$taskNow=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
if(@($taskReady.capacity | Where-Object expires_at -gt $taskNow).Count){throw 'Live execution capacity requires review'}
foreach($taskLease in @($taskReady.leases | Where-Object expires_at -gt $taskNow)){
 if($taskLease.target -ne 'runtime_process'){throw 'Unexpected live control target'}
 $taskIdentity=$taskLease.owner_occurrence_id | ConvertFrom-Json -AsHashtable -DateKind String
 if((Get-OwnedNativeState $taskIdentity) -ne 'dead_or_reused'){throw 'Original runtime lease still physically live'}
}
$taskManifest.startupQualified=$true
$taskManifest.review='Fresh291 original238 complete current schema/closed frontiers; ordinary Main and Side Sessions, no Task/Mission/dispatch; 8 completed assistants including copied Side history, 2 completed permission executions, consumed control; both ProjectMemory idle/pending0, only unexpired runtime lease exact birth dead. Root reviewed both config and full table inventories. Credentialless full90-table copy still required.'
$taskManifest.observedAtUtc=[DateTime]::UtcNow.ToString('o')
[IO.File]::WriteAllText($taskPath,($taskManifest | ConvertTo-Json -Depth 32),[Text.UTF8Encoding]::new($false))
Write-OwnedLaunchFact (Join-Path $taskManifest.readinessEvidence 'admitted.json') $taskManifest
Write-Output 'Current original238 history startup admitted.'
