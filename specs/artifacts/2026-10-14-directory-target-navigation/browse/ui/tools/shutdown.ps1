param(
  [Parameter(Mandatory=$true)][string]$RunRoot,
  [Parameter(Mandatory=$true)][string]$EvidenceRoot,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9-]+$')][string]$EvidencePrefix,

  [string]$Reason='root-manual',
  [switch]$PageClosed,
  [hashtable]$SupervisionTrigger
)
$ErrorActionPreference='Stop'
$taskRunRoot=[IO.Path]::GetFullPath($RunRoot)
$taskEvidence=[IO.Path]::GetFullPath($EvidenceRoot)
$taskPrefix=$EvidencePrefix
if($taskRunRoot -ne [IO.Path]::GetFullPath('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/directory-target-browse-after-01a133') -or $taskPrefix -cne 'directory-target-browse-after' -or $taskEvidence -ne [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'directory-target-browse-after'))){throw 'Only the exact reviewed directory-target namespace is admitted'}
$taskFixture=Get-Content -Raw -LiteralPath (Join-Path $taskRunRoot 'prepared-fixture.json')|ConvertFrom-Json
if($taskFixture.schema -cne 'directory-target-browse.fixture/v1' -or $taskFixture.modelCallsRequested -cne 'none' -or $taskFixture.credentialCatalogStaging -cne 'none'){throw 'Original credential-free fixture required'}
$taskOwner=Get-Content -Raw -LiteralPath (Join-Path $taskRunRoot 'launch-owner.json') | ConvertFrom-Json
if($taskOwner.fixtureID -cne $taskFixture.fixtureID -or $taskOwner.qualification -cne 'real-desktop-directory-target-browse' -or $taskOwner.port -ne 18459){throw 'Exact original credential-free launch fixture required'}
if([IO.Path]::GetFullPath($taskOwner.runRoot) -ne $taskRunRoot -or $taskOwner.evidencePrefix -ne $taskPrefix){throw 'Run/prefix does not match exact launch admission'}
if([IO.Path]::GetFullPath($taskOwner.settlementEvidenceRoot) -ne $taskEvidence){throw 'Settlement evidence root does not match launch admission'}
if($SupervisionTrigger -and ($SupervisionTrigger.occurrence -cne $taskOwner.occurrence -or $SupervisionTrigger.pid -ne $taskOwner.owner.ProcessId -or $SupervisionTrigger.reason -cne $Reason)){throw 'Supervision proposal does not match exact launch and settlement reason'}
function Write-OwnedReceipt([string]$name,$value){
  $target=Join-Path $taskEvidence "$taskPrefix-$name.json"
  $stage=$target+'.'+[Guid]::NewGuid().ToString()+'.stage'
  $stream=[IO.File]::Open($stage,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
  try{$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 12));$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
  try{[IO.File]::Move($stage,$target)}finally{if(Test-Path -LiteralPath $stage){Remove-Item -LiteralPath $stage -ErrorAction Stop}}
}
$taskSettlementPath=Join-Path $taskEvidence "$taskPrefix-settlement-owner.json"
$taskPhysicalPath=Join-Path $taskEvidence "$taskPrefix-physical-terminal-and-credential-free.json"
$taskErrorPath=Join-Path $taskEvidence "$taskPrefix-settlement-error.json"
$taskSettlementWon=$false
try{
  Write-OwnedReceipt 'settlement-owner' @{occurrence=$taskOwner.occurrence;runRoot=$taskRunRoot;evidenceRoot=$taskEvidence;evidencePrefix=$taskPrefix;ownerPID=$PID;reason=$Reason;supervision=$SupervisionTrigger;admittedAt=[DateTime]::UtcNow.ToString('o')}
  $taskSettlementWon=$true
}catch{
  if(!(Test-Path -LiteralPath $taskSettlementPath)){throw}
}
if(!$taskSettlementWon){
  $existing=Get-Content -Raw -LiteralPath $taskSettlementPath|ConvertFrom-Json
  if($existing.occurrence -ne $taskOwner.occurrence -or $existing.runRoot -ne $taskRunRoot -or $existing.evidenceRoot -ne $taskEvidence -or $existing.evidencePrefix -ne $taskPrefix){throw 'Another settlement occurrence owns this prefix'}
  $joinDeadline=[DateTime]::UtcNow.AddSeconds(75)
  do{
    if(Test-Path -LiteralPath $taskErrorPath){throw 'Exact settlement owner failed; original evidence retained; inspect settlement-error receipt'}
    if(Test-Path -LiteralPath $taskPhysicalPath){
      $joined=Get-Content -Raw -LiteralPath $taskPhysicalPath|ConvertFrom-Json
      if($joined.occurrence -ne $taskOwner.occurrence -or !$joined.physicalCompletion -or $joined.credentialHandling -cne 'not-applicable-never-staged-by-checker'){throw 'Exact settlement remains incomplete'}
      Write-Output 'Joined exact physical settlement and credential-free settlement receipt.'
      return
    }
    Start-Sleep -Milliseconds 500
  }while([DateTime]::UtcNow -lt $joinDeadline)
  throw 'Exact settlement join timed out; no second shutdown or cleanup admitted'
}
try {
. (Join-Path $PSScriptRoot 'owned-launch-functions.ps1')
function Observe-OwnedChain {
  return @(@($taskOwner.nativeTarget,$taskOwner.host)|ForEach-Object {
    $state=Get-OwnedNativeState $_
    @{expected=$_;state=$state;originalOccurrencePresent=($state -eq 'exact_live')}
  })
}
function Owned-Listeners {
  return @(Get-NetTCPConnection -ErrorAction Stop|Where-Object {$_.State -eq 'Listen' -and $_.LocalPort -eq $taskOwner.port}|Select-Object LocalAddress,LocalPort,OwningProcess)
}
$taskChain=Observe-OwnedChain
$taskRoot=$taskChain|Where-Object {$_.expected.pid -eq $taskOwner.nativeTarget.pid}|Select-Object -First 1
$taskListeners=Owned-Listeners
$admission=[ordered]@{observedAtUtc=[DateTime]::UtcNow.ToString('o');occurrence=$taskOwner.occurrence;owner=$taskOwner.nativeTarget;pageClosed=[bool]$PageClosed;dispatch=$false;boundary='Public shutdown admission is distinct from whole native Job/output/request settlement'}
if($taskRoot.originalOccurrencePresent){
  if($taskListeners.Count -eq 0){
    $admission.reason='Original Target live without listener; no public stop dispatched; await the same native physical settlement'
    Write-OwnedReceipt 'shutdown-admission' $admission
  }else{
  if($taskListeners.Count -ne 1 -or $taskListeners[0].OwningProcess -ne $taskOwner.nativeTarget.pid){throw 'Listener does not match original native Target'}
  $response=Invoke-WebRequest -UseBasicParsing -Method Post -Uri "http://127.0.0.1:$($taskOwner.port)/shutdown" -ContentType 'application/json' -Body '{}' -TimeoutSec 15
  $admission.dispatch=$true;$admission.status=[int]$response.StatusCode;$admission.body=$response.Content|ConvertFrom-Json
  Write-OwnedReceipt 'shutdown-admission' $admission
  }
}else{
  if($taskListeners.Count){throw 'Original Target gone but owned port remains occupied'}
  $admission.reason='Original Target occurrence already exited; no shutdown dispatched'
  Write-OwnedReceipt 'shutdown-admission' $admission
}
$deadline=[DateTime]::UtcNow.AddSeconds(45)
do{
  $taskNativeSettlement=Get-OwnedNativeSettlement $taskOwner
  $taskChain=Observe-OwnedChain;$taskListeners=Owned-Listeners
  if($taskNativeSettlement -and !@($taskChain|Where-Object originalOccurrencePresent).Count -and !$taskListeners.Count){break}
  Start-Sleep -Milliseconds 100
}while([DateTime]::UtcNow -lt $deadline)
if(!$taskNativeSettlement -or @($taskChain|Where-Object originalOccurrencePresent).Count -or $taskListeners.Count){throw 'Whole native Job/output/request and Host/port settlement incomplete; retain original namespace'}
Write-OwnedReceipt 'physical-terminal-and-credential-free' @{observedAtUtc=[DateTime]::UtcNow.ToString('o');occurrence=$taskOwner.occurrence;physicalCompletion=$true;nativeSettlement=$taskNativeSettlement;chain=$taskChain;listeners=$taskListeners;credentialHandling='not-applicable-never-staged-by-checker';modelCallsRequested='none';credentialCatalogStaging='none';boundary='Production foreground Job/output/request settled, exact Host/Target gone and port released. This checker staged no credential/catalog pair, reads no provider/auth/model content, and performs no credential deletion. It makes no claim about automatically generated files.'}
Write-Output 'Owned observed process chain settled; credential handling was not applicable.'
} catch {
  if(!(Test-Path -LiteralPath $taskErrorPath)){
    Write-OwnedReceipt 'settlement-error' @{occurrence=$taskOwner.occurrence;observedAtUtc=[DateTime]::UtcNow.ToString('o');errorType=$_.Exception.GetType().Name;message=$_.Exception.Message;boundary='Settlement failed; first wrapper failure preserved; physical completion qualified only by its exact original receipt; no kill'}
  }
  throw
}
