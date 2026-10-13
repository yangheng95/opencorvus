param([Parameter(Mandatory=$true)][string]$RunRoot,[Parameter(Mandatory=$true)][string]$EvidenceRoot,[Parameter(Mandatory=$true)][int]$Port,[Parameter(Mandatory=$true)][string]$Prefix,[Parameter(Mandatory=$true)][string]$Binary)
$ErrorActionPreference='Stop'
$ownedRun=[IO.Path]::GetFullPath($RunRoot)
$ownedEvidence=[IO.Path]::GetFullPath($EvidenceRoot)
$ownedBinary=[IO.Path]::GetFullPath($Binary)
$ownedPort=$Port
$ownedPrefix=$Prefix
if(Test-Path -LiteralPath $ownedRun){throw 'Fresh run root required'}
if(!(Test-Path -LiteralPath (Join-Path (Split-Path $ownedBinary -Parent) 'ui/index.html'))){throw 'Private bin/ui required'}
if(@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -eq $ownedPort).Count){throw 'Owned port occupied'}
foreach($part in @('runtime','project','evidence','home','appdata','localappdata','temp','xdg-config','xdg-data','xdg-cache','xdg-state')){[IO.Directory]::CreateDirectory((Join-Path $ownedRun $part))|Out-Null}
$ownedProject=Join-Path $ownedRun 'project'
foreach($folder in @('source','target','root-copy','root-move')){[IO.Directory]::CreateDirectory((Join-Path $ownedProject $folder))|Out-Null}
$ownedFiles=@{'source/audit-a.txt'="COPY A`r`n";'source/audit-b.txt'="COPY B`r`n";'target/audit-b.txt'="EXISTING TARGET`r`n";'root-copy/root-copy-a.txt'="ROOT COPY A`r`n";'root-copy/root-copy-b.txt'="ROOT COPY B`r`n";'root-move/root-move-a.txt'="ROOT MOVE A`r`n";'root-move/root-move-b.txt'="ROOT MOVE B`r`n"}
foreach($name in $ownedFiles.Keys){[IO.File]::WriteAllText((Join-Path $ownedProject $name),$ownedFiles[$name],[Text.UTF8Encoding]::new($false))}
& git -C $ownedProject init --initial-branch=main | Out-Null
if($LASTEXITCODE -ne 0){throw 'Owned Git init failed'}
. (Join-Path $PSScriptRoot 'launch-before.ps1') -FunctionsOnly
$ownedOccurrence=$ownedPrefix+'-'+[Guid]::NewGuid().ToString()
$ownedDeadline=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+900000
$ownedArgs=@((Join-Path $PSScriptRoot 'native-host.ts'),'--owned-host',(Join-Path $ownedRun 'evidence'),$ownedOccurrence,[string]$ownedDeadline,$ownedBinary,'D:/myhexin-local/opencorvus/packages/opencorvus/src/index.ts','serve','--hostname','127.0.0.1','--port',[string]$ownedPort,'--project-dir',$ownedProject,'--startup-receipt',(Join-Path $ownedRun 'startup.json'),'--startup-occurrence',$ownedOccurrence,'--log-level','INFO')
if(@($ownedArgs|Where-Object{$_ -match '[\s"]'}).Count){throw 'Exact argument quoting requires review'}
$ownedStart=[Diagnostics.ProcessStartInfo]::new()
$ownedStart.FileName=$ownedBinary
$ownedStart.WorkingDirectory=$ownedRun
$ownedStart.UseShellExecute=$false
$ownedStart.CreateNoWindow=$true
$ownedStart.RedirectStandardOutput=$true
$ownedStart.RedirectStandardError=$true
$ownedStart.Environment.Clear()
foreach($name in @('PATH','SystemRoot','WINDIR','ComSpec','PATHEXT','LANG','LC_ALL','LC_CTYPE')){if(Test-Path -LiteralPath "Env:$name"){$ownedStart.Environment[$name]=[Environment]::GetEnvironmentVariable($name)}}
foreach($mapping in @(@('HOME','home'),@('USERPROFILE','home'),@('APPDATA','appdata'),@('LOCALAPPDATA','localappdata'),@('TEMP','temp'),@('TMP','temp'),@('TMPDIR','temp'),@('XDG_CONFIG_HOME','xdg-config'),@('XDG_DATA_HOME','xdg-data'),@('XDG_CACHE_HOME','xdg-cache'),@('XDG_STATE_HOME','xdg-state'),@('OPENCORVUS_HOME','runtime'))){$ownedStart.Environment[$mapping[0]]=Join-Path $ownedRun $mapping[1]}
$ownedStart.Environment['HOMEDRIVE']='C:'
$ownedStart.Environment['HOMEPATH']=$ownedStart.Environment['HOME'].Substring(2).Replace('/','\')
$ownedStart.Environment['OPENCORVUS_TASK_PROCESS_MODE']='native'
$ownedStart.Environment['OPENCORVUS_DISABLE_EXTERNAL_SKILLS']='1'
$ownedStart.Environment['OPENCORVUS_DISABLE_AUTOUPDATE']='1'
foreach($arg in $ownedArgs){$ownedStart.ArgumentList.Add($arg)}
Write-OwnedLaunchFact (Join-Path $ownedEvidence ($ownedPrefix+'-inputs.json')) @{project=$ownedProject;files=$ownedFiles;nativeDeadline=$ownedDeadline;modelCalls='Not requested; no model/credential staging';ui=(Join-Path (Split-Path $ownedBinary -Parent) 'ui')}
$ownedProcess=[Diagnostics.Process]::new()
$ownedProcess.StartInfo=$ownedStart
if(!$ownedProcess.Start()){throw 'Native Host failed to start'}
$ownedStdout=[IO.File]::Create((Join-Path $ownedRun 'stdout.log'))
$ownedStderr=[IO.File]::Create((Join-Path $ownedRun 'stderr.log'))
$ownedOutDrain=$ownedProcess.StandardOutput.BaseStream.CopyToAsync($ownedStdout)
$ownedErrDrain=$ownedProcess.StandardError.BaseStream.CopyToAsync($ownedStderr)
$ownedFailure=$null
try {
$readyDeadline=[DateTime]::UtcNow.AddSeconds(45)
do{
  if(Test-Path -LiteralPath (Join-Path $ownedRun 'evidence/native-host-error.json')){throw 'Original native Host error retained'}
  if((Test-Path -LiteralPath (Join-Path $ownedRun 'evidence/native-host-ready.json')) -and (Test-Path -LiteralPath (Join-Path $ownedRun 'startup.json'))){break}
  if($ownedProcess.HasExited){throw 'Host exited before startup'}
  Start-Sleep -Milliseconds 100
}while([DateTime]::UtcNow -lt $readyDeadline)
$ready=Get-Content -Raw -LiteralPath (Join-Path $ownedRun 'evidence/native-host-ready.json')|ConvertFrom-Json
$startup=Get-Content -Raw -LiteralPath (Join-Path $ownedRun 'startup.json')|ConvertFrom-Json
if($ready.occurrence -ne $ownedOccurrence -or $ready.host.pid -ne $ownedProcess.Id -or $startup.occurrenceID -ne $ownedOccurrence -or $startup.pid -ne $ready.target.pid -or $startup.outcome -ne 'listening' -or ([Uri]$startup.url).Port -ne $ownedPort){throw 'Actual Host and listener binding failed'}
if((Get-OwnedNativeState $ready.host) -ne 'exact_live' -or (Get-OwnedNativeState $ready.target) -ne 'exact_live'){throw 'Exact native owner required'}
$owner=@{occurrence=$ownedOccurrence;runRoot=$ownedRun;runtime=(Join-Path $ownedRun 'runtime');project=$ownedProject;evidence=(Join-Path $ownedRun 'evidence');evidencePrefix=$ownedPrefix;settlementEvidenceRoot=$ownedEvidence;port=$ownedPort;host=$ready.host;nativeTarget=$ready.target;targetBirthAtMs=$ready.targetBirthAtMs;owner=@{ProcessId=$ready.target.pid;processInstanceID=$ready.target.processInstanceID};nativeDeadline=$ownedDeadline}
Write-OwnedLaunchFact (Join-Path $ownedRun 'launch-owner.json') $owner
Write-OwnedLaunchFact (Join-Path $ownedEvidence ($ownedPrefix+'-launch-owner.json')) $owner
$ui=Invoke-WebRequest -NoProxy -Uri "http://127.0.0.1:$ownedPort/ui" -TimeoutSec 15
$asset=[regex]::Match($ui.Content,'assets/main-[^" ]+\.js').Value
$expected=Get-Content -Raw -LiteralPath (Join-Path (Split-Path $ownedBinary -Parent) 'ui/index.html')
if(!$asset -or !$expected.Contains($asset)){throw 'Actual UI private asset binding mismatch'}
Write-OwnedLaunchFact (Join-Path $ownedEvidence ($ownedPrefix+'-ui-binding.json')) @{status=[int]$ui.StatusCode;sourceHeader=[string]$ui.Headers['x-opencorvus-ui-source'];asset=$asset;privateIndex=(Join-Path (Split-Path $ownedBinary -Parent) 'ui/index.html');occurrence=$ownedOccurrence}
Write-Output ($owner|ConvertTo-Json -Depth 5)
} catch {
  $ownedFailure=$_
  Write-OwnedLaunchFact (Join-Path $ownedEvidence ($ownedPrefix+'-launcher-error.json')) @{occurrence=$ownedOccurrence;errorType=$_.Exception.GetType().Name;message=$_.Exception.Message;boundary='Setup failure retained; parent continues draining/joining exact owned Host'}
  if(Test-Path -LiteralPath (Join-Path $ownedRun 'launch-owner.json')){
    try {
      & (Join-Path $PSScriptRoot 'shutdown.ps1') -RunRoot $ownedRun -EvidenceRoot $ownedEvidence -EvidencePrefix $ownedPrefix -Reason setup-failure
    } catch {
      Write-OwnedLaunchFact (Join-Path $ownedEvidence ($ownedPrefix+'-setup-settlement-error.json')) @{occurrence=$ownedOccurrence;message=$_.Exception.Message;boundary='Settlement failure retained; same parent remains alive for Host/output join'}
    }
  }
}
while(!$ownedProcess.WaitForExit(500)){}
$ownedProcess.WaitForExit()
$null=$ownedOutDrain.GetAwaiter().GetResult();$null=$ownedErrDrain.GetAwaiter().GetResult()
$ownedStdout.Dispose();$ownedStderr.Dispose()
$settled=Get-OwnedNativeSettlement $owner
if(!$settled -or $ownedProcess.ExitCode -ne 0){throw 'Actual native settlement not successful'}
Write-OwnedLaunchFact (Join-Path $ownedEvidence ($ownedPrefix+'-launcher-joined.json')) @{occurrence=$ownedOccurrence;exitCode=$ownedProcess.ExitCode;settlement=$settled;stdoutDrained=$true;stderrDrained=$true}
if($ownedFailure){throw $ownedFailure}
