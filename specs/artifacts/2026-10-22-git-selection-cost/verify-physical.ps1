$ErrorActionPreference='Stop'
$taskRoot='D:/myhexin-local/opencorvus/.tmp-product-iteration/git-selection-cost-519'
. 'D:/myhexin-local/opencorvus/.tmp-product-iteration/live-sol-long-source-reading-406-launch.ps1' -FunctionsOnly
$taskRuns=@(@('resolve-a','chunk:c436dc'),@('ordinary-a','session:3692'),@('selected-a','session:58243'),@('selected-b','session:25480'),@('ordinary-b','session:77130'),@('resolve-b','chunk:2b5fec'))
$taskRecords=@()
foreach($taskPair in $taskRuns){
 $taskName=$taskPair[0];$taskEvidence="$taskRoot/$taskName-scope/evidence"
 $taskReady=Get-Content -Raw -LiteralPath "$taskEvidence/native-host-ready.json"|ConvertFrom-Json
 $taskSettled=Get-Content -Raw -LiteralPath "$taskEvidence/native-host-settled.json"|ConvertFrom-Json
 $taskLauncher=Get-Content -Raw -LiteralPath "$taskEvidence/launcher-child-exit.json"|ConvertFrom-Json
 if($taskSettled.outcome -ne 'settled' -or $taskSettled.terminal.reason -ne 'exited' -or $taskSettled.terminal.exitCode -ne 0 -or !$taskSettled.physicalCompletion -or !$taskSettled.outputDrainComplete -or !$taskSettled.requestCleanupComplete -or $taskLauncher.originalChildExit -ne 0 -or $taskSettled.occurrence -cne $taskReady.occurrence){throw "Incomplete original scope $taskName"}
 $taskChain=@($taskReady.host,$taskReady.target)|ForEach-Object {@{identity=$_;state=(Get-OwnedNativeState $_)}}
 if(@($taskChain|Where-Object state -ne 'dead_or_reused').Count){throw "Original scope remains live: $taskName"}
 $taskRecords+=@{run=$taskName;originalToolHandle=$taskPair[1];originalExit=0;ready=$taskReady;native=$taskSettled;launcher=$taskLauncher;chain=$taskChain}
}
$taskResult=@{observedAtUtc=[DateTime]::UtcNow.ToString('o');scopes=$taskRecords;count=$taskRecords.Count;boundary='Six original native/output/request/launcher settlements,each original exit0,all exact physical births dead_or_reused;no restarts or model requests'}|ConvertTo-Json -Depth 15
if(Test-Path -LiteralPath "$taskRoot/physical-scopes.json"){throw 'Original physical evidence already present'}
[IO.File]::WriteAllText("$taskRoot/physical-scopes.json",$taskResult)
Write-Output 'Six original scopes physically settled;all original exit0'
