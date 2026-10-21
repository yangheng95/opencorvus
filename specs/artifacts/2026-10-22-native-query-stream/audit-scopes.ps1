$ErrorActionPreference='Stop'
$taskRepo='D:/myhexin-local/opencorvus'
$taskScratch="$taskRepo/.tmp-product-iteration/native-query-stream-522"
. "$taskRepo/.tmp-product-iteration/live-sol-long-source-reading-406-launch.ps1" -FunctionsOnly
$taskRuns=@(
 @{name='buffered-control';exit=1;toolChunk='e6a233';qualification='Invalid first comparator: observer omitted; retained fixture error'},
 @{name='buffered-control-callback';exit=1;toolChunk='59f8f3';qualification='Valid old buffered comparator: same supplied observer; target ACK deadline exit23'},
 @{name='contracts-a';exit=0;toolChunk='3f333f';qualification='Ten positive contracts; twelve scope plus one ordinary query'},
 @{name='lifecycle-a';exit=0;toolChunk='ca2d0b';qualification='One positive owned owner-death contract; two scope queries'}
)
$taskFacts=@()
foreach($taskRun in $taskRuns){
 $taskRoot="$taskScratch/$($taskRun.name)-scope"
 $taskDiag="$taskRoot/evidence"
 $taskReady=Get-Content -LiteralPath "$taskDiag/native-host-ready.json" -Raw|ConvertFrom-Json
 $taskSettled=Get-Content -LiteralPath "$taskDiag/native-host-settled.json" -Raw|ConvertFrom-Json
 $taskExit=Get-Content -LiteralPath "$taskDiag/launcher-child-exit.json" -Raw|ConvertFrom-Json
 if($taskReady.occurrence -cne $taskSettled.occurrence -or $taskSettled.outcome -cne 'settled' -or !$taskSettled.physicalCompletion -or !$taskSettled.outputDrainComplete -or !$taskSettled.requestCleanupComplete){throw 'Exact original outer settlement incomplete'}
 if($taskExit.originalChildExit -ne $taskRun.exit -or $taskSettled.terminal.exitCode -ne $taskRun.exit){throw 'Original tool/launcher/native exit mismatch'}
 foreach($taskKey in @('host','target')){
  if($taskReady.$taskKey.pid -ne $taskSettled.$taskKey.pid -or $taskReady.$taskKey.processInstanceID -cne $taskSettled.$taskKey.processInstanceID){throw 'Original outer identity mismatch'}
 }
 $taskHostState=Get-OwnedNativeState $taskReady.host
 $taskTargetState=Get-OwnedNativeState $taskReady.target
 if($taskHostState -cne 'dead_or_reused' -or $taskTargetState -cne 'dead_or_reused'){throw 'Original exact outer process still live or unknown'}
 $taskFiles=@(Get-ChildItem -LiteralPath "$taskRoot/runtime" -File -Recurse | ForEach-Object {@{path=$_.FullName.Substring($taskRoot.Length+1);bytes=$_.Length}})
 $taskFacts+=@{run=$taskRun.name;qualification=$taskRun.qualification;originalToolChunk=$taskRun.toolChunk;originalToolExit=$taskRun.exit;ready=$taskReady;settled=$taskSettled;launcher=$taskExit;hostState=$taskHostState;targetState=$taskTargetState;retainedRuntimeFiles=$taskFiles}
}
$taskResult=@{observedAtUtc=[DateTime]::UtcNow.ToString('o');modelRequests=0;modelAuthority='No auth/catalog copied; pure owned process fixtures and source call graph; no RealProviderAudit/network instrumentation installed';attemptedProcessQueries=17;fixedBudget=31;unusedRetiredQueries=14;scopes=$taskFacts;build=@{originalSession=21227;exitCode=0;seconds=18.68;scope='Private locked offline release target only'};boundary='All original exec calls terminal, all four original outer native/output/request/launcher completions and exact host/target dead; private owner-death output recipient unavailable, physical fixture cleanup only'}
$taskResult|ConvertTo-Json -Depth 18|Set-Content -LiteralPath "$taskScratch/physical-summary.json"
@{scopes=$taskFacts.Count;attempted=17;unusedRetired=14;exactDeadObservations=8}|ConvertTo-Json -Compress
