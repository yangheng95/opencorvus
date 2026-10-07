$ErrorActionPreference='Stop'
$nativeRun65='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-07/conversation-viewport-follow-65'
$nativeEvidence65='D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/build-observation-read-identity'
. (Join-Path $PSScriptRoot 'live-sol-launch.ps1') -FunctionsOnly
$nativeOwner65=Get-Content -Raw -LiteralPath (Join-Path $nativeRun65 'launch-owner.json')|ConvertFrom-Json -AsHashtable -DateKind String
if((Get-OwnedNativeState $nativeOwner65.host) -ne 'exact_live' -or (Get-OwnedNativeState $nativeOwner65.nativeTarget) -ne 'exact_live'){throw 'Exact owned65 target must be live'}
$client65=[Net.Http.HttpClient]::new();$client65.Timeout=[TimeSpan]::FromSeconds(20)
$facts65=[Collections.Generic.List[object]]::new()
function Read-Native65([string]$Route,[string]$Directory){
  $request65=[Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Get,('http://127.0.0.1:18024'+$Route))
  $request65.Headers.Add('x-opencorvus-directory',$Directory)
  $response65=$null
  try{
    $response65=$client65.SendAsync($request65).GetAwaiter().GetResult()
    $bytes65=$response65.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
    $headers65=@{};foreach($entry65 in $response65.Headers){$headers65[$entry65.Key]=$entry65.Value -join ','};foreach($entry65 in $response65.Content.Headers){$headers65[$entry65.Key]=$entry65.Value -join ','}
    return @{status=[int]$response65.StatusCode;bytes=$bytes65.Length;text=[Text.UTF8Encoding]::new($false,$true).GetString($bytes65);headers=$headers65}
  }finally{if($response65){$response65.Dispose()};$request65.Dispose()}
}
try{
  $route65='/task/tsk_g00VXJJVS500QnIDtJVs/build-observation/art_hiysXi5kyLJ7ciXBAtLV/content'
  foreach($item65 in @(@{file='hello.txt';text="Hello from a formal Task.`n";bytes=26},@{file='notes.txt';text=("Notes from a formal Task.`n"*20);bytes=520})){
    $full65=Read-Native65 ($route65+'?file='+$item65.file+'&side=after&offset=0&length='+$item65.bytes) $nativeOwner65.project
    $fullExpected65=$full65.status -eq 200 -and $full65.bytes -eq $item65.bytes -and $full65.text -ceq $item65.text -and $full65.headers['x-opencorvus-object-bytes'] -eq [string]$item65.bytes -and $full65.headers['x-opencorvus-content-complete'] -eq '1' -and $full65.headers['content-range'] -eq ('bytes 0-'+($item65.bytes-1)+'/'+$item65.bytes)
    $partial65=Read-Native65 ($route65+'?file='+$item65.file+'&side=after&offset=3&length=7') $nativeOwner65.project
    $partialExpected65=$partial65.status -eq 200 -and $partial65.bytes -eq 7 -and $partial65.text -ceq $item65.text.Substring(3,7) -and $partial65.headers['content-range'] -eq ('bytes 3-9/'+$item65.bytes) -and $partial65.headers['x-opencorvus-content-complete'] -eq '0' -and $partial65.headers['x-opencorvus-git-object'] -eq $full65.headers['x-opencorvus-git-object']
    $facts65.Add(@{file=$item65.file;full=$full65;partial=$partial65;expectedFull=$fullExpected65;expectedPartial=$partialExpected65})
  }
  $otherDirectory65='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-07/live-sol-publication-50/runtime/data/projects/2026/10/07/e41f1632-d671-4acb-8e62-fef391432ef3'
  if(!(Test-Path -LiteralPath $otherDirectory65 -PathType Container)){throw 'Actual retained other Project must exist'}
  $cross65=Read-Native65 ($route65+'?file=hello.txt&side=after&offset=0&length=26') $otherDirectory65
  $crossBody65=$cross65.text|ConvertFrom-Json -AsHashtable -DateKind String
  $config65=Read-Native65 '/session/ses_-zUSggUQgzzprQcl946c/config' $nativeOwner65.project
  $configBody65=$config65.text|ConvertFrom-Json -AsHashtable -DateKind String
  $qualified65=@($facts65|Where-Object {!$_.expectedFull -or !$_.expectedPartial}).Count -eq 0 -and $cross65.status -eq 404 -and $crossBody65.name -eq 'NotFoundError' -and $config65.status -eq 400 -and $configBody65.name -eq 'ProviderModelNotFoundError'
  Write-OwnedLaunchFact (Join-Path $nativeEvidence65 'actual-65-native-reads.json') @{observedAtUtc=[DateTime]::UtcNow.ToString('o');occurrence=$nativeOwner65.occurrence;host=$nativeOwner65.host;target=$nativeOwner65.nativeTarget;taskID='tsk_g00VXJJVS500QnIDtJVs';artifactID='art_hiysXi5kyLJ7ciXBAtLV';reads=$facts65.ToArray();crossProject=$cross65;config=$config65;qualified=$qualified65;authorityStaging='None; no Provider/Task submission'}
  if(!$qualified65){throw 'Exact native immutable read contracts failed; preserve receipt'}
  Write-Output 'Actual65 native: hello26B/notes520B complete and7B ranges/object identities; crossProject typed404; config400.'
}finally{$client65.Dispose()}
