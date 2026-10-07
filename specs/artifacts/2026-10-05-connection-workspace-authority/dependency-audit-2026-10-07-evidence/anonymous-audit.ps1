param([string]$RepositoryRoot='D:/myhexin-local/opencorvus')
$ErrorActionPreference='Stop'
# Public lock metadata only; no package-manager configuration or credentials.
$lockText=Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot 'bun.lock')
$versions=@{}
foreach($match in [regex]::Matches($lockText,'\["((?:@[^/" ]+/)?[^@" ]+)@([^" ]+)"')) {
  $name=$match.Groups[1].Value; $version=$match.Groups[2].Value
  if(!$versions.ContainsKey($name)){$versions[$name]=@()}
  if($versions[$name] -notcontains $version){$versions[$name]+=$version}
}
$inputJSON=$versions|ConvertTo-Json -Depth 5 -Compress
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'public-name-version-input.json'),$inputJSON)
$handler=[Net.Http.HttpClientHandler]::new()
$handler.UseProxy=$false; $handler.UseCookies=$false; $handler.UseDefaultCredentials=$false
$client=[Net.Http.HttpClient]::new($handler)
try {
  $content=[Net.Http.StringContent]::new($inputJSON,[Text.Encoding]::UTF8,'application/json')
  $response=$client.PostAsync('https://registry.npmjs.org/-/npm/v1/security/advisories/bulk',$content).GetAwaiter().GetResult()
  $response.EnsureSuccessStatusCode()|Out-Null
  $raw=$response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'npm-bulk-response.raw.json'),$raw)
  @{observedAtUTC=[DateTime]::UtcNow.ToString('o');status=[int]$response.StatusCode;inputPackages=$versions.Count;endpoint='https://registry.npmjs.org/-/npm/v1/security/advisories/bulk';credentials='No default credentials, Cookie, Authorization, proxy or package-manager config';scope='All matched published package name/version tuples in current bun.lock; not a production reachability filter'}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $PSScriptRoot 'acquisition.json')
} finally {$client.Dispose();$handler.Dispose()}
