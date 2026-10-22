param([Parameter(Mandatory=$true)][ValidateSet('before','after')][string]$Stage)
$ErrorActionPreference='Stop'
$taskBase=[IO.Path]::GetFullPath('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22')
$taskRoot=[IO.Path]::GetFullPath((Join-Path $taskBase ('live-task-source-growth-537-'+$Stage)))
if([IO.Path]::GetDirectoryName($taskRoot) -cne $taskBase){throw 'Scope escaped owned QA root'}
$taskEvidence=Join-Path $taskRoot 'evidence'
$taskReady=Get-Content -Raw -LiteralPath "$taskEvidence/native-host-ready.json"|ConvertFrom-Json
$taskSettled=Get-Content -Raw -LiteralPath "$taskEvidence/native-host-settled.json"|ConvertFrom-Json
$taskLauncher=Get-Content -Raw -LiteralPath "$taskEvidence/launcher-child-exit.json"|ConvertFrom-Json
if($taskSettled.occurrence -cne $taskReady.occurrence -or !$taskSettled.physicalCompletion -or !$taskSettled.outputDrainComplete -or !$taskSettled.requestCleanupComplete){throw 'Original service physical/output/request/launcher settlement required'}
. 'D:/myhexin-local/opencorvus/.tmp-product-iteration/live-sol-long-source-reading-406-launch.ps1' -FunctionsOnly
$taskChain=@($taskReady.host,$taskReady.target)|ForEach-Object {@{identity=$_;state=(Get-OwnedNativeState $_)}}
if(@($taskChain|Where-Object state -ne 'dead_or_reused').Count){throw 'Original service occurrence remains live'}
$taskAuditFile=Get-ChildItem -LiteralPath $taskEvidence -File|Where-Object Name -Match '^provider-.*-[0-9]+\.json$'|Sort-Object {[int]($_.BaseName.Split('-')[-1])}|Select-Object -Last 1
$taskAudit=Get-Content -Raw -LiteralPath $taskAuditFile.FullName|ConvertFrom-Json
. "$PSScriptRoot/qualify-provider.ps1"
$taskPlan=Get-Content -Raw -LiteralPath "$PSScriptRoot/plan.json"|ConvertFrom-Json
$taskPreflight=Get-Content -Raw -LiteralPath "$taskEvidence/preflight-ready.json"|ConvertFrom-Json
$taskQualification=Get-GoalScopeProviderQualification $taskAudit $taskPlan $taskPreflight $taskSettled $taskLauncher
$taskMaximum=$taskQualification.maximum
$taskQualificationFailures=@($taskQualification.failures)
$taskAudit|ConvertTo-Json -Depth 30|Set-Content -LiteralPath "$taskEvidence/provider-final-redacted-private.json"
$taskData=[IO.Path]::GetFullPath((Join-Path $taskRoot 'runtime/data'))
foreach($taskDirectory in @($taskRoot,(Join-Path $taskRoot 'runtime'),$taskData)){if((Get-Item -LiteralPath $taskDirectory).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Authority ancestor is a reparse point'}}
$taskPair=@()
foreach($taskName in @('auth.json','models.json')){
 $taskFile=[IO.Path]::GetFullPath((Join-Path $taskData $taskName))
 if([IO.Path]::GetDirectoryName($taskFile) -cne $taskData){throw 'Pair member escaped exact owned data root'}
 if((Get-Item -LiteralPath $taskFile).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Pair member is a reparse point'}
 $taskInfo=Get-Item -LiteralPath $taskFile
 Remove-Item -LiteralPath $taskFile -ErrorAction Stop
 $taskPair+=@{name=$taskName;bytes=$taskInfo.Length;outcome='retired-after-original-physical-output-request-and-exact-birth-settlement'}
}
@{observedAtUtc=[DateTime]::UtcNow.ToString('o');occurrence=$taskReady.occurrence;native=$taskSettled;launcher=$taskLauncher;chain=$taskChain;maximumRequests=$taskMaximum;requests=$taskAudit.requests.Count;providerQualificationPassed=($taskQualificationFailures.Count -eq 0);qualificationFailures=$taskQualificationFailures;provider=$taskAudit.requests|ForEach-Object {@{model=$_.model;streaming=$_.streaming;status=$_.status;sourceReader=$_.response_reader}};copiedPair=$taskPair;pairedCleanupComplete=$true}|ConvertTo-Json -Depth 15|Set-Content -LiteralPath "$taskEvidence/physical-terminal-and-pair-cleanup.json"
Write-Output "Original $Stage service settled; $($taskAudit.requests.Count)/$taskMaximum actual requests;Provider qualification failures $($taskQualificationFailures.Count);complete runtime auth/models retired"
