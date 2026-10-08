$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../live-sol-launch.ps1') -FunctionsOnly
function Read-Fact([string]$path){Get-Content -Raw -LiteralPath $path|ConvertFrom-Json -DateKind String}
function Equal($actual,$expected){if($actual -cne $expected){throw "Actual '$actual', expected '$expected'"}}
$sourceRun='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-08/source-single-chat-live-179-01'
$sourceEvidence='D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/source-single-chat-live-179/live-01'
$owner=Read-Fact "$sourceRun/launch-owner.json"
$owner|Add-Member qualificationKind 'NativeService'
$native=Read-Fact "$sourceRun/evidence/native-host-settled.json"
$provider=Read-Fact "$sourceEvidence/source-single-chat-live-179-01-final-provider-audit.json"
$records=@()
foreach($case in @(
  @{name='physical-inside-cap';time=$native.observedAtUtc;code='NativeService'},
  @{name='physical-at-cap';time=([DateTimeOffset]::FromUnixTimeMilliseconds([long]$owner.targetBirthAtMs+600000)).ToString('o');code='NativeService'},
  @{name='physical-after-cap';time=([DateTimeOffset]::FromUnixTimeMilliseconds([long]$owner.targetBirthAtMs+600001)).ToString('o');code='OWNED_NATIVE_COMPLETION_BUDGET_INVALID'},
  @{name='physical-time-invalid';time='invalid';code='OWNED_NATIVE_COMPLETION_BUDGET_INVALID'}
)){
  $inputNative=$native|ConvertTo-Json -Depth 16|ConvertFrom-Json -DateKind String
  $inputNative.observedAtUtc=$case.time
  try{
    $result=Assert-OwnedQualificationCompletion $owner $inputNative $provider $null $null
    $output=@{code=$result.qualification;physicalCompletion=$result.physicalCompletion;providerEOFRequests=$result.providerEOFRequests}
  }catch{
    $output=@{code=$_.Exception.Data['code'];type=$_.Exception.GetType().FullName}
  }
  Equal $output.code $case.code
  if($case.code -eq 'NativeService'){Equal $output.physicalCompletion $true;Equal $output.providerEOFRequests 10}
  else{Equal $output.type 'System.IO.InvalidDataException'}
  $records+=@{case=$case.name;output=$output}
}
$settlementBase=@{occurrence=$owner.occurrence;runRoot=$owner.runRoot;evidenceRoot=$owner.settlementEvidenceRoot;evidencePrefix=$owner.evidencePrefix;reason='root-manual'}
foreach($case in @(
  @{reason='root-manual';code='root-manual'},
  @{reason='completed-service-maximum';code='completed-service-maximum'},
  @{reason='immutable-wrapper-failure';code='OWNED_QUALIFICATION_BOUNDARY_REACHED'},
  @{reason='fixed-task-maximum';code='OWNED_QUALIFICATION_BOUNDARY_REACHED'},
  @{reason='fixed-preparation-maximum';code='OWNED_QUALIFICATION_BOUNDARY_REACHED'},
  @{reason='supervisor-error';code='OWNED_QUALIFICATION_BOUNDARY_REACHED'},
  @{reason='root-manual';foreign=$true;code='OWNED_SETTLEMENT_IDENTITY_INVALID'}
)){
  $settlement=$settlementBase|ConvertTo-Json|ConvertFrom-Json -DateKind String
  $settlement.reason=$case.reason
  if($case.foreign){$settlement.occurrence='foreign'}
  try{$output=@{code=(Assert-OwnedSettlementReason $owner $settlement)}}
  catch{$output=@{code=$_.Exception.Data['code'];type=$_.Exception.GetType().FullName}}
  Equal $output.code $case.code
  if($case.code -like 'OWNED_*'){Equal $output.type 'System.IO.InvalidDataException'}
  $records+=@{case=$case.reason;foreign=[bool]$case.foreign;output=$output}
}
@{scope='Decoded DATA contract only; no original qualification rerun or UI test';cases=$records.Count;records=$records}|ConvertTo-Json -Depth 6
