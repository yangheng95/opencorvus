$ErrorActionPreference='Stop'
$caseRoot=[IO.Path]::GetFullPath('specs/artifacts/2026-10-05-connection-workspace-authority/diff-request-stability')
function ReadCaseJson([string]$name){ Get-Content -LiteralPath (Join-Path $caseRoot $name) -Raw | ConvertFrom-Json -AsHashtable -DateKind String }
$monName='runtime-evidence-40/task-observation-49880-98f0c9a2-2ad2-43ec-b851-92d91a19bb3a-807.json'
$mon=ReadCaseJson $monName
$facts=ReadCaseJson 'actual-40-readonly-tool-facts.json'
$base=ReadCaseJson 'actual-40-readonly-facts.json'
$audit=ReadCaseJson 'diff-request-40-final-provider-audit.json'
$closure=ReadCaseJson 'diff-request-40-physical-terminal-and-pair-cleanup.json'
$requests=@{}; $outcomes=@{}; $results=@{}
foreach($r in $facts.requests){$r.data=$r.data | ConvertFrom-Json -AsHashtable -DateKind String; $requests[$r.id]=$r}
foreach($r in $facts.outcomes){$r.data=$r.data | ConvertFrom-Json -AsHashtable -DateKind String; $outcomes[$r.request_part_id]=$r}
foreach($r in $facts.results){$results[$r.requestID]=$r}
$materialized=@(); $checks=@(); $publications=@()
foreach($req in $facts.requests){
  $result=$results[$req.id]; $outcome=$outcomes[$req.id]
  if($req.data.tool -eq 'artifact_read' -and @($req.data.input.reads | Where-Object delivery -eq 'materialized_file').Count){
    $response=$result.output | ConvertFrom-Json -AsHashtable -DateKind String
    foreach($rr in $response.results){
      $v=$rr.value; $file=Get-Item -LiteralPath $v.materialized_path
      [byte[]]$expected=if($v.locator.ref.path -eq 'hello.txt'){[Text.Encoding]::UTF8.GetBytes("Hello from a formal Task.`n")}elseif($v.locator.ref.path -eq 'notes.txt'){[Text.Encoding]::UTF8.GetBytes(("Notes from a formal Task.`n"*8192))}else{throw 'Unexpected actual materialized path'}
      $bytes=[IO.File]::ReadAllBytes($file.FullName)
      $equal=[Linq.Enumerable]::SequenceEqual[byte]($bytes,$expected)
      if(!$equal -or !$v.complete -or $v.total_bytes -ne $expected.Length -or !($file.Attributes -band [IO.FileAttributes]::ReadOnly)){throw 'Actual materialized qualification failed'}
      $copyName='actual-40-materialized-'+$v.locator.ref.path
      if(!(Test-Path -LiteralPath (Join-Path $caseRoot $copyName))){[IO.File]::Copy($file.FullName,(Join-Path $caseRoot $copyName))}
      $materialized+=@{requestID=$req.id;messageID=$req.message_id;sessionID=$req.session_id;request=$req.data;outcome=$outcome.data;response=$response;actualBytes=$bytes.Length;exactBytes=$equal;attributes=$file.Attributes.ToString();evidenceFile=$copyName}
    }
  }
  if($req.data.tool -eq 'bash'){$checks+=@{requestID=$req.id;messageID=$req.message_id;sessionID=$req.session_id;request=$req.data;outcome=$outcome.data;output=$result.output}}
  if($req.data.tool -eq 'artifact_publish'){$publications+=@{requestID=$req.id;messageID=$req.message_id;sessionID=$req.session_id;input=$req.data.input;outcome=$outcome.data;output=$result.output}}
}
$download=ReadCaseJson 'actual-40-notes-download-result.json'
$downloadBytes=[IO.File]::ReadAllBytes($download.file)
if(![Linq.Enumerable]::SequenceEqual[byte]($downloadBytes,[Text.Encoding]::UTF8.GetBytes(("Notes from a formal Task.`n"*8192)))){throw 'Actual download qualification failed'}
[IO.File]::Copy($download.file,(Join-Path $caseRoot 'actual-40-downloaded-notes.txt'))
$retry=@($base.events | Where-Object id -eq 'pev_g0VXIWu0q00Q4qvkicBO')
$aborted=@($audit.requests | Where-Object {$_.response_reader.terminal.kind -eq 'aborted'} | ForEach-Object {@{model=$_.model;streaming=$_.streaming;status=$_.status;responseReader=$_.response_reader;actorBinding='unknown; no formal stream request identity; array position and timestamps do not bind actor'}})
$whole=[DateTimeOffset]::Parse($closure.observedAtUtc).ToUnixTimeMilliseconds()-$mon.lifecycle.openedAt
$qualification=@{observedAt=[DateTime]::UtcNow.ToString('o');monitorSource=$monName;lifecycle=$mon.lifecycle;taskDurationMs=$mon.lifecycle.terminalAt-$mon.lifecycle.openedAt;wholeDurationMs=$whole;fixedWholeMaximumMs=900000;canonicalCounts=@{requests=$facts.requests.Count;progress=$facts.progress.Count;outcomes=$facts.outcomes.Count;results=$facts.results.Count};materializedReads=$materialized;actualBashChecks=$checks;publications=$publications;download=$download;provider=@{requests=$audit.requests.Count;maxRequests=$audit.maxRequests;models=@($audit.requests | ForEach-Object model | Sort-Object -Unique);streamedCount=@($audit.requests | Where-Object streaming -eq $true).Count;http200Count=@($audit.requests | Where-Object status -eq 200).Count;eofCount=@($audit.requests | Where-Object {$_.response_reader.terminal.kind -eq 'eof'}).Count;aborted=$aborted};logicalRetry=$retry;nativeClosure=$closure;independentClosure=(ReadCaseJson 'actual-40-root-closure.json');manualUI=@{notesFirst='actual-40-notes-first.png';notesAfterGenuineUpdates='actual-40-notes-update.png';helloKeyboard='actual-40-hello-keyboard.png';notesKeyboardReturn='actual-40-notes-keyboard-return.png';downloadCorrect='actual-40-formal-notes-download-correct.png';originalCopyFilenameAction='actual-40-formal-notes-download.png';result='Root manually inspected real notes/hello body, focused current row through genuine verifier updates and Up/Space/Down/Return; formal notes download exact';unqualified='Original39 paint cause, source/authority rotation, error/ambiguous targets, virtual threshold and broader recovery/restart/Mission/parallel matrix'};qualification='Current Diff UI and actual resource/delivery pass within original bounds; one original producer semantic-idle retry and one actual script NameError recover and are retained; backend stream cause remains unknown'}
$output=Join-Path $caseRoot 'actual-40-real-qualification.json'
$stream=[IO.File]::Open($output,[IO.FileMode]::CreateNew)
try{$encoded=[Text.Encoding]::UTF8.GetBytes(($qualification | ConvertTo-Json -Depth 60));$stream.Write($encoded,0,$encoded.Length)}finally{$stream.Dispose()}
@{materializedReads=$materialized.Count;publications=$publications.Count;bashChecks=$checks.Count;taskDurationMs=$qualification.taskDurationMs;wholeDurationMs=$whole;provider=$qualification.provider;retryCount=$retry.Count}|ConvertTo-Json -Depth 8
