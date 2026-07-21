param(
  [string]$OutputsPath = ""
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

$mobileRoot = Split-Path -Parent $PSScriptRoot
$projectRoot = Split-Path -Parent $mobileRoot
if ([string]::IsNullOrWhiteSpace($OutputsPath)) {
  $OutputsPath = Join-Path $projectRoot "docs\aws-dev-outputs.json"
}

$outputs = Read-HospitalMobileOutputs -OutputsPath $OutputsPath
$argsLine = (Get-FlutterRunDefines -Outputs $outputs) -join ' '

Write-Host "Dán dòng sau vào Android Studio > Run > Edit Configurations > Additional run args:" -ForegroundColor Cyan
Write-Host ""
Write-Host $argsLine -ForegroundColor Green
