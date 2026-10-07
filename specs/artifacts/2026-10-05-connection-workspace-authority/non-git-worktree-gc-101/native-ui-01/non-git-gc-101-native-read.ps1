param([string]$RunRoot,[string]$EvidenceRoot)
$ErrorActionPreference='Stop'
$gc101Run=[IO.Path]::GetFullPath($RunRoot)
$gc101Evidence=[IO.Path]::GetFullPath($EvidenceRoot)
$gc101Owner=Get-Content -Raw -LiteralPath (Join-Path $gc101Run 'launch-owner.json')|ConvertFrom-Json -AsHashtable -DateKind String
. (Join-Path $PSScriptRoot 'live-sol-launch.ps1') -FunctionsOnly
if([IO.Path]::GetFullPath($gc101Owner.runRoot) -ne $gc101Run -or [IO.Path]::GetFullPath($gc101Owner.settlementEvidenceRoot) -ne $gc101Evidence -or $gc101Owner.port -ne 18049){throw 'Exact GC101 scope mismatch'}
if((Get-OwnedNativeState $gc101Owner.host) -ne 'exact_live' -or (Get-OwnedNativeState $gc101Owner.nativeTarget) -ne 'exact_live'){throw 'GC101 exact native births unavailable'}
$gc101Startup=Get-Content -Raw -LiteralPath (Join-Path $gc101Run 'startup.json')|ConvertFrom-Json -AsHashtable -DateKind String
$gc101Listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -eq $gc101Owner.port)
if($gc101Startup.outcome -ne 'listening' -or $gc101Startup.occurrenceID -ne $gc101Owner.occurrence -or $gc101Startup.pid -ne $gc101Owner.nativeTarget.pid -or $gc101Listeners.Count -ne 1 -or $gc101Listeners[0].OwningProcess -ne $gc101Owner.nativeTarget.pid){throw 'GC101 current HTTP listener unavailable'}
$gc101Handler=[Net.Http.HttpClientHandler]::new()
$gc101Handler.UseProxy=$false;$gc101Handler.UseCookies=$false;$gc101Handler.UseDefaultCredentials=$false
$gc101Client=[Net.Http.HttpClient]::new($gc101Handler)
$gc101Client.Timeout=[TimeSpan]::FromSeconds(20)
$gc101Url='http://127.0.0.1:18049/project/current/cleanup-candidates?directory='+[Uri]::EscapeDataString($gc101Owner.project)
$gc101Request=[Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Get,$gc101Url)
$gc101Request.Headers.Add('x-opencorvus-directory',$gc101Owner.project)
try{
 $gc101Response=$gc101Client.SendAsync($gc101Request).GetAwaiter().GetResult()
 try{
  $gc101Raw=$gc101Response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  $gc101Headers=@{};foreach($gc101Header in $gc101Response.Headers){$gc101Headers[$gc101Header.Key]=$gc101Header.Value}
  $gc101Body=$gc101Raw|ConvertFrom-Json -AsHashtable -DateKind String
  $gc101Fact=@{observedAtUtc=[DateTime]::UtcNow.ToString('o');occurrence=$gc101Owner.occurrence;target=$gc101Owner.nativeTarget;method='GET';url=$gc101Url;requestHeaders=@{'x-opencorvus-directory'=$gc101Owner.project};status=[int]$gc101Response.StatusCode;headers=$gc101Headers;rawBody=$gc101Raw;body=$gc101Body;retainedFile=@{path=(Join-Path $gc101Owner.project 'keep.txt');text=[IO.File]::ReadAllText((Join-Path $gc101Owner.project 'keep.txt'))}}
  Write-OwnedLaunchFact (Join-Path $gc101Evidence 'actual-cleanup-http.json') $gc101Fact
  $gc101Fact|ConvertTo-Json -Depth 8
  if($gc101Fact.status -ne 200 -or @($gc101Body.worktreeGCPreservations|Where-Object{ $_.reason -eq 'non-git-project' -and $_.code -eq 'NON_GIT_PROJECT' -and $_.operation -eq 'inspect-worktree-gc'}).Count -ne 1){throw 'GC101 explicit current non-Git preservation contract unavailable'}
 }finally{$gc101Response.Dispose()}
}finally{$gc101Request.Dispose();$gc101Client.Dispose();$gc101Handler.Dispose()}
