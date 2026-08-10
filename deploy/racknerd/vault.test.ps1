$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$vaultScript = Join-Path $PSScriptRoot "vault.ps1"
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ("opencorvus-vault-test-" + [Guid]::NewGuid().ToString("N"))
[IO.Directory]::CreateDirectory($testRoot) | Out-Null

function Set-PrivateDirectoryAcl([string]$Path) {
  $currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $systemSid = [Security.Principal.SecurityIdentifier]::new(
    [Security.Principal.WellKnownSidType]::LocalSystemSid,
    $null
  )
  $acl = [Security.AccessControl.DirectorySecurity]::new()
  $acl.SetAccessRuleProtection($true, $false)
  foreach ($sid in @($currentSid, $systemSid)) {
    $rule = [Security.AccessControl.FileSystemAccessRule]::new(
      $sid,
      [Security.AccessControl.FileSystemRights]::FullControl,
      [Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit,
      [Security.AccessControl.PropagationFlags]::None,
      [Security.AccessControl.AccessControlType]::Allow
    )
    [void]$acl.AddAccessRule($rule)
  }
  Set-Acl -LiteralPath $Path -AclObject $acl
}

Set-PrivateDirectoryAcl $testRoot

function Assert-PrivateAcl([string]$Path) {
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
    throw "Credential file ACL contains a non-private rule."
  }
  if (-not [Linq.Enumerable]::SequenceEqual([string[]]$expectedSids, [string[]]$actualSids)) {
    throw "Credential file ACL is not restricted to the current identity and SYSTEM."
  }
}

try {
  $plainPath = Join-Path $testRoot "fixture.key"
  $envelopePath = Join-Path $testRoot "fixture.dpapi.json"
  $restoredPath = Join-Path $testRoot "restored.key"
  $fixture = [Text.UTF8Encoding]::new($false).GetBytes("opencorvus-vault-round-trip-fixture")
  [IO.File]::WriteAllBytes($plainPath, $fixture)
  $expectedSha256 = (Get-FileHash -LiteralPath $plainPath -Algorithm SHA256).Hash.ToLowerInvariant()

  $protected = & $vaultScript -Action Protect -InputPath $plainPath -OutputPath $envelopePath -Label "round-trip-test" -ExpectedSha256 $expectedSha256 -DeleteInput
  if (Test-Path -LiteralPath $plainPath) {
    throw "Protect did not remove the requested plaintext fixture."
  }
  if ($protected.plainSha256 -ne $expectedSha256) {
    throw "Protect returned the wrong digest."
  }
  Assert-PrivateAcl $envelopePath

  $verified = & $vaultScript -Action Verify -InputPath $envelopePath -Label "round-trip-test" -ExpectedSha256 $expectedSha256
  if ($verified.bytes -ne $fixture.Length -or $verified.plainSha256 -ne $expectedSha256) {
    throw "Verify did not prove the expected fixture bytes."
  }

  $restored = & $vaultScript -Action Restore -InputPath $envelopePath -OutputPath $restoredPath -Label "round-trip-test" -ExpectedSha256 $expectedSha256
  if ($restored.plainSha256 -ne $expectedSha256) {
    throw "Restore returned the wrong digest."
  }
  Assert-PrivateAcl $restoredPath
  if (-not [Linq.Enumerable]::SequenceEqual([byte[]]$fixture, [byte[]][IO.File]::ReadAllBytes($restoredPath))) {
    throw "Restored bytes differ from the original fixture."
  }

  Write-Output "vault round-trip ok ($expectedSha256)"
}
finally {
  if (Test-Path -LiteralPath $testRoot) {
    [IO.Directory]::Delete($testRoot, $true)
  }
}
