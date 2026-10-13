# Prepared only. Only mature write/native occurrence/settlement primitives; no Task or Provider qualification caller.
function Write-OwnedLaunchFact([string]$Target,$Value) {
  $stage=$Target+'.'+[Guid]::NewGuid().ToString()+'.stage'
  $stream=[IO.File]::Open($stage,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
  try{$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($Value|ConvertTo-Json -Depth 12));$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
  try{[IO.File]::Move($stage,$Target)}finally{if(Test-Path -LiteralPath $stage){Remove-Item -LiteralPath $stage -ErrorAction Stop}}
}
function Get-OwnedNativeState($Expected) {
  if(!$Expected.pid -or $Expected.processInstanceID -notmatch '^win32:[0-9]+$'){throw 'Exact native Windows occurrence required'}
  $observerRoot=Join-Path $PSScriptRoot 'native-observer'
  $observerCode=@'
import path from "node:path";
const root=process.argv[1];
process.env.OPENCORVUS_HOME=path.join(root,"runtime");
process.env.OPENCORVUS_TEST_HOME=path.join(root,"home");
process.env.OPENCORVUS_TEST_PROCESS_ROOT=root;
const {installProcessShims}=await import("file:///D:/myhexin-local/opencorvus/packages/opencorvus/src/runtime/shims.ts");
installProcessShims();
const {observeRuntimeProcessOccurrence}=await import("file:///D:/myhexin-local/opencorvus/packages/opencorvus/src/runtime/process-occurrence.ts");
console.log(observeRuntimeProcessOccurrence(JSON.parse(process.argv[2])));
'@
  $observerStart=[Diagnostics.ProcessStartInfo]::new()
  $observerStart.FileName='D:\myhexin-local\opencorvus\.tmp-product-iteration\sse-compression-305\bun140\bun-windows-x64\bun.exe'
  $observerStart.WorkingDirectory=$observerRoot
  $observerStart.UseShellExecute=$false
  $observerStart.CreateNoWindow=$true
  $observerStart.RedirectStandardOutput=$true
  $observerStart.RedirectStandardError=$true
  $observerStart.Environment.Clear()
  foreach($environmentName in @('PATH','SystemRoot','WINDIR','ComSpec','PATHEXT')){
    if(Test-Path -LiteralPath "Env:$environmentName"){$observerStart.Environment[$environmentName]=[Environment]::GetEnvironmentVariable($environmentName)}
  }
  foreach($argument in @('-e',$observerCode,$observerRoot,($Expected|ConvertTo-Json -Depth 8 -Compress))){$observerStart.ArgumentList.Add($argument)}
  $observerProcess=[Diagnostics.Process]::new()
  $observerProcess.StartInfo=$observerStart
  try {
    if(!$observerProcess.Start()){throw 'Production native occurrence observer failed to start'}
    $observerPID=$observerProcess.Id
    $observerBirth=$observerProcess.StartTime.ToUniversalTime().Ticks
    $outputTask=$observerProcess.StandardOutput.ReadToEndAsync()
    $errorTask=$observerProcess.StandardError.ReadToEndAsync()
    $observerProcess.WaitForExit()
    $state=$outputTask.GetAwaiter().GetResult().Trim()
    $errorOutput=$errorTask.GetAwaiter().GetResult()
    $observationFile=Join-Path $observerRoot ('observation-'+[Guid]::NewGuid().ToString()+'.json')
    Write-OwnedLaunchFact $observationFile @{expected=$Expected;observerPID=$observerPID;observerStartTimeUtcTicks=$observerBirth;executable=$observerStart.FileName;arguments=@($observerStart.ArgumentList);exitCode=$observerProcess.ExitCode;stdoutDecoded=$state;stderrDecoded=$errorOutput;observedAtUtc=[DateTime]::UtcNow.ToString('O');qualification='Original decoded ReadToEnd stdout/stderr after both tasks and natural WaitForExit; not a binary-stream or reg-child identity claim'}
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
