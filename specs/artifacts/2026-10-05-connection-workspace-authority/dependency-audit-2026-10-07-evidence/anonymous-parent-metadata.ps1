$ErrorActionPreference='Stop'
$handler=[Net.Http.HttpClientHandler]::new();$handler.UseProxy=$false;$handler.UseCookies=$false;$handler.UseDefaultCredentials=$false
$client=[Net.Http.HttpClient]::new($handler)
try {
  $facts=foreach($pair in @(@('postcss-nested','7.0.2'),@('@expressive-code/core','latest'),@('mermaid','latest'),@('solid-js','latest'),@('astro','latest'),@('express','latest'),@('seroval','1.6.3'),@('sharp','0.35.5'),@('smol-toml','1.9.0'),@('source-map-js','1.2.2'),@('proxy-addr','2.0.8'),@('postcss-selector-parser','7.1.6'),@('katex','0.18.2'),@('@modelcontextprotocol/sdk','1.31.0'))) {
    $url='https://registry.npmjs.org/'+[Uri]::EscapeDataString($pair[0])+'/'+$pair[1]
    $raw=$client.GetStringAsync($url).GetAwaiter().GetResult()
    $metadata=$raw|ConvertFrom-Json
    @{url=$url;name=$metadata.name;version=$metadata.version;engines=$metadata.engines;dependencies=$metadata.dependencies;optionalDependencies=$metadata.optionalDependencies}
  }
  @{observedAtUTC=[DateTime]::UtcNow.ToString('o');boundary='Public registry metadata projection, not full raw response; no install or code execution';packages=@($facts)}|ConvertTo-Json -Depth 12|Set-Content -LiteralPath (Join-Path $PSScriptRoot 'public-parent-metadata.json')
} finally {$client.Dispose();$handler.Dispose()}
