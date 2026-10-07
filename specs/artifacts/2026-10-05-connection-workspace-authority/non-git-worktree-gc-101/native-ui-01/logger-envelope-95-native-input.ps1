param([string]$RunRoot,[string]$EvidenceRoot,[ValidatePattern('^[a-z0-9-]+\.json$')][string]$FactName)
$ErrorActionPreference='Stop'
$log95RunRoot=[IO.Path]::GetFullPath($RunRoot)
$log95EvidenceRoot=[IO.Path]::GetFullPath($EvidenceRoot)
$log95FactName=$FactName
$log95Owner=Get-Content -Raw -LiteralPath (Join-Path $log95RunRoot 'launch-owner.json')|ConvertFrom-Json -AsHashtable -DateKind String
. (Join-Path $PSScriptRoot 'live-sol-launch.ps1') -FunctionsOnly
if([IO.Path]::GetFullPath($log95Owner.runRoot) -ne $log95RunRoot -or [IO.Path]::GetFullPath($log95Owner.settlementEvidenceRoot) -ne $log95EvidenceRoot){throw 'Exact logger scope authority mismatch'}
if((Get-OwnedNativeState $log95Owner.host) -ne 'exact_live' -or (Get-OwnedNativeState $log95Owner.nativeTarget) -ne 'exact_live'){throw 'Logger scope birth admission unavailable'}
$log95Startup=Get-Content -Raw -LiteralPath (Join-Path $log95RunRoot 'startup.json')|ConvertFrom-Json -AsHashtable -DateKind String
$log95Listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -eq $log95Owner.port)
if($log95Startup.outcome -ne 'listening' -or $log95Startup.occurrenceID -ne $log95Owner.occurrence -or $log95Startup.pid -ne $log95Owner.nativeTarget.pid -or $log95Startup.url -ne ('http://127.0.0.1:'+$log95Owner.port) -or $log95Listeners.Count -ne 1 -or $log95Listeners[0].OwningProcess -ne $log95Owner.nativeTarget.pid){throw 'Native ready is not HTTP listener authority'}
if(Test-Path -LiteralPath (Join-Path $log95EvidenceRoot $log95FactName)){throw 'Preserve original logger request facts'}
$log95Handler=[Net.Http.HttpClientHandler]::new()
$log95Handler.UseProxy=$false;$log95Handler.UseCookies=$false;$log95Handler.UseDefaultCredentials=$false
$log95Client=[Net.Http.HttpClient]::new($log95Handler)
$log95Client.Timeout=[TimeSpan]::FromSeconds(20)
$log95Requests=[Collections.Generic.List[object]]::new()
function InvokeLog95([string]$method,[string]$route,$body){
 $log95Uri='http://127.0.0.1:'+([string]$log95Owner.port)+$route+'?directory='+[Uri]::EscapeDataString($log95Owner.project)
 $log95Request=[Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::new($method),$log95Uri)
 $log95Request.Headers.Add('x-opencorvus-directory',$log95Owner.project)
 if($null -ne $body){$log95Request.Content=[Net.Http.StringContent]::new(($body|ConvertTo-Json -Depth 20 -Compress),[Text.Encoding]::UTF8,'application/json')}
 try{
  $log95Response=$log95Client.SendAsync($log95Request).GetAwaiter().GetResult()
  try{
   $log95Raw=$log95Response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
   $log95Headers=@{};foreach($log95Header in $log95Response.Headers){$log95Headers[$log95Header.Key]=$log95Header.Value};foreach($log95Header in $log95Response.Content.Headers){$log95Headers[$log95Header.Key]=$log95Header.Value}
   $log95Fact=@{method=$method;url=$log95Uri;requestHeaders=@{'x-opencorvus-directory'=$log95Owner.project};input=$body;status=[int]$log95Response.StatusCode;headers=$log95Headers;rawBody=$log95Raw;body=($log95Raw|ConvertFrom-Json -AsHashtable -DateKind String)}
   $log95Requests.Add($log95Fact)
   return $log95Fact
  }finally{$log95Response.Dispose()}
 }finally{$log95Request.Dispose()}
}
try{
 $log95Project=InvokeLog95 'GET' '/project/current' $null
 $log95Chat=InvokeLog95 'POST' '/coding/chat/session' @{}
 if($log95Chat.status -ne 201){throw 'Actual canonical Chat creation is unavailable; preserve response'}
 $log95Session=$log95Chat.body.session
 if($log95Session -isnot [hashtable] -or $log95Session.id -isnot [string] -or $log95Session.time -isnot [hashtable] -or $log95Session.projectID -ne $log95Project.body.id -or [IO.Path]::GetFullPath($log95Session.directory) -ne [IO.Path]::GetFullPath($log95Owner.project)){throw 'Actual coding Chat session envelope/Project authority unavailable'}
 $log95Input=@{entries=@(@{service='logger-envelope95-observation';level='warn';message='Logger subject chronology95';extra=@{time=$log95Session.time;service='subject-lifecycle';level='info';sessionID=$log95Session.id;logDomain='subject-lifecycle';observed='actual Chat lifecycle'}})}
 $log95Ingest=InvokeLog95 'POST' '/log' $log95Input
 if($log95Ingest.status -ne 200 -or $log95Ingest.body -ne $true){throw 'Actual public diagnostic ingestion unavailable'}
 Write-OwnedLaunchFact (Join-Path $log95EvidenceRoot $log95FactName) @{observedAtUtc=[DateTime]::UtcNow.ToString('o');occurrence=$log95Owner.occurrence;target=$log95Owner.nativeTarget;requests=$log95Requests.ToArray();qualifier='Actual canonical Chat creation and public diagnostic input; no model prompt or copied authority'}
}catch{
 Write-OwnedLaunchFact (Join-Path $log95EvidenceRoot ($log95FactName+'.failed.json')) @{occurrence=$log95Owner.occurrence;requests=$log95Requests.ToArray();error=$_.Exception.Message}
 throw
}finally{$log95Client.Dispose();$log95Handler.Dispose()}
