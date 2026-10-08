[CmdletBinding(DefaultParameterSetName='Launch')]
param(
  [Parameter(Mandatory=$true,ParameterSetName='Launch')][string]$RunRoot,
  [Parameter(Mandatory=$true,ParameterSetName='Launch')][string]$EvidenceRoot,
  [Parameter(Mandatory=$true,ParameterSetName='Launch')][ValidateRange(1,65535)][int]$Port,
  [Parameter(Mandatory=$true,ParameterSetName='Launch')][ValidatePattern('^[a-z0-9-]+$')][string]$EvidencePrefix,
  [Parameter(Mandatory=$true,ParameterSetName='Launch')][string]$ProfileSelectionPath,
  [Parameter(Mandatory=$true,ParameterSetName='Launch')][ValidateRange(1,100)][int]$RequestBudget,
  [Parameter(Mandatory=$true,ParameterSetName='Functions')][switch]$FunctionsOnly
)
function Write-OwnedLaunchFact([string]$Target,$Value) {
  $stage=$Target+'.'+[Guid]::NewGuid().ToString()+'.stage'
  $stream=[IO.File]::Open($stage,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
  try{$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($Value|ConvertTo-Json -Depth 12));$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
  try{[IO.File]::Move($stage,$Target)}finally{if(Test-Path -LiteralPath $stage){Remove-Item -LiteralPath $stage -ErrorAction Stop}}
}
function Assert-OwnedTaskCompletion($Stored,$Boundary,$Complete) {
  function Reject-Completion([string]$Code) {
    $error=[IO.InvalidDataException]::new($Code)
    $error.Data['code']=$Code
    throw $error
  }
  if(!$Boundary -or !$Complete -or !$Complete.selected -or !$Complete.pinned -or !$Complete.lifecycle){Reject-Completion 'TASK_COMPLETION_SHAPE_INVALID'}
  foreach($receipt in @($Boundary,$Complete)) {
    if($receipt.pid -ne $Stored.owner.ProcessId -or $receipt.occurrence -ne $Stored.occurrence -or $receipt.selected.occurrence -ne $Stored.occurrence -or [IO.Path]::GetFullPath($receipt.selected.directory) -ne [IO.Path]::GetFullPath($Stored.project)){Reject-Completion 'TASK_COMPLETION_IDENTITY_MISMATCH'}
    if(!$receipt.selected.taskID -or !$receipt.selected.projectID -or !$receipt.selected.requestID -or $receipt.selected.taskID -ne $receipt.pinned.taskID -or $receipt.selected.projectID -ne $receipt.pinned.projectID){Reject-Completion 'TASK_COMPLETION_IDENTITY_MISMATCH'}
  }
  foreach($key in @('taskID','projectID','rootSessionID','epoch','openedEventID','openedAt')) {
    if(!$Complete.pinned.$key -or $Complete.pinned.$key -ne $Boundary.pinned.$key){Reject-Completion 'TASK_COMPLETION_IDENTITY_MISMATCH'}
  }
  foreach($key in @('taskID','projectID','requestID','productPillar','requestSentAt','acceptedObservedAt')) {
    if(!$Complete.selected.$key -or $Complete.selected.$key -ne $Boundary.selected.$key){Reject-Completion 'TASK_COMPLETION_IDENTITY_MISMATCH'}
  }
  if($Complete.lifecycle.status -ne 'completed' -or !$Complete.lifecycle.terminalEventID){Reject-Completion 'TASK_COMPLETION_TERMINAL_INVALID'}
  foreach($key in @('taskID','epoch','openedEventID','openedAt')) {
    if($Complete.lifecycle.$key -ne $Complete.pinned.$key){Reject-Completion 'TASK_COMPLETION_IDENTITY_MISMATCH'}
  }
  if($Complete.ownedPromptSessions -isnot [array] -or $Complete.ownedPromptSessions.Count -ne 0){Reject-Completion 'TASK_COMPLETION_OWNERS_INVALID'}
  $opened=[long]$Complete.pinned.openedAt; $deadline=[long]$Boundary.totalDeadlineMs
  $terminal=[long]$Complete.lifecycle.terminalAt
  $observed=[DateTimeOffset]::MinValue
  if($Complete.observedAt -is [DateTime]) {
    if($Complete.observedAt.Kind -ne [DateTimeKind]::Utc){Reject-Completion 'TASK_COMPLETION_BUDGET_INVALID'}
    $observed=[DateTimeOffset]::new($Complete.observedAt)
  } elseif(![DateTimeOffset]::TryParse([string]$Complete.observedAt,[ref]$observed)){Reject-Completion 'TASK_COMPLETION_BUDGET_INVALID'}
  $observedMs=$observed.ToUnixTimeMilliseconds()
  if($deadline -ne ($opened+900000) -or $terminal -lt $opened -or $terminal -gt $deadline -or $observedMs -lt $terminal -or $observedMs -gt $deadline){Reject-Completion 'TASK_COMPLETION_BUDGET_INVALID'}
  return $true
}
function Get-OwnedTaskMaximumReason([bool]$WrapperFailed,[bool]$CompletionValidated,[long]$Now,[long]$Deadline) {
  if($WrapperFailed){return 'immutable-wrapper-failure'}
  if($Now -ge $Deadline){if($CompletionValidated){return 'completed-service-maximum'};return 'fixed-task-maximum'}
  return $null
}
function Get-OwnedNativeState($Expected) {
  if(!$Expected.pid -or $Expected.processInstanceID -notmatch '^win32:[0-9]+$'){throw 'Exact native Windows occurrence required'}
  $observerRoot=Join-Path $PSScriptRoot 'keyboard-reading-113-native-observer'
  $observerCode=@'
import path from "node:path";
const root=process.argv[1];
process.env.OPENCORVUS_HOME=path.join(root,"runtime");
process.env.OPENCORVUS_TEST_HOME=path.join(root,"home");
process.env.OPENCORVUS_TEST_PROCESS_ROOT=root;
const {installProcessShims}=await import("./src/runtime/shims.ts");
installProcessShims();
const {observeRuntimeProcessOccurrence}=await import("./src/runtime/process-occurrence.ts");
console.log(observeRuntimeProcessOccurrence(JSON.parse(process.argv[2])));
'@
  $observerStart=[Diagnostics.ProcessStartInfo]::new()
  $observerStart.FileName='C:/Users/hengu/.bun/bin/bun.exe'
  $observerStart.WorkingDirectory=Join-Path (Split-Path $PSScriptRoot -Parent) 'packages/opencorvus'
  $observerStart.UseShellExecute=$false
  $observerStart.CreateNoWindow=$true
  $observerStart.RedirectStandardOutput=$true
  $observerStart.RedirectStandardError=$true
  foreach($argument in @('-e',$observerCode,$observerRoot,($Expected|ConvertTo-Json -Depth 8 -Compress))){$observerStart.ArgumentList.Add($argument)}
  $observerProcess=[Diagnostics.Process]::new()
  $observerProcess.StartInfo=$observerStart
  try {
    if(!$observerProcess.Start()){throw 'Production native occurrence observer failed to start'}
    $outputTask=$observerProcess.StandardOutput.ReadToEndAsync()
    $errorTask=$observerProcess.StandardError.ReadToEndAsync()
    $observerProcess.WaitForExit()
    $state=$outputTask.GetAwaiter().GetResult().Trim()
    $errorOutput=$errorTask.GetAwaiter().GetResult()
    if($observerProcess.ExitCode -ne 0){throw "Production native occurrence observer failed: $errorOutput"}
    if($state -eq 'unknown_live'){throw 'Production native occurrence identity is unknown_live; physical closure is unqualified'}
    if($state -notin @('exact_live','dead_or_reused')){throw "Invalid production native occurrence observation: $state"}
    return $state
  } finally {$observerProcess.Dispose()}
}
function Get-OwnedNativeSettlement($Stored) {
  $errorPath=Join-Path $Stored.evidence 'native-host-error.json'
  if(Test-Path -LiteralPath $errorPath){throw "Native Host failed; retain exact original evidence: $errorPath"}
  $settledPath=Join-Path $Stored.evidence 'native-host-settled.json'
  if(!(Test-Path -LiteralPath $settledPath)){return $null}
  $settled=Get-Content -Raw -LiteralPath $settledPath|ConvertFrom-Json
  if($settled.occurrence -ne $Stored.occurrence -or $settled.outcome -ne 'settled' -or $settled.host.pid -ne $Stored.host.pid -or $settled.host.processInstanceID -ne $Stored.host.processInstanceID -or $settled.target.pid -ne $Stored.nativeTarget.pid -or $settled.target.processInstanceID -ne $Stored.nativeTarget.processInstanceID -or !$settled.physicalCompletion -or !$settled.outputDrainComplete -or !$settled.requestCleanupComplete){throw 'Native settlement does not bind the exact admitted Host/Target'}
  return $settled
}
function Watch-OwnedQualification {
  param(
    [Parameter(Mandatory=$true)]$LaunchReceipt,
    [Parameter(Mandatory=$true)][string]$EvidenceRoot,
    [Parameter(Mandatory=$true)][long]$PreparationDeadlineMilliseconds
  )
  $ErrorActionPreference='Stop'
  $run=[IO.Path]::GetFullPath($LaunchReceipt.runRoot)
  $evidence=[IO.Path]::GetFullPath($EvidenceRoot)
  if($evidence -ne [IO.Path]::GetFullPath($LaunchReceipt.settlementEvidenceRoot)){throw 'Exact settlement evidence root required'}
  $stored=$LaunchReceipt; $ownerValidated=$false
  $previous=$null; $sequence=0; $boundary=$null
  $physical=Join-Path $evidence ($stored.evidencePrefix+'-physical-terminal-and-pair-cleanup.json')
  $closureError=Join-Path $evidence ($stored.evidencePrefix+'-settlement-error.json')
  try {
  $stored=Get-Content -Raw -LiteralPath (Join-Path $run 'launch-owner.json')|ConvertFrom-Json
  if(!$stored.nativeTarget.pid -or !$stored.host.pid -or !$stored.targetBirthAtMs -or !$stored.occurrence){throw 'Complete native Host/Target launch occurrence required'}
  if($stored.occurrence -ne $LaunchReceipt.occurrence -or $stored.nativeTarget.processInstanceID -ne $LaunchReceipt.nativeTarget.processInstanceID -or $stored.nativeTarget.pid -ne $LaunchReceipt.nativeTarget.pid -or $stored.host.pid -ne $LaunchReceipt.host.pid -or $stored.host.processInstanceID -ne $LaunchReceipt.host.processInstanceID){throw 'Supervision receipt does not match exact stored native owner'}
  $ownerValidated=$true
  $launched=[long]$stored.targetBirthAtMs
  if($PreparationDeadlineMilliseconds -lt $launched){throw 'Preparation deadline precedes launch'}
  for(;;){
    if(Test-Path -LiteralPath $closureError){throw 'Existing exact settlement failed; retain pair and inspect receipt'}
    if(Test-Path -LiteralPath $physical){
      $result=Get-Content -Raw -LiteralPath $physical|ConvertFrom-Json
      if($result.occurrence -ne $stored.occurrence -or !$result.physicalCompletion -or !$result.pairedCleanupComplete){throw 'Existing exact settlement incomplete'}
      return $result
    }
    $sequence++
    $phase='supervision-'+$PID+'-'+$sequence
    $observe=@{RunRoot=$run;EvidenceRoot=$evidence;Phase=$phase}
    & (Join-Path $PSScriptRoot 'live-sol-observe-owned.ps1') @observe | Out-Null
    $previous=Join-Path $evidence ($stored.evidencePrefix+'-chain-'+$phase+'.json')
    $chain=Get-Content -Raw -LiteralPath $previous|ConvertFrom-Json
    $now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $reason=$null
    $failurePath=Join-Path $stored.evidence 'failed.json'
    if(Test-Path -LiteralPath $failurePath){
      $failure=Get-Content -Raw -LiteralPath $failurePath|ConvertFrom-Json
      if($failure.pid -ne $stored.owner.ProcessId -or $failure.occurrence -ne $stored.occurrence){throw 'Failure receipt belongs to another owner'}
      $reason='immutable-wrapper-failure'
    }
    $boundaryPath=Join-Path $stored.evidence 'task-boundary-admitted.json'
    if(!$boundary -and (Test-Path -LiteralPath $boundaryPath)){
      $candidate=Get-Content -Raw -LiteralPath $boundaryPath|ConvertFrom-Json
      if($candidate.pid -ne $stored.owner.ProcessId -or $candidate.occurrence -ne $stored.occurrence -or $candidate.selected.occurrence -ne $stored.occurrence -or $candidate.selected.taskID -ne $candidate.pinned.taskID -or $candidate.selected.projectID -ne $candidate.pinned.projectID -or [IO.Path]::GetFullPath($candidate.selected.directory) -ne [IO.Path]::GetFullPath($stored.project)){throw 'Task boundary does not match launch admission'}
      $opened=[long]$candidate.pinned.openedAt
      if($opened -lt $launched -or $opened -gt $now -or $opened -gt $PreparationDeadlineMilliseconds -or [long]$candidate.totalDeadlineMs -ne ($opened+900000) -or [long]$candidate.pinned.epoch -lt 1 -or !$candidate.pinned.openedEventID -or !$candidate.pinned.rootSessionID -or !$candidate.selected.requestID){throw 'Actual Task boundary must retain admitted identity and fixed 900000 milliseconds'}
      $boundary=$candidate
    }
    if(!$reason -and $boundary){
      $completionValidated=$false
      $completePath=Join-Path $stored.evidence 'task-complete.json'
      if(Test-Path -LiteralPath $completePath){
        $complete=Get-Content -Raw -LiteralPath $completePath|ConvertFrom-Json
        $completionValidated=Assert-OwnedTaskCompletion $stored $boundary $complete
      }
      $reason=Get-OwnedTaskMaximumReason $false $completionValidated $now ([long]$boundary.totalDeadlineMs)
    }
    if(!$reason -and !$boundary -and $now -ge $PreparationDeadlineMilliseconds){$reason='fixed-preparation-maximum'}
    $rootPresent=@($chain.presence|Where-Object {$_.processID -eq $stored.owner.ProcessId -and $_.originalOccurrencePresent}).Count
    if(!$reason -and !$rootPresent){$reason='original-root-exited'}
    if($reason){
      Write-OwnedLaunchFact (Join-Path $stored.evidence 'supervision-settlement-trigger.json') @{occurrence=$stored.occurrence;pid=$stored.owner.ProcessId;observedAtUtc=[DateTime]::UtcNow.ToString('o');reason=$reason;preparationDeadlineMs=$PreparationDeadlineMilliseconds;totalDeadlineMs=if($boundary){$boundary.totalDeadlineMs}else{$null};firstFailedPath=if(Test-Path -LiteralPath $failurePath){$failurePath}else{$null};pinned=if($boundary){$boundary.pinned}else{$null};boundary='Pinned Task boundary cached once; no progress renewal; stop request is distinct from physical settlement'}
      # Same helper owns public stop, physical settlement and paired cleanup; no failure rewrite.
      & (Join-Path $PSScriptRoot 'live-sol-shutdown.ps1') -RunRoot $run -EvidenceRoot $evidence -EvidencePrefix $stored.evidencePrefix -Reason $reason
      return
    }
    Start-Sleep -Milliseconds 5000
  } } catch {
    $originalError=$_
    $failureTarget=Join-Path $evidence ($stored.evidencePrefix+'-supervision-error.json')
    if(!(Test-Path -LiteralPath $failureTarget)){
      Write-OwnedLaunchFact $failureTarget @{occurrence=$stored.occurrence;ownerPID=$stored.owner.ProcessId;observedAtUtc=[DateTime]::UtcNow.ToString('o');errorType=$originalError.Exception.GetType().Name;message=$originalError.Exception.Message;boundary='Supervisor error, not a Task lifecycle verdict'}
    }
    if($ownerValidated -and !(Test-Path -LiteralPath $closureError) -and !(Test-Path -LiteralPath $physical)){
      $triggerPath=Join-Path $stored.evidence 'supervision-settlement-trigger.json'
      if(!(Test-Path -LiteralPath $triggerPath)){
        Write-OwnedLaunchFact $triggerPath @{occurrence=$stored.occurrence;pid=$stored.owner.ProcessId;observedAtUtc=[DateTime]::UtcNow.ToString('o');reason='supervisor-error';preparationDeadlineMs=$PreparationDeadlineMilliseconds;totalDeadlineMs=if($boundary){$boundary.totalDeadlineMs}else{$null};firstFailedPath=if(Test-Path -LiteralPath (Join-Path $stored.evidence 'failed.json')){Join-Path $stored.evidence 'failed.json'}else{$null};pinned=if($boundary){$boundary.pinned}else{$null};boundary='Exact original owner observed at launch; settlement must independently observe full known chain and port; unavailable observations remain blockers'}
      }
      $settle=@{RunRoot=$run;EvidenceRoot=$evidence;EvidencePrefix=$stored.evidencePrefix;Reason='supervisor-error'}
      & (Join-Path $PSScriptRoot 'live-sol-shutdown.ps1') @settle
    }
    throw $originalError
  }
}
if($FunctionsOnly){return}
$ErrorActionPreference = 'Stop'
$taskRunRoot = [IO.Path]::GetFullPath($RunRoot)
$taskRuntime = Join-Path $taskRunRoot 'runtime'
$taskProject = Join-Path $taskRunRoot 'project'
$taskEvidence = Join-Path $taskRunRoot 'evidence'
$taskSettlementEvidence = [IO.Path]::GetFullPath($EvidenceRoot)
$taskReceipt = Join-Path $taskRunRoot 'startup.json'
$taskWrapper = 'D:/myhexin-local/opencorvus/.tmp-product-iteration/live-sol-cli-owned.ts'
$taskBun = 'C:/Users/hengu/.bun/bin/bun.exe'
$taskAuth = 'C:/Users/hengu/AppData/Local/opencorvus/data/auth.json'
$taskPort = $Port
$taskOccurrence = $EvidencePrefix + '-' + [Guid]::NewGuid().ToString()
$taskSelection = Join-Path $taskRunRoot 'task-selection.json'
if(![IO.Path]::IsPathRooted($ProfileSelectionPath)){throw 'Absolute profile selection path required'}
$taskProfileSelectionPath = [IO.Path]::GetFullPath($ProfileSelectionPath)
$taskProfileSelection = Get-Content -Raw -LiteralPath $taskProfileSelectionPath | ConvertFrom-Json
$taskSelectionKeys = @($taskProfileSelection.PSObject.Properties.Name | Sort-Object)
if($taskProfileSelection.kind -eq 'builtin'){
  if(($taskSelectionKeys -join ',') -ne 'id,kind,namespace' -or $taskProfileSelection.id -ne 'base' -or $taskProfileSelection.namespace -ne 'builtin'){throw 'Exact builtin Base profile selection required'}
  $taskProfile='base'
}elseif($taskProfileSelection.kind -eq 'project'){
  if(($taskSelectionKeys -join ',') -ne 'definitionPath,kind' -or ![IO.Path]::IsPathRooted($taskProfileSelection.definitionPath)){throw 'Exact project definition selection required'}
  if([IO.Path]::GetFullPath($taskProfileSelection.definitionPath) -ne (Join-Path $PSScriptRoot 'creator-delivery-definition-16.json')){throw 'Actual reviewed QA16 definition required'}
  $taskDefinition=Get-Content -Raw -LiteralPath $taskProfileSelection.definitionPath | ConvertFrom-Json
  $taskProfile=[string]$taskDefinition.manifest.id
  if($taskProfile -ne 'task-resource-qa' -or $taskDefinition.manifest.namespace -ne 'qa' -or $taskDefinition.manifest.version -ne '2026.10.06.2'){throw 'Reviewed QA package identity required'}
}else{throw 'Unknown profile selection kind'}
$taskRequestBudget = $RequestBudget
if (Test-Path -LiteralPath $taskRunRoot) { throw 'Fresh owned occurrence already exists' }
$taskListeners = @(Get-NetTCPConnection -ErrorAction Stop | Where-Object { $_.State -eq 'Listen' -and $_.LocalPort -eq $taskPort })
if ($taskListeners.Count) { throw 'Chosen owned port is occupied' }
foreach ($taskPath in @($taskWrapper,$taskBun,$taskAuth,'C:/Users/hengu/AppData/Local/opencorvus/data/models.json')) { if (!(Test-Path -LiteralPath $taskPath)) { throw 'Required owned/source input missing' } }
if ((Test-Path -LiteralPath 'C:/ProgramData/opencorvus/opencorvus.jsonc') -or (Test-Path -LiteralPath 'C:/ProgramData/opencorvus/opencorvus.json')) { throw 'Non-owned managed configuration needs review' }
$taskProxy = Get-ItemProperty -LiteralPath 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings' -ErrorAction Stop
if (($taskProxy.ProxyServer -match '@') -or $taskProxy.AutoConfigURL) { throw 'System proxy credential/PAC input needs specific review; values suppressed' }
foreach ($taskPath in @($taskRuntime,$taskProject,$taskEvidence,(Join-Path $taskRunRoot 'home'),(Join-Path $taskRunRoot 'appdata'),(Join-Path $taskRunRoot 'localappdata'),(Join-Path $taskRunRoot 'temp'),(Join-Path $taskRunRoot 'xdg-config'),(Join-Path $taskRunRoot 'xdg-data'),(Join-Path $taskRunRoot 'xdg-cache'),(Join-Path $taskRunRoot 'xdg-state'))) { [IO.Directory]::CreateDirectory($taskPath) | Out-Null }
$taskOriginalEnvironment = @{}
Get-ChildItem Env: | ForEach-Object { $taskOriginalEnvironment[$_.Name] = $_.Value }
$taskEnvironment = @{}
foreach ($taskName in @('PATH','SystemRoot','WINDIR','ComSpec','PATHEXT','LANG','LC_ALL','LC_CTYPE')) { if ($taskOriginalEnvironment.ContainsKey($taskName)) { $taskEnvironment[$taskName] = $taskOriginalEnvironment[$taskName] } }
$taskOwnedHome = Join-Path $taskRunRoot 'home'
$taskEnvironment.HOME = $taskOwnedHome
$taskEnvironment.USERPROFILE = $taskOwnedHome
$taskEnvironment.HOMEDRIVE = 'C:'
$taskEnvironment.HOMEPATH = $taskOwnedHome.Substring(2).Replace('/','\')
$taskEnvironment.APPDATA = Join-Path $taskRunRoot 'appdata'
$taskEnvironment.LOCALAPPDATA = Join-Path $taskRunRoot 'localappdata'
$taskEnvironment.TEMP = Join-Path $taskRunRoot 'temp'
$taskEnvironment.TMP = $taskEnvironment.TEMP
$taskEnvironment.TMPDIR = $taskEnvironment.TEMP
$taskEnvironment.XDG_CONFIG_HOME = Join-Path $taskRunRoot 'xdg-config'
$taskEnvironment.XDG_DATA_HOME = Join-Path $taskRunRoot 'xdg-data'
$taskEnvironment.XDG_CACHE_HOME = Join-Path $taskRunRoot 'xdg-cache'
$taskEnvironment.XDG_STATE_HOME = Join-Path $taskRunRoot 'xdg-state'
$taskEnvironment.OPENCORVUS_HOME = $taskRuntime
$taskEnvironment.OPENCORVUS_DISABLE_EXTERNAL_SKILLS = '1'
$taskEnvironment.OPENCORVUS_DISABLE_AUTOUPDATE = '1'
$taskEnvironment.OPENCORVUS_TASK_PROCESS_MODE = 'native'
try {
  Get-ChildItem Env: | ForEach-Object { [Environment]::SetEnvironmentVariable($_.Name,$null,'Process') }
  foreach ($taskName in $taskEnvironment.Keys) { [Environment]::SetEnvironmentVariable($taskName,$taskEnvironment[$taskName],'Process') }
  $taskArguments = @($taskWrapper,$taskAuth,$taskRuntime,$taskProject,$taskEvidence,$taskReceipt,[string]$taskPort,$taskOccurrence,$taskSelection,$taskProfileSelectionPath,[string]$taskRequestBudget)
  if (@($taskArguments | Where-Object { $_ -match '[\s"]' }).Count) { throw 'Known launch arguments require explicit quoting review' }
  $taskHostArguments=@($taskWrapper,'--owned-host',$taskEvidence,$taskOccurrence,$taskBun)+$taskArguments
  $taskProcess = Start-Process -FilePath $taskBun -ArgumentList $taskHostArguments -WorkingDirectory 'D:/myhexin-local/opencorvus/packages/opencorvus' -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskRunRoot 'stdout.log') -RedirectStandardError (Join-Path $taskRunRoot 'stderr.log') -PassThru
  $taskNativeReadyPath=Join-Path $taskEvidence 'native-host-ready.json'
  $taskHostReadyDeadline=[DateTime]::UtcNow.AddSeconds(90)
  do{
    if(Test-Path -LiteralPath (Join-Path $taskEvidence 'native-host-error.json')){throw 'Native Host admission failed; inspect immutable Host error'}
    if(Test-Path -LiteralPath $taskNativeReadyPath){$taskNativeReady=Get-Content -Raw -LiteralPath $taskNativeReadyPath|ConvertFrom-Json;break}
    $taskProcess.Refresh();if($taskProcess.HasExited){throw 'Native Host exited before ready admission'}
    Start-Sleep -Milliseconds 100
  }while([DateTime]::UtcNow -lt $taskHostReadyDeadline)
  if(!$taskNativeReady -or $taskNativeReady.occurrence -ne $taskOccurrence -or $taskNativeReady.outcome -ne 'ready' -or $taskNativeReady.host.pid -ne $taskProcess.Id -or (Get-OwnedNativeState $taskNativeReady.host) -ne 'exact_live' -or (Get-OwnedNativeState $taskNativeReady.target) -ne 'exact_live'){throw 'Exact native Host/Target readiness required'}
  $taskOwner = @{ProcessId=$taskNativeReady.target.pid;processInstanceID=$taskNativeReady.target.processInstanceID}
  $taskLaunchFact = [ordered]@{ observedAtUtc = [DateTime]::UtcNow.ToString('o'); runRoot = $taskRunRoot; runtime = $taskRuntime; project = $taskProject; evidence = $taskEvidence; evidencePrefix = $EvidencePrefix; receipt = $taskReceipt; occurrence = $taskOccurrence; port = $taskPort; owner = $taskOwner; observedProcessChain = @($taskOwner); taskSelectionPath = $taskSelection; taskSelectionRequired = $true; profileSelectionPath = $taskProfileSelectionPath; profileSelection = $taskProfileSelection; handleAdmissionMilliseconds = 600000; environmentNames = @($taskEnvironment.Keys | Sort-Object); taskProcessMode = 'native'; promptProfile = $taskProfile; requestBudget = $taskRequestBudget; requestBudgetScope = 'One same-process audit cumulative across preflight and the entire accepted Task, including scheduler, helpers, workers and closure; no per-worker reset'; inactivityMilliseconds = 180000; taskMaximumMilliseconds = 900000; taskMaximumScope = 'Fixed from actual accepted Task lifecycle openedAt; progress never extends total duration'; sourcePair = 'Authorized existing OpenAI entry and its complete adjacent catalog; staging occurs in reviewed wrapper after actual Git baseline'; cleanup = 'Parent verifies whole observed process chain and port release then removes both copied data/auth.json and data/models.json, including partial failure'; uiAutomation = 'None' }
  $taskLaunchFact.settlementEvidenceRoot = $taskSettlementEvidence
  $taskLaunchFact.host=$taskNativeReady.host
  $taskLaunchFact.nativeTarget=$taskNativeReady.target
  $taskLaunchFact.targetBirthAtMs=$taskNativeReady.targetBirthAtMs
  $taskLaunchFact.preparationMaximumMilliseconds = 600000
  [IO.Directory]::CreateDirectory($taskSettlementEvidence) | Out-Null
  Write-OwnedLaunchFact (Join-Path $taskRunRoot 'launch-owner.json') $taskLaunchFact
  Write-Output "Owned Sol Target PID $($taskNativeReady.target.pid), Host PID $($taskProcess.Id), occurrence $taskOccurrence; native settlement remains required."
} finally {
  Get-ChildItem Env: | ForEach-Object { [Environment]::SetEnvironmentVariable($_.Name,$null,'Process') }
  foreach ($taskName in $taskOriginalEnvironment.Keys) { [Environment]::SetEnvironmentVariable($taskName,$taskOriginalEnvironment[$taskName],'Process') }
}
$taskNormalizedOwner = Get-Content -Raw -LiteralPath (Join-Path $taskRunRoot 'launch-owner.json') | ConvertFrom-Json
$taskPreparationDeadline = [long]$taskNormalizedOwner.targetBirthAtMs + 600000
Watch-OwnedQualification -LaunchReceipt $taskNormalizedOwner -EvidenceRoot $taskSettlementEvidence -PreparationDeadlineMilliseconds $taskPreparationDeadline
$taskFirstFailurePath = Join-Path $taskNormalizedOwner.evidence 'failed.json'
$taskTriggerPath = Join-Path $taskNormalizedOwner.evidence 'supervision-settlement-trigger.json'
$taskCompletePath = Join-Path $taskNormalizedOwner.evidence 'task-complete.json'
if(Test-Path -LiteralPath $taskFirstFailurePath){
  $taskFirstFailure = Get-Content -Raw -LiteralPath $taskFirstFailurePath | ConvertFrom-Json
  if($taskFirstFailure.pid -ne $taskNormalizedOwner.owner.ProcessId -or $taskFirstFailure.occurrence -ne $taskNormalizedOwner.occurrence){throw "Task failure receipt identity mismatch: $taskFirstFailurePath"}
  throw "Task qualification failed; original failure retained: $taskFirstFailurePath"
}
if(Test-Path -LiteralPath $taskTriggerPath){
  $taskTrigger = Get-Content -Raw -LiteralPath $taskTriggerPath | ConvertFrom-Json
  if($taskTrigger.pid -ne $taskNormalizedOwner.owner.ProcessId -or $taskTrigger.occurrence -ne $taskNormalizedOwner.occurrence){throw "Settlement trigger identity mismatch: $taskTriggerPath"}
  if($taskTrigger.reason -in @('immutable-wrapper-failure','fixed-task-maximum','fixed-preparation-maximum','supervisor-error')){throw "Task qualification stopped at its admitted boundary: $taskTriggerPath"}
}
if(!(Test-Path -LiteralPath $taskCompletePath)){throw "Task completion receipt missing after physical settlement: $taskCompletePath"}
$taskComplete = Get-Content -Raw -LiteralPath $taskCompletePath | ConvertFrom-Json
$taskBoundPath = Join-Path $taskNormalizedOwner.evidence 'task-boundary-admitted.json'
if(!(Test-Path -LiteralPath $taskBoundPath)){throw "Task boundary receipt missing after physical settlement: $taskBoundPath"}
$taskBound = Get-Content -Raw -LiteralPath $taskBoundPath | ConvertFrom-Json
$null=Assert-OwnedTaskCompletion $taskNormalizedOwner $taskBound $taskComplete
Write-Output 'Exact Task checker completion and physical settlement qualified; download and visual acceptance remain Root-owned.'
