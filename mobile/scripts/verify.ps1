param(
  [switch]$BuildDebugApk,
  [switch]$BuildWeb,
  [string]$OutputsPath = "",
  [switch]$SkipClean
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

Assert-CommandExists -Name "flutter"
Assert-CommandExists -Name "dart"
Assert-CommandExists -Name "node"
$mobileRoot = Split-Path -Parent $PSScriptRoot
$projectRoot = Split-Path -Parent $mobileRoot

if ([string]::IsNullOrWhiteSpace($OutputsPath)) {
  $OutputsPath = Join-Path $projectRoot "docs\aws-dev-outputs.json"
}

function Assert-LastExitCode([string]$Message) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Message (exit code: $LASTEXITCODE)"
  }
}

$outputs = Read-HospitalMobileOutputs -OutputsPath $OutputsPath
$defines = Get-FlutterRunDefines -Outputs $outputs

Push-Location $mobileRoot
try {
  if (-not $SkipClean) {
    flutter clean
    Assert-LastExitCode "flutter clean thất bại"
    Remove-Item .\.dart_tool -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item .\build -Recurse -Force -ErrorAction SilentlyContinue
  }

  flutter pub get
  Assert-LastExitCode "flutter pub get thất bại"

  dart format lib test
  Assert-LastExitCode "dart format thất bại"

  flutter analyze --no-fatal-infos --no-fatal-warnings
  Assert-LastExitCode "flutter analyze còn lỗi biên dịch"

  flutter test
  Assert-LastExitCode "flutter test còn test thất bại"

  if ($BuildWeb) {
    & flutter build web --debug @defines
    Assert-LastExitCode "Build Web Debug thất bại"
  }

  if ($BuildDebugApk) {
    & flutter build apk --debug @defines
    Assert-LastExitCode "Build APK Debug thất bại"
  }

  Write-Host "KIỂM TRA MOBILE BACKEND HOÀN TẤT" -ForegroundColor Green
}
finally {
  Pop-Location
}
