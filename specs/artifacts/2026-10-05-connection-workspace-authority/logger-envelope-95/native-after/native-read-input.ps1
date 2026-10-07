param([string]$RunRoot,[string]$EvidenceRoot)
$ErrorActionPreference='Stop'
$read95Run=[IO.Path]::GetFullPath($RunRoot)
$read95Evidence=[IO.Path]::GetFullPath($EvidenceRoot)
$read95Owner=Get-Content -Raw -LiteralPath (Join-Path $read95Run 'launch-owner.json')|ConvertFrom-Json -AsHashtable -DateKind String
. (Join-Path $PSScriptRoot 'live-sol-launch.ps1') -FunctionsOnly
if([IO.Path]::GetFullPath($read95Owner.runRoot) -ne $read95Run -or [IO.Path]::GetFullPath($read95Owner.settlementEvidenceRoot) -ne $read95Evidence -or (Get-OwnedNativeState $read95Owner.host) -ne 'exact_live' -or (Get-OwnedNativeState $read95Owner.nativeTarget) -ne 'exact_live'){throw 'Exact current logger process ownership required'}
$read95Startup=Get-Content -Raw -LiteralPath (Join-Path $read95Run 'startup.json')|ConvertFrom-Json -AsHashtable -DateKind String
$read95Listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -eq $read95Owner.port)
if($read95Startup.outcome -ne 'listening' -or $read95Startup.occurrenceID -ne $read95Owner.occurrence -or $read95Startup.pid -ne $read95Owner.nativeTarget.pid -or $read95Listeners.Count -ne 1 -or $read95Listeners[0].OwningProcess -ne $read95Owner.nativeTarget.pid){throw 'Exact logger HTTP admission required'}
$read95Output=Join-Path $read95Evidence 'actual-native-reads-and-export.json'
$read95Zip=Join-Path $read95Evidence 'actual-support-export.zip'
if((Test-Path -LiteralPath $read95Output) -or (Test-Path -LiteralPath $read95Zip)){throw 'Preserve original native read/export facts'}
$read95Handler=[Net.Http.HttpClientHandler]::new();$read95Handler.UseProxy=$false;$read95Handler.UseCookies=$false;$read95Handler.UseDefaultCredentials=$false
$read95Client=[Net.Http.HttpClient]::new($read95Handler);$read95Client.Timeout=[TimeSpan]::FromSeconds(30)
$read95Facts=[Collections.Generic.List[object]]::new()
$read95Error=$null
try{
 foreach($read95Route in @('/log?n=1000','/log/files','/log?file=owned95-missing.log&n=10','/log/export')){
  $read95Separator=if($read95Route.Contains('?')){'&'}else{'?'}
  $read95Uri='http://127.0.0.1:'+([string]$read95Owner.port)+$read95Route+$read95Separator+'directory='+[Uri]::EscapeDataString($read95Owner.project)
  $read95Request=[Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Get,$read95Uri)
  $read95Request.Headers.Add('x-opencorvus-directory',$read95Owner.project)
  try{
   $read95Response=$read95Client.SendAsync($read95Request).GetAwaiter().GetResult()
   try{
    $read95Headers=@{};foreach($read95Header in $read95Response.Headers){$read95Headers[$read95Header.Key]=@($read95Header.Value)};foreach($read95Header in $read95Response.Content.Headers){$read95Headers[$read95Header.Key]=@($read95Header.Value)}
    $read95Bytes=$read95Response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
    $read95Fact=@{method='GET';url=$read95Uri;status=[int]$read95Response.StatusCode;headers=$read95Headers;byteCount=$read95Bytes.Length}
    if($read95Route -eq '/log/export' -and [int]$read95Response.StatusCode -eq 200){[IO.File]::WriteAllBytes($read95Zip,$read95Bytes);$read95Fact.file=$read95Zip}
    else{$read95Fact.rawBody=[Text.Encoding]::UTF8.GetString($read95Bytes);$read95Fact.body=$read95Fact.rawBody|ConvertFrom-Json -AsHashtable -DateKind String}
    $read95Facts.Add($read95Fact)
   }finally{$read95Response.Dispose()}
  }finally{$read95Request.Dispose()}
 }
}catch{$read95Error=$_.Exception.Message}finally{
 $read95Client.Dispose();$read95Handler.Dispose()
 Write-OwnedLaunchFact $read95Output @{observedAtUtc=[DateTime]::UtcNow.ToString('o');occurrence=$read95Owner.occurrence;target=$read95Owner.nativeTarget;reads=$read95Facts.ToArray();error=$read95Error;qualifier='Actual current declared log routes and binary export; no restart/Provider/model prompt'}
}
if($read95Error){throw $read95Error}
$read95Facts|ForEach-Object{[pscustomobject]@{status=$_.status;url=$_.url;byteCount=$_.byteCount}}
