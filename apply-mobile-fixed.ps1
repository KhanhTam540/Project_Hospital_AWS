param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot
)

$ErrorActionPreference = "Stop"
$patchRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path $ProjectRoot).Path

if (-not (Test-Path (Join-Path $ProjectRoot "package.json"))) {
  throw "ProjectRoot không hợp lệ: không tìm thấy package.json."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $ProjectRoot "_backup_mobile_caothien_$timestamp"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

$mobileDestination = Join-Path $ProjectRoot "mobile"
if (Test-Path $mobileDestination) {
  Copy-Item $mobileDestination (Join-Path $backupRoot "mobile") -Recurse -Force
  Remove-Item $mobileDestination -Recurse -Force
}
Copy-Item (Join-Path $patchRoot "mobile") $mobileDestination -Recurse -Force

foreach ($relativePath in @(
  "scripts\run-mobile.ps1",
  "scripts\build-mobile.ps1",
  "scripts\test-mobile-backend.ps1",
  "tests\caothien-mobile-contract.test.js"
)) {
  $source = Join-Path $patchRoot $relativePath
  $destination = Join-Path $ProjectRoot $relativePath

  if (Test-Path $destination) {
    $backupFile = Join-Path $backupRoot $relativePath
    New-Item -ItemType Directory -Path (Split-Path -Parent $backupFile) -Force | Out-Null
    Copy-Item $destination $backupFile -Force
  }

  New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
  Copy-Item $source $destination -Force
}

Copy-Item `
  (Join-Path $patchRoot "HUONG_DAN_ANDROID_STUDIO.md") `
  (Join-Path $ProjectRoot "HUONG_DAN_MOBILE_ANDROID_STUDIO.md") `
  -Force

# Không mang local.properties từ máy đóng gói sang máy người dùng.
Remove-Item `
  (Join-Path $ProjectRoot "mobile\android\local.properties") `
  -Force `
  -ErrorAction SilentlyContinue

Remove-Item `
  (Join-Path $ProjectRoot "mobile\android\.gradle") `
  -Recurse `
  -Force `
  -ErrorAction SilentlyContinue

Write-Host "Đã cập nhật Mobile Cao Thiên." -ForegroundColor Green
Write-Host "Backup: $backupRoot" -ForegroundColor Yellow
Write-Host ""
Write-Host "Chạy tiếp:"
Write-Host "  npm run outputs"
Write-Host "  powershell -ExecutionPolicy Bypass -File .\mobile\scripts\setup-android.ps1"
Write-Host "  powershell -ExecutionPolicy Bypass -File .\mobile\scripts\verify.ps1 -BuildDebugApk"
Write-Host "  powershell -ExecutionPolicy Bypass -File .\mobile\scripts\run-aws.ps1"
