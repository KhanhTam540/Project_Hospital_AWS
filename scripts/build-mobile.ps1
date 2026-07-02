param(
  [ValidateSet("debug", "release")]
  [string]$Mode = "debug",
  [switch]$Demo
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$mobileRoot = Join-Path $projectRoot "mobile"
$mobileScripts = Join-Path $mobileRoot "scripts"
$outputsFile = Join-Path $projectRoot "docs\aws-dev-outputs.json"

. (Join-Path $mobileScripts "common.ps1")
Assert-CommandExists -Name "flutter"

$defines = @("--dart-define=DEMO_MODE=true")
if (-not $Demo) {
  $outputs = Read-HospitalMobileOutputs -OutputsPath $outputsFile
  $defines = Get-FlutterRunDefines -Outputs $outputs
}

Push-Location $mobileRoot
try {
  flutter clean
  if ($LASTEXITCODE -ne 0) { throw "flutter clean thất bại." }

  flutter pub get
  if ($LASTEXITCODE -ne 0) { throw "flutter pub get thất bại." }

  flutter analyze --no-fatal-infos --no-fatal-warnings
  if ($LASTEXITCODE -ne 0) { throw "flutter analyze thất bại." }

  flutter test
  if ($LASTEXITCODE -ne 0) { throw "flutter test thất bại." }

  $arguments = @("build", "apk", "--$Mode") + $defines
  & flutter @arguments
  if ($LASTEXITCODE -ne 0) { throw "flutter build apk thất bại." }

  Write-Host "APK: mobile\build\app\outputs\flutter-apk" -ForegroundColor Green
}
finally {
  Pop-Location
}
