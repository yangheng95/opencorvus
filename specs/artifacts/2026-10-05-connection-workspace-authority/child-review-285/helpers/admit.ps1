$ErrorActionPreference='Stop'
$taskRepo='D:/myhexin-local/opencorvus'
$taskOut=Join-Path $taskRepo 'specs/artifacts/2026-10-05-connection-workspace-authority/child-review-285/history-readiness'
$taskA=Get-Content -Raw -LiteralPath (Join-Path $taskOut 'result-startup.json') | ConvertFrom-Json -AsHashtable -DateKind String
$taskB=Get-Content -Raw -LiteralPath (Join-Path $taskOut 'result-task-startup.json') | ConvertFrom-Json -AsHashtable -DateKind String
$taskC=Get-Content -Raw -LiteralPath (Join-Path $taskOut 'result-frontier.json') | ConvertFrom-Json -AsHashtable -DateKind String
$taskGuard=Get-Content -Raw -LiteralPath (Join-Path $taskOut 'guard.json') | ConvertFrom-Json -AsHashtable -DateKind String
. (Join-Path $taskRepo '.tmp-product-iteration/live-sol-launch.ps1') -FunctionsOnly
if(!$taskGuard.readQualified -or $taskA.schemaDrift -or $taskB.schemaDrift){throw 'Original current schema/physical admission failed'}
foreach($taskRead in @($taskA,$taskB)){foreach($taskField in @('providerPending','toolPending','unsettledPublications','unsettledDeliveries')){if(@($taskRead[$taskField]).Count){throw "Original $taskField requires investigation"}}}
if(@($taskB.lifecycle).Count -ne 1 -or $taskB.lifecycle[0].status -ne 'completed' -or $taskB.lifecycle[0].epoch -ne 1 -or @($taskB.dispatchCandidates).Count -or @($taskB.mission).Count){throw 'Original Task/recovery frontier not closed'}
$taskNow=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$taskCurrentLeases=@($taskA.leases | Where-Object expires_at -gt $taskNow)
$taskLeaseStates=@()
foreach($taskLease in $taskCurrentLeases){
 if($taskLease.target -ne 'runtime_process'){throw 'Unexpired non-runtime lease requires review'}
 $taskIdentity=$taskLease.owner_occurrence_id | ConvertFrom-Json -AsHashtable -DateKind String
 $taskState=Get-OwnedNativeState $taskIdentity
 if($taskState -ne 'dead_or_reused'){throw 'Original runtime is live'}
 $taskLeaseStates+=@{lease=$taskLease;expected=$taskIdentity;state=$taskState}
}
if(@($taskA.capacity | Where-Object expires_at -gt $taskNow).Count){throw 'Original capacity frontier is live'}
if(@($taskA.controls | Where-Object event_kind -ne 'consumed').Count -or @($taskA.permissions | Where-Object {!$_.outcome_id -or !$_.result_at}).Count -or @($taskA.checkpoints | Where-Object {!$_.outcome_request_id}).Count){throw 'Original execution facts not settled'}
if(@($taskA.messages | Where-Object {($_.role -eq 'assistant' -and !$_.completed_at) -or $_.pending_delivery}).Count){throw 'Original messages not settled'}
if(@($taskC.ingresses | Where-Object {$_.disposition.disposition -notin @('resolved','terminal_inapplicable')}).Count){throw 'Original ingress not settled'}
if(@($taskA.recoveryTableCounts | Where-Object rows -gt 0).Count){throw 'Original durable recovery candidates need review'}
foreach($taskMemory in $taskA.memoryDocuments){if($taskMemory.snapshot.status -ne 'idle' -or $taskMemory.snapshot.pendingCount -ne 0 -or $taskMemory.snapshot.droppedPendingCount -ne 0 -or ($taskMemory.organizerLease -and $taskMemory.organizerLease.expiresAt -gt $taskNow)){throw 'Original memory work remains'}}
foreach($taskProject in $taskB.projectObservations){
 $taskConfig=$taskProject.capability
 if($taskConfig.pluginCount -ne 0 -or @($taskConfig.channelKeys).Count -or @($taskConfig.commandKeys).Count -or $taskConfig.terminalWouldWrite -or @($taskProject.orphanTaskDirs).Count -or @($taskProject.cacheDirectories | Where-Object {$_.orphanChildren.Count}).Count){throw 'Original project configuration/lifecycle requires review'}
 if(@($taskConfig.mcpKeys | Where-Object {$_ -notin @('browser','computer')}).Count){throw 'Unreviewed extension configuration'}
}
$taskPath=Join-Path $taskRepo '.tmp-product-iteration/child-review-285/history-manifest.json'
$taskManifest=Get-Content -Raw -LiteralPath $taskPath | ConvertFrom-Json -AsHashtable -DateKind String
$taskManifest.startupQualified=$true
$taskManifest.observedAtUtc=[DateTime]::UtcNow.ToString('o')
$taskManifest.review='Fresh285 whole-source observations: schema current; Task completed epoch1 and dispatch/recovery frontiers closed; assistants15 complete; permissions8 outcomes and checkpoints2 settled; three ingresses resolved/terminal inapplicable; both ProjectMemory snapshots idle pending0; original runtime lease exact birth dead. Original parent30224 joined0/raw8807157 retained. No auth/model/Task/member staging; full copy and root visual observation still required.'
[IO.File]::WriteAllText($taskPath,($taskManifest | ConvertTo-Json -Depth 12)+"`n",[Text.UTF8Encoding]::new($false))
Write-OwnedLaunchFact (Join-Path $taskOut 'admitted.json') @{observedAtUtc=$taskManifest.observedAtUtc;startupQualified=$true;sourceRun=$taskManifest.sourceRun;sourceOccurrence=$taskManifest.sourceOccurrence;runtimeLeaseStates=$taskLeaseStates;selectedSubject=$taskManifest.selectedSubject;review=$taskManifest.review}
Write-Output 'Current whole source admitted for credentialless complete history copy.'
