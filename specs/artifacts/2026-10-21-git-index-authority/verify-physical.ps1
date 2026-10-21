$ErrorActionPreference='Stop'
$taskScratch='D:/myhexin-local/opencorvus/.tmp-product-iteration/git-index-authority-495'
. 'D:/myhexin-local/opencorvus/.tmp-product-iteration/live-sol-long-source-reading-406-launch.ps1' -FunctionsOnly
$taskRows=@()
foreach($taskRun in @('before','after')){
 $taskRoot="$taskScratch/$taskRun-scope"
 $taskReady=Get-Content -Raw -LiteralPath "$taskRoot/evidence/native-host-ready.json"|ConvertFrom-Json
 $taskSettled=Get-Content -Raw -LiteralPath "$taskRoot/evidence/native-host-settled.json"|ConvertFrom-Json
 $taskLauncher=Get-Content -Raw -LiteralPath "$taskRoot/evidence/launcher-child-exit.json"|ConvertFrom-Json
 if($taskReady.occurrence -cne $taskSettled.occurrence -or !$taskSettled.physicalCompletion -or !$taskSettled.outputDrainComplete -or !$taskSettled.requestCleanupComplete -or $taskSettled.terminal.exitCode -ne 0 -or $taskLauncher.originalChildExit -ne 0){throw 'Original occurrence physical/output/request/launcher required'}
 $taskStates=@($taskReady.host,$taskReady.target)|ForEach-Object{@{identity=$_;state=(Get-OwnedNativeState $_)}}
 if(@($taskStates|Where-Object state -ne 'dead_or_reused').Count){throw 'Original occurrence still live'}
 $taskFiles=@(Get-ChildItem -LiteralPath "$taskRoot/runtime/data" -Recurse -File -ErrorAction SilentlyContinue|Select-Object -ExpandProperty FullName)
 $taskRows+=@{run=$taskRun;ready=$taskReady;native=$taskSettled;launcher=$taskLauncher;chain=$taskStates;runtimeDataFiles=$taskFiles;boundary='Exact original native host/target birth,not PID/name-only proof;no source initializer or model input'}
}
$taskRows|ConvertTo-Json -Depth 18|Set-Content -LiteralPath "$taskScratch/physical-scopes.json"
Write-Output 'Two original scopes physically terminal with output/request/launcher and exact dead/reused host/target birth;runtime data files recorded'
