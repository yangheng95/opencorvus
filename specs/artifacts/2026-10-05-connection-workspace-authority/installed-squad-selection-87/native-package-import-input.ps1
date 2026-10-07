param([string]$CaseRun,[string]$CaseEvidence)
$ErrorActionPreference='Stop'
$taskRun87=[IO.Path]::GetFullPath($CaseRun)
$taskEvidence87=[IO.Path]::GetFullPath($CaseEvidence)
. (Join-Path $PSScriptRoot 'live-sol-launch.ps1') -FunctionsOnly
$taskOwner87=Get-Content -Raw -LiteralPath (Join-Path $taskRun87 'launch-owner.json')|ConvertFrom-Json -AsHashtable -DateKind String
if((Get-OwnedNativeState $taskOwner87.host) -ne 'exact_live' -or (Get-OwnedNativeState $taskOwner87.nativeTarget) -ne 'exact_live'){throw 'Exact owned native authority required'}
$taskAuthor87=Join-Path $taskRun87 'authoring'
$taskSources87=@(1..21|ForEach-Object{Join-Path $taskAuthor87 ('selection-squad-'+([string]$_).PadLeft(3,'0'))})
foreach($taskSource87 in $taskSources87){if(!(Test-Path -LiteralPath (Join-Path $taskSource87 'expert-squad.jsonc'))){throw 'Actual SDK authoring source required'}}
$taskHandler87=[Net.Http.HttpClientHandler]::new();$taskHandler87.UseProxy=$false;$taskHandler87.UseCookies=$false;$taskHandler87.UseDefaultCredentials=$false
$taskClient87=[Net.Http.HttpClient]::new($taskHandler87);$taskClient87.Timeout=[TimeSpan]::FromSeconds(45)
$taskReads87=[Collections.Generic.List[object]]::new();$taskFailure87=$null
try {
 foreach($taskSource87 in $taskSources87){
  $taskPath87='/expert-squad/import-folder?directory='+[Uri]::EscapeDataString([string]$taskOwner87.project)
  $taskInput87=@{sourceDirectory=$taskSource87;installationScope='project'}
  $taskRequest87=[Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Post,('http://127.0.0.1:'+[string]$taskOwner87.port+$taskPath87))
  $taskRequest87.Headers.Add('x-opencorvus-directory',[string]$taskOwner87.project)
  $taskRequest87.Content=[Net.Http.StringContent]::new(($taskInput87|ConvertTo-Json -Compress),[Text.Encoding]::UTF8,'application/json')
  try {
   $taskResponse87=$taskClient87.SendAsync($taskRequest87).GetAwaiter().GetResult()
   try {
    $taskHeaders87=@{};foreach($taskHeader87 in $taskResponse87.Headers){$taskHeaders87[$taskHeader87.Key]=@($taskHeader87.Value)}
    $taskBody87=$taskResponse87.Content.ReadAsStringAsync().GetAwaiter().GetResult()|ConvertFrom-Json -AsHashtable -DateKind String
    $taskReads87.Add(@{method='POST';path=$taskPath87;input=$taskInput87;status=[int]$taskResponse87.StatusCode;headers=$taskHeaders87;body=$taskBody87})
    if([int]$taskResponse87.StatusCode -ne 200){throw ('Genuine package import returned '+[string][int]$taskResponse87.StatusCode)}
   }finally{$taskResponse87.Dispose()}
  }finally{$taskRequest87.Dispose()}
 }
}catch{$taskFailure87=$_.Exception.Message}finally{
 $taskClient87.Dispose()
 Write-OwnedLaunchFact (Join-Path $taskEvidence87 'before-87-native-package-imports.json') @{observedAtUtc=[DateTime]::UtcNow.ToString('o');occurrence=$taskOwner87.occurrence;project=$taskOwner87.project;credentialStaging='None; no model execution';reads=$taskReads87.ToArray();failure=$taskFailure87}
}
$taskReads87|ForEach-Object{[pscustomobject]@{status=$_.status;id=$_.body.after.id;namespace=$_.body.after.namespace;operation=$_.body.operation;error=$_.body.name}}
if($taskFailure87){throw $taskFailure87}