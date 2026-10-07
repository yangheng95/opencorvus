param([string]$CaseRun,[string]$CaseEvidence,[ValidatePattern('^[a-z0-9-]+\.json$')][string]$FactName='actual-native-package-imports.json')
$ErrorActionPreference='Stop'
$run89=[IO.Path]::GetFullPath($CaseRun)
$evidence89=[IO.Path]::GetFullPath($CaseEvidence)
. (Join-Path $PSScriptRoot 'live-sol-launch.ps1') -FunctionsOnly
$owner89=Get-Content -Raw -LiteralPath (Join-Path $run89 'launch-owner.json')|ConvertFrom-Json -AsHashtable -DateKind String
if((Get-OwnedNativeState $owner89.host) -ne 'exact_live' -or (Get-OwnedNativeState $owner89.nativeTarget) -ne 'exact_live'){throw 'Exact owned native admission required'}
$startup89=Get-Content -Raw -LiteralPath (Join-Path $run89 'startup.json')|ConvertFrom-Json -AsHashtable -DateKind String
$listeners89=@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -eq $owner89.port)
if($startup89.outcome -ne 'listening' -or $startup89.occurrenceID -ne $owner89.occurrence -or $startup89.pid -ne $owner89.nativeTarget.pid -or $startup89.url -ne ('http://127.0.0.1:'+$owner89.port) -or $listeners89.Count -ne 1 -or $listeners89[0].OwningProcess -ne $owner89.nativeTarget.pid){throw 'Exact current HTTP listening admission required'}
if(Test-Path -LiteralPath (Join-Path $evidence89 $FactName)){throw 'Preserve the previous import receipt'}
$authored89=Get-Content -Raw -LiteralPath (Join-Path $evidence89 'actual-sdk-authoring.json')|ConvertFrom-Json -AsHashtable -DateKind String
$expected89=[IO.Path]::GetFullPath('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-07/expert-activation-authoring-89')
if([IO.Path]::GetFullPath($authored89.outputRoot) -ne $expected89){throw 'Exact owned authoring root required'}
$handler89=[Net.Http.HttpClientHandler]::new();$handler89.UseProxy=$false;$handler89.UseCookies=$false;$handler89.UseDefaultCredentials=$false
$client89=[Net.Http.HttpClient]::new($handler89);$client89.Timeout=[TimeSpan]::FromSeconds(45)
$reads89=[Collections.Generic.List[object]]::new();$failure89=$null
try{
 foreach($source89 in $authored89.sources){
  $sourcePath89=[IO.Path]::GetFullPath($source89.sourceDirectory)
  if(!$sourcePath89.StartsWith($expected89+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or !(Test-Path -LiteralPath (Join-Path $sourcePath89 'expert-squad.jsonc'))){throw 'Owned SDK source containment failed'}
  $path89='/expert-squad/import-folder?directory='+[Uri]::EscapeDataString([string]$owner89.project)
  $input89=@{sourceDirectory=$sourcePath89;installationScope=$source89.installationScope}
  $request89=[Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Post,('http://127.0.0.1:'+$owner89.port+$path89))
  $request89.Headers.Add('x-opencorvus-directory',[string]$owner89.project)
  $request89.Content=[Net.Http.StringContent]::new(($input89|ConvertTo-Json -Compress),[Text.Encoding]::UTF8,'application/json')
  try{
   $response89=$client89.SendAsync($request89).GetAwaiter().GetResult()
   try{
    $headers89=@{};foreach($header89 in $response89.Headers){$headers89[$header89.Key]=@($header89.Value)}
    $body89=$response89.Content.ReadAsStringAsync().GetAwaiter().GetResult()|ConvertFrom-Json -AsHashtable -DateKind String
    $reads89.Add(@{method='POST';path=$path89;input=$input89;status=[int]$response89.StatusCode;headers=$headers89;body=$body89})
    if([int]$response89.StatusCode -ne 200){throw ('Actual import returned '+[int]$response89.StatusCode)}
   }finally{$response89.Dispose()}
  }finally{$request89.Dispose()}
 }
}catch{$failure89=$_.Exception.Message}finally{
 $client89.Dispose();$handler89.Dispose()
 Write-OwnedLaunchFact (Join-Path $evidence89 $FactName) @{observedAtUTC=[DateTime]::UtcNow.ToString('o');occurrence=$owner89.occurrence;startup=$startup89;listeners=$listeners89|Select-Object LocalAddress,LocalPort,OwningProcess;project=$owner89.project;reads=$reads89.ToArray();failure=$failure89;authority='No credentials/models or model execution'}
}
$reads89|ForEach-Object{[PSCustomObject]@{status=$_.status;scope=$_.body.after.installationScope;id=$_.body.after.id;operation=$_.body.operation}}
if($failure89){throw $failure89}
