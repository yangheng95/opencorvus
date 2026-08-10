[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("Protect", "Verify", "Restore")]
  [string]$Action,

  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [string]$OutputPath,

  [Parameter(Mandatory = $true)]
  [ValidatePattern("^[a-z0-9][a-z0-9._-]{2,80}$")]
  [string]$Label,

  [ValidatePattern("^[0-9a-f]{64}$")]
  [string]$ExpectedSha256,

  [switch]$DeleteInput
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$protocol = "opencorvus/windows-dpapi-file@1"
$entropy = [Text.Encoding]::UTF8.GetBytes("${protocol}:${Label}")

function Get-Sha256Hex([byte[]]$Bytes) {
  $sha256 = [Security.Cryptography.SHA256]::Create()
  try {
    return [Convert]::ToHexString($sha256.ComputeHash($Bytes)).ToLowerInvariant()
  }
  finally {
    $sha256.Dispose()
  }
}

function Set-PrivateFileAcl([string]$Path) {
  if (-not $IsWindows) {
    throw "The production credential vault is Windows-only."
  }

  $currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $systemSid = [Security.Principal.SecurityIdentifier]::new(
    [Security.Principal.WellKnownSidType]::LocalSystemSid,
    $null
  )
  $acl = [Security.AccessControl.FileSecurity]::new()
  $acl.SetAccessRuleProtection($true, $false)
  foreach ($sid in @($currentSid, $systemSid)) {
    $rule = [Security.AccessControl.FileSystemAccessRule]::new(
      $sid,
      [Security.AccessControl.FileSystemRights]::FullControl,
      [Security.AccessControl.AccessControlType]::Allow
    )
    [void]$acl.AddAccessRule($rule)
  }
  Set-Acl -LiteralPath $Path -AclObject $acl
}

function Assert-PrivateDirectoryAcl([string]$Path) {
  if (-not $IsWindows) {
    throw "The production credential vault is Windows-only."
  }

  $expectedSids = @(
    [Security.Principal.WindowsIdentity]::GetCurrent().User.Value,
    [Security.Principal.SecurityIdentifier]::new(
      [Security.Principal.WellKnownSidType]::LocalSystemSid,
      $null
    ).Value
  ) | Sort-Object
  $rules = (Get-Acl -LiteralPath $Path).Access
  $actualSids = @($rules | ForEach-Object {
    $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
  } | Sort-Object)
  if ($rules.Where({ $_.IsInherited -or $_.AccessControlType -ne "Allow" -or $_.FileSystemRights -ne "FullControl" }).Count -ne 0) {
    throw "Credential output directory ACL contains a non-private rule."
  }
  if (-not [Linq.Enumerable]::SequenceEqual([string[]]$expectedSids, [string[]]$actualSids)) {
    throw "Credential output directory must grant access only to the current identity and SYSTEM."
  }
}

function Write-PrivateBytes([string]$Path, [byte[]]$Bytes) {
  $fullPath = [IO.Path]::GetFullPath($Path)
  $parentPath = [IO.Path]::GetDirectoryName($fullPath)
  Assert-PrivateDirectoryAcl $parentPath
  try {
    $stream = [IO.File]::Open($fullPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    $stream.Dispose()
    Set-PrivateFileAcl $fullPath
    [IO.File]::WriteAllBytes($fullPath, $Bytes)
    return $fullPath
  }
  catch {
    if (Test-Path -LiteralPath $fullPath) {
      [IO.File]::Delete($fullPath)
    }
    throw
  }
}

function Read-Envelope([string]$Path) {
  $envelope = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
  if ($envelope.protocol -ne $protocol -or $envelope.scope -ne "CurrentUser" -or $envelope.label -ne $Label) {
    throw "Credential envelope metadata does not match the requested protocol, scope, and label."
  }

  return $envelope
}

function Unprotect-Envelope($Envelope) {
  $ciphertext = [Convert]::FromBase64String([string]$Envelope.ciphertextBase64)
  $plain = [Security.Cryptography.ProtectedData]::Unprotect(
    $ciphertext,
    $entropy,
    [Security.Cryptography.DataProtectionScope]::CurrentUser
  )
  $actualSha256 = Get-Sha256Hex $plain
  if ($actualSha256 -ne [string]$Envelope.plainSha256) {
    throw "Decrypted credential digest does not match its envelope."
  }
  if ($ExpectedSha256 -and $actualSha256 -ne $ExpectedSha256) {
    throw "Decrypted credential digest does not match the expected manifest value."
  }

  return ,$plain
}

switch ($Action) {
  "Protect" {
    if (-not $OutputPath) {
      throw "Protect requires -OutputPath."
    }
    if (Test-Path -LiteralPath $OutputPath) {
      throw "Refusing to overwrite an existing credential envelope: $OutputPath"
    }

    $plain = [IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $InputPath))
    try {
      $plainSha256 = Get-Sha256Hex $plain
      if ($ExpectedSha256 -and $plainSha256 -ne $ExpectedSha256) {
        throw "Plaintext credential digest does not match the expected manifest value."
      }
      $ciphertext = [Security.Cryptography.ProtectedData]::Protect(
        $plain,
        $entropy,
        [Security.Cryptography.DataProtectionScope]::CurrentUser
      )
      $envelope = [ordered]@{
        protocol = $protocol
        scope = "CurrentUser"
        label = $Label
        createdAt = [DateTimeOffset]::UtcNow.ToString("O")
        plainSha256 = $plainSha256
        ciphertextBase64 = [Convert]::ToBase64String($ciphertext)
      }
      $json = $envelope | ConvertTo-Json
      $outputBytes = [Text.UTF8Encoding]::new($false).GetBytes($json + [Environment]::NewLine)
      $protectedPath = Write-PrivateBytes $OutputPath $outputBytes
      if ($DeleteInput) {
        [IO.File]::Delete((Resolve-Path -LiteralPath $InputPath))
      }
      [pscustomobject]@{
        action = "Protect"
        label = $Label
        plainSha256 = $envelope.plainSha256
        outputPath = $protectedPath
      }
    }
    finally {
      if ($plain) {
        [Array]::Clear($plain, 0, $plain.Length)
      }
    }
  }
  "Verify" {
    $envelope = Read-Envelope $InputPath
    $plain = Unprotect-Envelope $envelope
    try {
      [pscustomobject]@{
        action = "Verify"
        label = $Label
        plainSha256 = Get-Sha256Hex $plain
        bytes = $plain.Length
      }
    }
    finally {
      [Array]::Clear($plain, 0, $plain.Length)
    }
  }
  "Restore" {
    if (-not $OutputPath) {
      throw "Restore requires -OutputPath."
    }
    if (Test-Path -LiteralPath $OutputPath) {
      throw "Refusing to overwrite an existing restored credential: $OutputPath"
    }

    $envelope = Read-Envelope $InputPath
    $plain = Unprotect-Envelope $envelope
    try {
      $restoredPath = Write-PrivateBytes $OutputPath $plain
      [pscustomobject]@{
        action = "Restore"
        label = $Label
        plainSha256 = Get-Sha256Hex $plain
        outputPath = $restoredPath
      }
    }
    finally {
      [Array]::Clear($plain, 0, $plain.Length)
    }
  }
}
