[CmdletBinding()]
param(
    [string]$InstallRoot = 'D:\myhexin-local\demos\realesrgan-ncnn-vulkan-20220424'
)

$ErrorActionPreference = 'Stop'
$archiveUrl = 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip'
$archiveSha256 = 'ABC02804E17982A3BE33675E4D471E91EA374E65B70167ABC09E31ACB412802D'
$expected = [ordered]@{
    'realesrgan-ncnn-vulkan.exe' = '07E49F7CBB4EDE01AE4DD4C399D3A7E5846E3D2085C3128EFF881E55CB7B1A0C'
    'models\realesr-animevideov3-x2.bin' = '548A36F9C3F4AB8DA56CD3B13BADF23968BEE207B396DAD14D04B830E5F2AB2D'
    'models\realesr-animevideov3-x2.param' = 'B88FF4F00EBF019A7FDAC17FDD45A7FD3665D37509EFC5BAF2E4DA2E24420A04'
}

function Assert-InstalledFiles {
    foreach ($entry in $expected.GetEnumerator()) {
        $path = Join-Path $InstallRoot $entry.Key
        if (-not (Test-Path -LiteralPath $path)) { throw "Restoration file is missing: $path" }
        $actual = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
        if ($actual -ne $entry.Value) { throw "Restoration file failed SHA-256 verification: $path" }
    }
}

if (Test-Path -LiteralPath $InstallRoot) {
    Assert-InstalledFiles
    Write-Host "Verified existing Real-ESRGAN restoration runtime at $InstallRoot"
    exit 0
}

$parent = Split-Path -Parent $InstallRoot
New-Item -ItemType Directory -Force -Path $parent | Out-Null
$archive = "$InstallRoot.zip"
if (-not (Test-Path -LiteralPath $archive)) {
    curl.exe -L --fail --retry 5 --retry-all-errors --connect-timeout 20 -o $archive $archiveUrl
    if ($LASTEXITCODE -ne 0) { throw "Failed to download $archiveUrl" }
}
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $archiveSha256) {
    throw "Restoration archive failed SHA-256 verification: $archive"
}
Expand-Archive -LiteralPath $archive -DestinationPath $InstallRoot
Assert-InstalledFiles
Write-Host "Installed and verified Real-ESRGAN restoration runtime at $InstallRoot"
