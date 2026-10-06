param([Parameter(Mandatory=$true)][string]$RunRoot,[Parameter(Mandatory=$true)][string]$EvidenceRoot)
$ErrorActionPreference='Stop'
$taskRun=[IO.Path]::GetFullPath($RunRoot)
$taskEvidence=[IO.Path]::GetFullPath($EvidenceRoot)
$taskLaunch=Get-Content -LiteralPath (Join-Path $taskRun 'launch.json') -Raw|ConvertFrom-Json
$taskStartupPath=Join-Path $taskRun 'startup.json'
$taskStartupDeadline=[DateTime]::UtcNow.AddSeconds(30)
while(!(Test-Path -LiteralPath $taskStartupPath)){
  if([DateTime]::UtcNow -ge $taskStartupDeadline){throw 'Owned startup receipt did not arrive within 30 seconds'}
  Start-Sleep -Milliseconds 250
}
$taskStartup=Get-Content -LiteralPath $taskStartupPath -Raw|ConvertFrom-Json
$taskPrefix=$taskLaunch.evidencePrefix
$taskOutput=Join-Path $taskEvidence ($taskPrefix+'-owner.json')
if(Test-Path -LiteralPath $taskOutput){throw 'Preserve existing owner observation'}
$taskAll=@(Get-CimInstance Win32_Process -ErrorAction Stop)
$taskCurrent=$taskAll|Where-Object ProcessId -eq $taskStartup.pid|Select-Object -First 1
if(!$taskCurrent){throw 'Current listener occurrence missing'}
$taskListener=$taskCurrent|Select-Object ProcessId,ParentProcessId,CreationDate,ExecutablePath,CommandLine
$taskOwners=[Collections.Generic.List[object]]::new()
$taskEarlierParentCandidates=[Collections.Generic.List[object]]::new()
while($taskCurrent){
  $taskOwners.Add(($taskCurrent|Select-Object ProcessId,ParentProcessId,CreationDate,ExecutablePath,CommandLine))
  if($taskCurrent.ProcessId -eq $taskLaunch.launcher.ProcessId){break}
  $taskParentID=$taskCurrent.ParentProcessId
  $taskCurrent=$taskAll|Where-Object ProcessId -eq $taskParentID|Select-Object -First 1
}
if(!$taskCurrent -or $taskCurrent.ProcessId -ne $taskLaunch.launcher.ProcessId -or ([DateTime]$taskCurrent.CreationDate).ToUniversalTime() -ne ([DateTime]$taskLaunch.launcher.CreationDate).ToUniversalTime() -or $taskCurrent.CommandLine -ne $taskLaunch.launcher.CommandLine){throw 'Exact launcher ancestor mismatch'}
do{
  $taskAdded=$false
  foreach($taskProcess in $taskAll){
    $taskParent=$taskOwners|Where-Object ProcessId -eq $taskProcess.ParentProcessId|Select-Object -First 1
    if(!$taskParent -or @($taskOwners|Where-Object ProcessId -eq $taskProcess.ProcessId).Count){continue}
    if(([DateTime]$taskProcess.CreationDate).ToUniversalTime() -lt ([DateTime]$taskParent.CreationDate).ToUniversalTime()){
      $taskEarlierParentCandidates.Add([ordered]@{candidate=$taskProcess|Select-Object ProcessId,ParentProcessId,CreationDate,ExecutablePath;currentParent=$taskParent|Select-Object ProcessId,CreationDate;reason='Candidate predates current parent occurrence'})
      continue
    }
    $taskOwners.Add(($taskProcess|Select-Object ProcessId,ParentProcessId,CreationDate,ExecutablePath,CommandLine))
    $taskAdded=$true
  }
}while($taskAdded)
$taskPort=$taskLaunch.port
$taskPorts=@(Get-NetTCPConnection -ErrorAction Stop|Where-Object{$_.State -eq 'Listen' -and $_.LocalPort -eq $taskPort})
if($taskPorts.Count -ne 1 -or $taskPorts[0].OwningProcess -ne $taskListener.ProcessId -or $taskStartup.occurrenceID -ne $taskLaunch.occurrence){throw 'Exact occurrence/port mismatch'}
$taskBase=[Uri]('http://localhost:'+$taskPort+'/ui/')
$taskHealth=Invoke-WebRequest -UseBasicParsing -Uri ('http://127.0.0.1:'+$taskPort+'/global/health') -TimeoutSec 15
$taskUi=Invoke-WebRequest -UseBasicParsing -Uri $taskBase -TimeoutSec 15
$taskAssetReceipts=@()
foreach($taskMatch in [regex]::Matches($taskUi.Content,'(?:src|href)="([^"\s]*assets/[^"\s]+)"')){
  $taskAssetUri=[Uri]::new($taskBase,$taskMatch.Groups[1].Value)
  $taskAssetResponse=Invoke-WebRequest -UseBasicParsing -Uri $taskAssetUri -TimeoutSec 15
  $taskAssetReceipts += [ordered]@{url=$taskAssetUri.AbsoluteUri;status=[int]$taskAssetResponse.StatusCode;bytes=$taskAssetResponse.RawContentLength}
}
[ordered]@{evidencePrefix=$taskPrefix;observedAtUtc=[DateTime]::UtcNow.ToString('o');runRoot=$taskRun;runtime=$taskLaunch.runtime;project=$taskLaunch.project;port=$taskPort;occurrence=$taskLaunch.occurrence;listener=$taskListener;owners=@($taskOwners);excludedEarlierParentCandidates=@($taskEarlierParentCandidates);listeners=$taskPorts|Select-Object LocalAddress,LocalPort,OwningProcess;health=[ordered]@{status=[int]$taskHealth.StatusCode;body=$taskHealth.Content|ConvertFrom-Json};uiStatus=[int]$taskUi.StatusCode;assets=$taskAssetReceipts;purpose='Original Task history/manual presentation only; no new model input'}|ConvertTo-Json -Depth 12|Set-Content -LiteralPath $taskOutput -Encoding utf8
Copy-Item -LiteralPath (Join-Path $taskRun 'startup.json') -Destination (Join-Path $taskEvidence ($taskPrefix+'-startup.json'))
Copy-Item -LiteralPath (Join-Path $taskRun 'launch.json') -Destination (Join-Path $taskEvidence ($taskPrefix+'-launch.json'))
[ordered]@{evidence=$taskOutput;owners=$taskOwners.ProcessId;port=$taskPort;assets=$taskAssetReceipts}|ConvertTo-Json -Depth 5
