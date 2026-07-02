param(
  [string]$DeviceId = "",
  [string]$OutputsPath = "",
  [switch]$SkipPubGet
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

Assert-CommandExists -Name "flutter"
Assert-CommandExists -Name "node"

$mobileRoot = Split-Path -Parent $PSScriptRoot
$projectRoot = Split-Path -Parent $mobileRoot

if ([string]::IsNullOrWhiteSpace($OutputsPath)) {
  $OutputsPath = Join-Path $projectRoot "docs\aws-dev-outputs.json"
}

$outputs = Read-HospitalMobileOutputs -OutputsPath $OutputsPath
if ([string]::IsNullOrWhiteSpace($DeviceId)) {
  $DeviceId = Get-AndroidDeviceId
}

Write-Host "Device       : $DeviceId"
Write-Host "API base URL : $($outputs.ApiBaseUrl)"
Write-Host "Region       : $($outputs.Region)"
Write-Host "User Pool    : $($outputs.UserPoolId)"
Write-Host "Client ID    : $($outputs.ClientId)"

Push-Location $mobileRoot
try {
  if (-not $SkipPubGet) {
    flutter pub get
    if ($LASTEXITCODE -ne 0) { throw "flutter pub get thất bại." }
  }

  $arguments = @("run", "-d", $DeviceId) + (Get-FlutterRunDefines -Outputs $outputs)
  & flutter @arguments

  if ($LASTEXITCODE -ne 0) {
    throw "Flutter AWS kết thúc với mã lỗi $LASTEXITCODE."
  }
}
finally {
  Pop-Location
}
