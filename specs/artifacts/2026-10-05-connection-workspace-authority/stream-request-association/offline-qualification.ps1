$ErrorActionPreference='Stop'
$caseRoot=[IO.Path]::GetFullPath('specs/artifacts/2026-10-05-connection-workspace-authority/stream-request-association')
function ReadCaseJson([string]$name){Get-Content -LiteralPath (Join-Path $caseRoot $name) -Raw | ConvertFrom-Json -AsHashtable -DateKind String}
$audit=ReadCaseJson 'stream-request-41-final-provider-audit.json'
$facts=ReadCaseJson 'actual-41-readonly-facts.json'
$monFiles=@(Get-ChildItem -LiteralPath (Join-Path $caseRoot 'runtime-evidence-41') -File -Filter 'task-observation-*.json' | Sort-Object {[int]($_.BaseName -replace '^.*-','')} -Descending)
$mon=Get-Content -LiteralPath $monFiles[0].FullName -Raw | ConvertFrom-Json -AsHashtable -DateKind String
$physical=ReadCaseJson 'stream-request-41-physical-terminal-and-pair-cleanup.json'
$joins=@()
foreach($req in $audit.requests){
  $context=$req.response_reader.requestContext
  $sessions=@($facts.sessions | Where-Object id -eq $context.sessionID)
  if($req.response_reader.identityState -ne 'observed' -or $sessions.Count -ne 1 -or $req.model -ne $context.streamRequest.apiModelID -or !$req.streaming -or $req.status -ne 200 -or $req.response_reader.terminal.kind -ne 'eof'){throw 'Actual formal association or stream qualification failed'}
  $messages=@($facts.messages | Where-Object id -eq $context.streamRequest.requestID)
  $kind=if($messages.Count){'persisted real Message'}elseif($context.streamRequest.requestID -eq $facts.selected.taskID){'actual Task occurrence input to internal memory participant'}else{throw 'Unknown actual causal request identity'}
  $joins+=@{actualRequest=$req;session=$sessions[0];matchingMessageIDs=@($messages | ForEach-Object id);requestIdentityKind=$kind}
}
$qualification=@{observedAt=[DateTime]::UtcNow.ToString('o');lifecycle=$mon.lifecycle;taskDurationMs=$mon.lifecycle.terminalAt-$mon.lifecycle.openedAt;wholeDurationMs=[DateTimeOffset]::Parse($physical.observedAtUtc).ToUnixTimeMilliseconds()-$mon.lifecycle.openedAt;wholeMaximumMs=900000;monitorSource=$monFiles[0].Name;requests=$joins;nativeClosure=$physical;independentClosure=(ReadCaseJson 'actual-41-root-closure.json');ui=@{screenshot='actual-41-completed.png';result='Root manually sees Completed10s and genuine required response; no files requested; own tab22 closed before shutdown'};qualification='actual four streamed Sol HTTP200 exact bound responses carry immutable formal caller and actual Session, all EOF; preflight memory/chat share real Session/request with distinct executing agents; Task memory/orchestrator separate actual identities; historical23/24/40 binding not recovered; semantic SDK/retry/restart/vendor matrices remain unknown'}
$stream=[IO.File]::Open((Join-Path $caseRoot 'actual-41-real-qualification.json'),[IO.FileMode]::CreateNew)
try{$bytes=[Text.Encoding]::UTF8.GetBytes(($qualification | ConvertTo-Json -Depth 45));$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
@{taskDurationMs=$qualification.taskDurationMs;wholeDurationMs=$qualification.wholeDurationMs;requests=$joins.Count;identityKinds=@($joins | ForEach-Object requestIdentityKind)}|ConvertTo-Json -Depth 5
