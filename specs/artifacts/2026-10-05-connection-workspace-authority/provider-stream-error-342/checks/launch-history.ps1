$ErrorActionPreference='Stop'
$caseRun46='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-12/provider-stream-error-342-history-03'
$caseEvidence46='D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/provider-stream-error-342/history-03'
$casePort46=18319
$casePrefix46='provider-stream-error-342-history-03'
$caseLogLevel46='INFO'
$custody342=Get-Content -Raw -LiteralPath (Join-Path $caseRun46 'import-custody.json') | ConvertFrom-Json -AsHashtable -DateKind String
$caseProject46=$custody342.project
if($custody342.run -cne $caseRun46 -or $custody342.sessionID -cne 'ses_-zUSBKhbizzj0BUgz0kf' -or $custody342.messages -ne 9 -or $custody342.parts -ne 21){throw 'Exact actual import custody required'}
if(Test-Path -LiteralPath (Join-Path $caseRun46 'launch-owner.json')){throw 'Fresh launch required'}
foreach($name342 in @('auth.json','models.json')){if(Test-Path -LiteralPath (Join-Path $caseRun46 ('runtime/data/'+$name342))){throw 'Credentialless history required'}}
[IO.Directory]::CreateDirectory($caseEvidence46) | Out-Null
if(@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -eq $casePort46).Count){throw 'Owned120 port occupied'}
foreach($dir46 in @('runtime','evidence','home','appdata','localappdata','temp','xdg-config','xdg-data','xdg-cache','xdg-state','quarantine')){[IO.Directory]::CreateDirectory((Join-Path $caseRun46 $dir46))|Out-Null}
$caseOccurrence46=$casePrefix46+'-'+[Guid]::NewGuid().ToString()
$caseBun46='D:/myhexin-local/opencorvus/.tmp-product-iteration/sse-compression-305/bun140/bun-windows-x64/bun.exe'
$caseWrapper46='D:/myhexin-local/opencorvus/.tmp-product-iteration/live-sol-cli-owned.ts'
$caseOld46=@{};Get-ChildItem Env:|ForEach-Object{$caseOld46[$_.Name]=$_.Value}
$caseEnv46=@{}
foreach($name46 in @('PATH','SystemRoot','WINDIR','ComSpec','PATHEXT','LANG','LC_ALL','LC_CTYPE')){if($caseOld46.ContainsKey($name46)){$caseEnv46[$name46]=$caseOld46[$name46]}}
foreach($mapping46 in @(@('HOME','home'),@('USERPROFILE','home'),@('APPDATA','appdata'),@('LOCALAPPDATA','localappdata'),@('TEMP','temp'),@('TMP','temp'),@('TMPDIR','temp'),@('XDG_CONFIG_HOME','xdg-config'),@('XDG_DATA_HOME','xdg-data'),@('XDG_CACHE_HOME','xdg-cache'),@('XDG_STATE_HOME','xdg-state'),@('OPENCORVUS_HOME','runtime'))){$caseEnv46[$mapping46[0]]=Join-Path $caseRun46 $mapping46[1]}
$caseEnv46.HOMEDRIVE='C:';$caseEnv46.HOMEPATH=$caseEnv46.HOME.Substring(2).Replace('/','\')
$caseEnv46.OPENCORVUS_TASK_PROCESS_MODE='native';$caseEnv46.OPENCORVUS_DISABLE_EXTERNAL_SKILLS='1';$caseEnv46.OPENCORVUS_DISABLE_AUTOUPDATE='1'
$caseNativeDeadline46=([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+600000)
$caseArgs46=@($caseWrapper46,'--owned-host',(Join-Path $caseRun46 'evidence'),$caseOccurrence46,[string]$caseNativeDeadline46,$caseBun46,'./src/index.ts','serve','--hostname','127.0.0.1','--port',[string]$casePort46,'--project-dir',$caseProject46,'--startup-receipt',(Join-Path $caseRun46 'startup.json'),'--startup-occurrence',$caseOccurrence46,'--log-level',$caseLogLevel46)
if(@($caseArgs46|Where-Object{$_ -match '[\s"]'}).Count){throw 'Exact current argument quoting requires review'}
. 'D:/myhexin-local/opencorvus/.tmp-product-iteration/live-sol-launch.ps1' -FunctionsOnly
Write-OwnedLaunchFact (Join-Path $caseRun46 'launch-arguments.json') @{occurrence=$caseOccurrence46;arguments=$caseArgs46;port=$casePort46;credentialStaging='None'}
try{
 Get-ChildItem Env:|ForEach-Object{[Environment]::SetEnvironmentVariable($_.Name,$null,'Process')}
 foreach($name46 in $caseEnv46.Keys){[Environment]::SetEnvironmentVariable($name46,$caseEnv46[$name46],'Process')}
 $caseProcess46=Start-Process -FilePath $caseBun46 -ArgumentList $caseArgs46 -WorkingDirectory 'D:/myhexin-local/opencorvus/packages/opencorvus' -WindowStyle Hidden -RedirectStandardOutput (Join-Path $caseRun46 'stdout.log') -RedirectStandardError (Join-Path $caseRun46 'stderr.log') -PassThru
}finally{
 Get-ChildItem Env:|ForEach-Object{[Environment]::SetEnvironmentVariable($_.Name,$null,'Process')}
 foreach($name46 in $caseOld46.Keys){[Environment]::SetEnvironmentVariable($name46,$caseOld46[$name46],'Process')}
}
$caseDeadline46=[DateTime]::UtcNow.AddSeconds(40)
do{
 if(Test-Path -LiteralPath (Join-Path $caseRun46 'evidence/native-host-error.json')){throw 'Native Host admission error retained in original file'}
 if(Test-Path -LiteralPath (Join-Path $caseRun46 'evidence/native-host-ready.json')){$caseReady46=Get-Content -Raw -LiteralPath (Join-Path $caseRun46 'evidence/native-host-ready.json')|ConvertFrom-Json -AsHashtable -DateKind String;break}
 $caseProcess46.Refresh();if($caseProcess46.HasExited){throw 'Current native Host exited before ready'}
 Start-Sleep -Milliseconds 100
}while([DateTime]::UtcNow -lt $caseDeadline46)
if(!$caseReady46 -or $caseReady46.outcome -ne 'ready' -or $caseReady46.host.pid -ne $caseProcess46.Id -or $caseReady46.occurrence -ne $caseOccurrence46 -or (Get-OwnedNativeState $caseReady46.host) -ne 'exact_live' -or (Get-OwnedNativeState $caseReady46.target) -ne 'exact_live'){throw 'Exact current native admission missing'}
if([long]$caseReady46.deadlineAt -ne $caseNativeDeadline46){throw 'Actual history native deadline mismatch'}
$caseOwner46=@{occurrence=$caseOccurrence46;runRoot=$caseRun46;runtime=(Join-Path $caseRun46 'runtime');project=$caseProject46;evidence=(Join-Path $caseRun46 'evidence');evidencePrefix=$casePrefix46;settlementEvidenceRoot=$caseEvidence46;port=$casePort46;host=$caseReady46.host;nativeTarget=$caseReady46.target;targetBirthAtMs=$caseReady46.targetBirthAtMs;owner=@{ProcessId=$caseReady46.target.pid;processInstanceID=$caseReady46.target.processInstanceID};observedProcessChain=@($caseReady46.target);authorityStaging='None; no model Task requested';purpose='Current credentialless complete original ordinary Session history; no Provider or Task rearm'}
$caseOwner46.nativeDeadlineAt=$caseNativeDeadline46
Write-OwnedLaunchFact (Join-Path $caseRun46 'launch-owner.json') $caseOwner46
Write-OwnedLaunchFact (Join-Path $caseEvidence46 ($casePrefix46+'-launch-owner.json')) $caseOwner46
$caseOwner46|ConvertTo-Json -Depth 6

Write-OwnedLaunchFact (Join-Path $caseRun46 'launcher.json') @{pid=$caseReady46.host.pid;processInstanceID=$caseReady46.host.processInstanceID;occurrence=$caseOccurrence46}
# Parent remains alive until actual foreground Host exit and production settled evidence; PID disappearance alone is insufficient.
while(!$caseProcess46.WaitForExit(500)){if(Test-Path -LiteralPath (Join-Path $caseRun46 'evidence/native-host-error.json')){throw 'Original native Host error retained; no physical completion claim'}}
$caseProcess46.WaitForExit()
$actualSettlement=Get-OwnedNativeSettlement $caseOwner46
if(!$actualSettlement){throw 'Host exited without full actual native/output/request settlement'}
if($caseProcess46.ExitCode -ne 0){throw 'Native Host exited nonzero; preserve original stdout/stderr'} 
Write-OwnedLaunchFact (Join-Path $caseEvidence46 ($casePrefix46+'-launcher-native-joined.json')) @{occurrence=$caseOccurrence46;host=$caseReady46.host;target=$caseReady46.target;settlement=$actualSettlement;exitCode=$caseProcess46.ExitCode;boundary='Actual foreground Host exit joined and production Handle.settled/output/request receipt bound; public pair settlement remains sole shutdown owner'}






