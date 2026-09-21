[CmdletBinding()]
param(
    [string]$InstallRoot = 'D:\myhexin-local\demos\minimax-h3-local-5090',
    [ValidateSet('official-first', 'mirror-first')]
    [string]$ModelSourceOrder = 'official-first'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3.0

$installerCommit = '95873015109cbc3f5534171c469c3b2a5d170197'
$comfyCommit = '0764232429b8cfb10b79b6f186c8cb23e0b22897'
$apiClientCommit = 'bc8540964223877be344582345b1d2c2331e3b59'
$sourceZipHash = '71C2B7624D10AF93FF1158F11B1787D6296ED081B52AC86B9CA82530CE5AA754'
$runtime = Join-Path $InstallRoot 'runtime'
$comfy = Join-Path $runtime 'ComfyUI'
$venvPython = Join-Path $runtime 'venv\Scripts\python.exe'
$downloads = Join-Path $InstallRoot 'downloads'

function Invoke-Checked {
    param([scriptblock]$Command, [string]$Label)
    Write-Host "==> $Label"
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "$Label failed with exit code $LASTEXITCODE" }
}

function Assert-ContainedPath {
    param([string]$Candidate)
    $root = [IO.Path]::GetFullPath($InstallRoot).TrimEnd('\') + '\'
    $path = [IO.Path]::GetFullPath($Candidate)
    if (-not $path.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Path escapes isolated install root: $path"
    }
    return $path
}

$null = Assert-ContainedPath $runtime
$null = Assert-ContainedPath $downloads
New-Item -ItemType Directory -Force -Path $runtime, $downloads | Out-Null

$gpu = nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader,nounits | Select-Object -First 1
if (-not $gpu -or $gpu -notmatch 'RTX 5090') { throw "This profile is qualified for one RTX 5090; detected: $gpu" }
$ram = (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory
if ($ram -lt 60GB) { throw 'At least 60 GiB system RAM is required for this profile.' }
$free = (New-Object IO.DriveInfo(([IO.Path]::GetPathRoot($InstallRoot)))).AvailableFreeSpace
if ($free -lt 70GB) { throw 'At least 70 GiB free disk is required.' }

$installer = Join-Path $InstallRoot 'installer'
if (-not (Test-Path -LiteralPath (Join-Path $installer '.git'))) {
    Invoke-Checked { git clone https://github.com/dudulu2/MiniMaxH3-Installer.git $installer } 'Clone audited Windows installer assets'
}
Invoke-Checked { git -C $installer fetch --depth 1 origin $installerCommit } 'Fetch installer commit'
Invoke-Checked { git -C $installer checkout --detach $installerCommit } 'Pin installer commit'

$sourceZip = Join-Path $installer 'assets\ComfyUI-source.zip'
if ((Get-FileHash -LiteralPath $sourceZip -Algorithm SHA256).Hash -ne $sourceZipHash) {
    throw 'Pinned ComfyUI source archive failed SHA-256 verification.'
}
if (-not (Test-Path -LiteralPath (Join-Path $comfy 'main.py'))) {
    Expand-Archive -LiteralPath $sourceZip -DestinationPath $runtime -Force
}

$python311 = 'C:\Users\hengu\AppData\Roaming\uv\python\cpython-3.11.15-windows-x86_64-none\python.exe'
if (-not (Test-Path -LiteralPath $python311)) { throw "Python 3.11 runtime not found: $python311" }
if (-not (Test-Path -LiteralPath $venvPython)) {
    Invoke-Checked { & $python311 -m venv (Join-Path $runtime 'venv') } 'Create isolated Python 3.11 environment'
}
Invoke-Checked { & $venvPython -m pip install --upgrade pip==25.1.1 setuptools wheel } 'Prepare pip'

$wheelDir = Join-Path $downloads 'torch-wheels'
New-Item -ItemType Directory -Force -Path $wheelDir | Out-Null
$torchWheel = Join-Path $wheelDir 'torch-2.10.0+cu130-cp311-cp311-win_amd64.whl'
$visionWheel = Join-Path $wheelDir 'torchvision-0.25.0+cu130-cp311-cp311-win_amd64.whl'
$audioWheel = Join-Path $wheelDir 'torchaudio-2.10.0+cu130-cp311-cp311-win_amd64.whl'
$wheelUrls = [ordered]@{
    $torchWheel = 'https://download-r2.pytorch.org/whl/cu130/torch-2.10.0%2Bcu130-cp311-cp311-win_amd64.whl'
    $visionWheel = 'https://download-r2.pytorch.org/whl/cu130/torchvision-0.25.0%2Bcu130-cp311-cp311-win_amd64.whl'
    $audioWheel = 'https://download-r2.pytorch.org/whl/cu130/torchaudio-2.10.0%2Bcu130-cp311-cp311-win_amd64.whl'
}
foreach ($entry in $wheelUrls.GetEnumerator()) {
    if (-not (Test-Path -LiteralPath $entry.Key)) {
        Invoke-Checked { curl.exe -L --fail --retry 5 --retry-all-errors --connect-timeout 20 -C - -o $entry.Key $entry.Value } "Download $(Split-Path -Leaf $entry.Key)"
    }
}
Invoke-Checked { & $venvPython -m pip install $torchWheel $visionWheel $audioWheel } 'Install CUDA 13 PyTorch wheels'

$constraints = Join-Path $runtime 'constraints.txt'
@'
torch==2.10.0+cu130
torchvision==0.25.0+cu130
torchaudio==2.10.0+cu130
comfyui-frontend-package==1.47.12
comfyui-workflow-templates==0.11.27
'@ | Set-Content -LiteralPath $constraints -Encoding ASCII
Invoke-Checked { & $venvPython -m pip install -r (Join-Path $comfy 'requirements.txt') -c $constraints } 'Install ComfyUI dependencies'
Invoke-Checked { & $venvPython -m pip check } 'Check Python dependency graph'
Invoke-Checked { & $venvPython -c "import torch; assert torch.cuda.is_available(); x=torch.ones((64,64),device='cuda'); assert float(x.sum())==4096; print(torch.__version__, torch.version.cuda, torch.cuda.get_device_name(0))" } 'Verify RTX 5090 CUDA execution'

$profilePath = Join-Path $runtime 'local-5090-profile.json'
@{
    schema_version = 1
    default_profile = 'local_5090_nvfp4'
    profiles = @(@{
        id = 'local_5090_nvfp4'
        label = 'Single RTX 5090 NVFP4'
        min_vram_mib = 30000
        min_ram_gib = 60
        required_free_gib = 60
        megapixels = 0.4
        resolution = '864x480'
        duration_seconds = 3
        diffusion_model = 'diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors'
        text_encoder = 'text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors'
        video_vae = 'vae/minimax_h3_video_vae_fp16.safetensors'
        audio_vae = 'vae/minimax_h3_audio_vae_fp32.safetensors'
    })
} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $profilePath -Encoding UTF8
Invoke-Checked { & $venvPython -m pip install requests } 'Install resumable downloader dependency'
Invoke-Checked {
    & $venvPython (Join-Path $installer 'assets\download_models.py') `
        --comfy-root $comfy `
        --status (Join-Path $downloads 'model-progress.json') `
        --catalog (Join-Path $installer 'assets\hf_model_inventory.json') `
        --profiles $profilePath `
        --profile local_5090_nvfp4 `
        --source-order $ModelSourceOrder `
        --download-mode accelerated
} 'Download and verify local H3 weights'

$apiClient = Join-Path $InstallRoot 'api-client'
if (-not (Test-Path -LiteralPath (Join-Path $apiClient '.git'))) {
    Invoke-Checked { git clone https://github.com/TheTerrasque/minimax-h3-frontend.git $apiClient } 'Clone API workflow source'
}
Invoke-Checked { git -C $apiClient fetch --depth 1 origin $apiClientCommit } 'Fetch API workflow commit'
Invoke-Checked { git -C $apiClient checkout --detach $apiClientCommit } 'Pin API workflow commit'

$manifest = [ordered]@{
    installed_at = (Get-Date).ToUniversalTime().ToString('o')
    install_root = [IO.Path]::GetFullPath($InstallRoot)
    gpu = $gpu
    comfy_commit = $comfyCommit
    installer_commit = $installerCommit
    api_client_commit = $apiClientCommit
    diffusion = 'minimax_h3_fl2va_pruned_int8_convrot.safetensors'
    text_encoder = 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors'
    quantization = 'community/Comfy-Org repackage; INT8 ConvRot DiT + NVFP4 AWQ text encoder'
    workflow = 'api-client/resources/workflows_api/video_minimax_h3_t2v.api.json'
}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $InstallRoot 'install-manifest.json') -Encoding UTF8
Write-Host "Local MiniMax H3 is installed at $InstallRoot"
