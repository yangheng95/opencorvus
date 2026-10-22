param([Parameter(Mandatory=$true)][ValidateSet('before','after')][string]$Stage)
$ErrorActionPreference='Stop'
$taskBase=[IO.Path]::GetFullPath('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22')
$taskRoot=[IO.Path]::GetFullPath((Join-Path $taskBase ('goal-home-run-533-'+$Stage)))
if([IO.Path]::GetDirectoryName($taskRoot) -cne $taskBase){throw 'Scope escaped owned QA root'}
$taskEvidence=Join-Path $taskRoot 'evidence'
$taskReady=Get-Content -Raw -LiteralPath "$taskEvidence/native-host-ready.json"|ConvertFrom-Json
$taskSettled=Get-Content -Raw -LiteralPath "$taskEvidence/native-host-settled.json"|ConvertFrom-Json
$taskLauncher=Get-Content -Raw -LiteralPath "$taskEvidence/launcher-child-exit.json"|ConvertFrom-Json
$taskProof=Get-Content -Raw -LiteralPath "$taskEvidence/physical-terminal-and-pair-cleanup.json"|ConvertFrom-Json
$taskRetired=Get-Content -Raw -LiteralPath "$PSScriptRoot/$Stage-authority-retirement.json"|ConvertFrom-Json
if($taskProof.occurrence -cne $taskReady.occurrence -or $taskSettled.occurrence -cne $taskReady.occurrence -or !$taskSettled.physicalCompletion -or !$taskSettled.outputDrainComplete -or !$taskSettled.requestCleanupComplete -or !$taskProof.pairedCleanupComplete){throw 'Original complete settlement and actual cleanup receipt required'}
. 'D:/myhexin-local/opencorvus/.tmp-product-iteration/live-sol-long-source-reading-406-launch.ps1' -FunctionsOnly
foreach($taskIdentity in @($taskReady.host,$taskReady.target)){if((Get-OwnedNativeState $taskIdentity) -cne 'dead_or_reused'){throw 'Original exact birth remains live'}}
if($taskProof.copiedPair.Count -ne 2 -or $taskRetired.retired.Count -ne 2){throw 'Original two runtime and two private retirement receipts required'}
foreach($taskName in @('auth.json','models.json')){
 if(@($taskProof.copiedPair|Where-Object name -CEQ $taskName).Count -ne 1 -or @($taskRetired.retired|Where-Object name -CEQ $taskName).Count -ne 1){throw 'Exact paired retirement names required'}
 foreach($taskFile in @("$taskRoot/runtime/data/$taskName","$taskRoot-authority/$taskName")){if(Test-Path -LiteralPath $taskFile){throw 'Authority appeared after committed cleanup; new occurrence required'}}
}
. "$PSScriptRoot/qualify-provider.ps1"
$taskAudit=Get-Content -Raw -LiteralPath "$taskEvidence/provider-final-redacted-private.json"|ConvertFrom-Json
$taskPlan=Get-Content -Raw -LiteralPath "$PSScriptRoot/plan.json"|ConvertFrom-Json
$taskPreflight=Get-Content -Raw -LiteralPath "$taskEvidence/preflight-ready.json"|ConvertFrom-Json
$taskQualification=Get-GoalScopeProviderQualification $taskAudit $taskPlan $taskPreflight $taskSettled $taskLauncher
if(!$taskQualification.passed){throw ($taskQualification|ConvertTo-Json -Depth 12 -Compress)}
$taskProof.maximumRequests=$taskQualification.maximum
$taskProof.providerQualificationPassed=$taskQualification.passed
$taskProof.qualificationFailures=@($taskQualification.failures)
$taskProof|Add-Member -NotePropertyName qualificationVerifiedAtUtc -NotePropertyValue ([DateTime]::UtcNow.ToString('o')) -Force
$taskProof|ConvertTo-Json -Depth 30|Set-Content -LiteralPath "$taskEvidence/physical-terminal-and-pair-cleanup.json"
$taskRetired.maximumRequests=$taskQualification.maximum
$taskRetired.allActualRequests='gpt-6.1-sol,stream=true,200,original source EOF'
$taskRetired|Add-Member -NotePropertyName qualificationVerifiedAtUtc -NotePropertyValue ([DateTime]::UtcNow.ToString('o')) -Force
$taskRetired|ConvertTo-Json -Depth 20|Set-Content -LiteralPath "$PSScriptRoot/$Stage-authority-retirement.json"
@{passed=$taskQualification.passed;requests=$taskQualification.requests;maximum=$taskQualification.maximum;originalPhysicalCompletion=$taskSettled.physicalCompletion;originalRuntimeRetirements=$taskProof.copiedPair.Count;originalPrivateRetirements=$taskRetired.retired.Count;operation='Same original qualification function and actual audit;no restart,request,credential staging or repeated deletion'}|ConvertTo-Json -Compress
