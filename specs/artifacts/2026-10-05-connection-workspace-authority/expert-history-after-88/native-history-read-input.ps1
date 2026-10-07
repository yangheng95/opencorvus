param(
  [string]$FactName='after-80-native-reads.json',
  [string]$CaseRun='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-07/expert-catalog-error-after-80',
  [string]$CaseEvidence='D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/expert-catalog-error-80',
  [string[]]$RequestPaths=@('/expert-squad/catalog?sessionID=ses_-zUSggUQgzzprQcl946c','/expert-squad/inventory-status','/expert-squad/diagnostics?limit=20','/config','/session/ses_-zUSggUQgzzprQcl946c/config')
)
$ErrorActionPreference='Stop'
$taskRun80=[IO.Path]::GetFullPath($CaseRun)
$taskEvidence80=[IO.Path]::GetFullPath($CaseEvidence)
$taskOwner80=Get-Content -Raw -LiteralPath (Join-Path $taskRun80 'launch-owner.json')|ConvertFrom-Json -AsHashtable -DateKind String
$taskHandler80=[Net.Http.HttpClientHandler]::new()
$taskHandler80.UseProxy=$false
$taskHandler80.UseCookies=$false
$taskHandler80.UseDefaultCredentials=$false
$taskClient80=[Net.Http.HttpClient]::new($taskHandler80)
$taskClient80.Timeout=[TimeSpan]::FromSeconds(20)
$taskReads80=[Collections.Generic.List[object]]::new()
try {
  foreach($taskPath80 in $RequestPaths) {
    $taskRequest80=[Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Get,('http://127.0.0.1:'+[string]$taskOwner80.port+$taskPath80))
    $taskRequest80.Headers.Add('x-opencorvus-directory',[string]$taskOwner80.project)
    try {
      $taskResponse80=$taskClient80.SendAsync($taskRequest80).GetAwaiter().GetResult()
      try {
        $taskBody80=$taskResponse80.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        $taskHeaders80=@{}
        foreach($taskHeader80 in $taskResponse80.Headers){$taskHeaders80[$taskHeader80.Key]=@($taskHeader80.Value)}
        $taskReads80.Add(@{method='GET';path=$taskPath80;status=[int]$taskResponse80.StatusCode;headers=$taskHeaders80;body=($taskBody80|ConvertFrom-Json -AsHashtable -DateKind String)})
      } finally {$taskResponse80.Dispose()}
    } finally {$taskRequest80.Dispose()}
  }
} finally {$taskClient80.Dispose()}
$taskReadFact80=@{observedAtUtc=[DateTime]::UtcNow.ToString('o');occurrence=$taskOwner80.occurrence;project=$taskOwner80.project;taskID='tsk_g00VXJJVS500QnIDtJVs';sessionID='ses_-zUSggUQgzzprQcl946c';credentialStaging='None; no Task rearm';reads=$taskReads80.ToArray()}
$taskReadPath80=Join-Path $taskEvidence80 $FactName
if(Test-Path -LiteralPath $taskReadPath80){throw 'Preserve existing native read occurrence'}
[IO.File]::WriteAllText($taskReadPath80,($taskReadFact80|ConvertTo-Json -Depth 40),[Text.UTF8Encoding]::new($false))
$taskReads80|ForEach-Object{[pscustomobject]@{method=$_.method;path=$_.path;status=$_.status;name=$_.body.name;activeName=$_.body.active.name;version=$_.body.active.package_revision.version}}
