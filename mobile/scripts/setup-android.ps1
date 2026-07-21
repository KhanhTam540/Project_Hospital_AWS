param(
  [string]$AndroidSdk = ""
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

Assert-CommandExists -Name "flutter"
Assert-CommandExists -Name "java"

$mobileRoot = Split-Path -Parent $PSScriptRoot
$flutterCommand = (Get-Command flutter).Source
$flutterBin = Split-Path -Parent $flutterCommand
$flutterSdk = Split-Path -Parent $flutterBin

if ([string]::IsNullOrWhiteSpace($AndroidSdk)) {
  foreach ($candidate in @(
    $env:ANDROID_SDK_ROOT,
    $env:ANDROID_HOME,
    (Join-Path $env:LOCALAPPDATA "Android\Sdk")
  )) {
    if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path $candidate)) {
      $AndroidSdk = $candidate
      break
    }
  }
}

if ([string]::IsNullOrWhiteSpace($AndroidSdk) -or -not (Test-Path $AndroidSdk)) {
  throw "Không tìm thấy Android SDK. Mở Android Studio > SDK Manager hoặc truyền -AndroidSdk."
}

$flutterSdkForProperties = $flutterSdk -replace '\\', '/'
$androidSdkForProperties = $AndroidSdk -replace '\\', '/'
$localProperties = Join-Path $mobileRoot "android\local.properties"

@(
  "sdk.dir=$androidSdkForProperties",
  "flutter.sdk=$flutterSdkForProperties"
) | Set-Content -Path $localProperties -Encoding ASCII

& flutter config --android-sdk $AndroidSdk
if ($LASTEXITCODE -ne 0) { throw "flutter config --android-sdk thất bại." }

Push-Location $mobileRoot
try {
  flutter clean
  if ($LASTEXITCODE -ne 0) { throw "flutter clean thất bại." }

  flutter pub get
  if ($LASTEXITCODE -ne 0) { throw "flutter pub get thất bại." }

  flutter doctor -v
  flutter devices

  Write-Host "Đã tạo lại android/local.properties cho máy hiện tại." -ForegroundColor Green
  Write-Host "Nếu flutter doctor báo Android licenses, chạy: flutter doctor --android-licenses" -ForegroundColor Yellow
}
finally {
  Pop-Location
}
