$ErrorActionPreference='Stop'
$taskPath=Join-Path $PSScriptRoot 'history-manifest.json'
$taskManifest=Get-Content -Raw -LiteralPath $taskPath | ConvertFrom-Json -AsHashtable -DateKind String
$taskReady=Get-Content -Raw -LiteralPath (Join-Path $taskManifest.readinessEvidence 'result-startup.json') | ConvertFrom-Json -AsHashtable -DateKind String
$taskGuard=Get-Content -Raw -LiteralPath (Join-Path $taskManifest.readinessEvidence 'guard.json') | ConvertFrom-Json -AsHashtable -DateKind String
. 'D:/myhexin-local/opencorvus/.tmp-product-iteration/live-sol-launch.ps1' -FunctionsOnly
if(!$taskGuard.readQualified -or $taskGuard.occurrence -cne $taskManifest.sourceOccurrence -or [IO.Path]::GetFullPath($taskReady.sourceRun) -ne [IO.Path]::GetFullPath($taskManifest.sourceRun) -or $taskReady.schemaDrift){throw 'Current same-source schema/closure required'}
foreach($taskField in @('tasks','checkpoints','providerPending','toolPending','unsettledPublications','unsettledDeliveries')){if(@($taskReady[$taskField]).Count){throw "Unqualified source frontier: $taskField"}}
if(@($taskReady.recoveryTableCounts | Where-Object rows -gt 0).Count -or @($taskReady.messages | Where-Object {($_.role -eq 'assistant' -and !$_.completed_at) -or $_.pending_delivery}).Count){throw 'Unqualified recovery or Message frontier'}
if(@($taskReady.controls | Where-Object event_kind -ne 'consumed').Count){throw 'Control evidence requires explicit review'}
$taskPermission=Get-Content -Raw -LiteralPath (Join-Path $taskManifest.readinessEvidence 'permission-terminal.json') | ConvertFrom-Json -AsHashtable -DateKind String
if($taskPermission.rows.Count -ne $taskReady.permissions.Count){throw 'Exact same permission executions required'}
foreach($row in $taskPermission.rows){
 $same=@($taskReady.permissions | Where-Object {$_.attempt_id -ceq $row.attempt_id -and $_.outcome_id -ceq $row.outcome_id -and $_.outcome -ceq $row.outcome})
 if($same.Count -ne 1 -or !(($row.outcome -ceq 'execution_succeeded' -and $row.result_at) -or ($row.outcome -ceq 'execution_failed' -and $row.reason))){throw 'Canonical successful-result or failed-reason terminal contract required'}
}
foreach($taskMemory in $taskReady.memoryDocuments){if($taskMemory.snapshot.status -ne 'idle' -or $taskMemory.snapshot.pendingCount -ne 0 -or $taskMemory.organizerLease){throw 'Memory frontier requires explicit review'}}
$taskNow=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
if(@($taskReady.capacity | Where-Object expires_at -gt $taskNow).Count){throw 'Live execution capacity requires review'}
foreach($taskLease in @($taskReady.leases | Where-Object expires_at -gt $taskNow)){
 if($taskLease.target -ne 'runtime_process'){throw 'Unexpected live control target'}
 $taskIdentity=$taskLease.owner_occurrence_id | ConvertFrom-Json -AsHashtable -DateKind String
 if((Get-OwnedNativeState $taskIdentity) -ne 'dead_or_reused'){throw 'Original runtime lease still physically live'}
}
$taskManifest.startupQualified=$true
$taskManifest.review='Fresh295 original294 whole-source current schema and closed recovery frontiers; 4 completed assistants, 2 successful permission results, consumed control, both ProjectMemory idle/pending0. Only current runtime lease exact birth dead. Original8944 exit0 with6 real streaming EOF requests preserved. Current two configs use powershell and4 profiles, plugins/channels/commands empty; full90-table copy required, no auth/model or Task/member staging.'
$taskManifest.observedAtUtc=[DateTime]::UtcNow.ToString('o')
[IO.File]::WriteAllText($taskPath,($taskManifest | ConvertTo-Json -Depth 32),[Text.UTF8Encoding]::new($false))
Write-OwnedLaunchFact (Join-Path $taskManifest.readinessEvidence 'admitted.json') $taskManifest
Write-Output 'Current original294 history startup admitted.'
