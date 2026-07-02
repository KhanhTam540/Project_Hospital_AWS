param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot
)

$ErrorActionPreference = "Stop"
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceMobile = Join-Path $PackageRoot "mobile"
$TargetMobile = Join-Path $ProjectRoot "mobile"

if (-not (Test-Path $SourceMobile)) {
  throw "Không tìm thấy thư mục mobile trong gói: $SourceMobile"
}

if (-not (Test-Path $ProjectRoot)) {
  throw "Không tìm thấy project: $ProjectRoot"
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectRoot "_backup_mobile_merged_$Timestamp"
$OldLocalProperties = $null

if (Test-Path $TargetMobile) {
  $LocalPropertiesPath = Join-Path $TargetMobile "android\local.properties"
  if (Test-Path $LocalPropertiesPath) {
    $OldLocalProperties = Get-Content $LocalPropertiesPath -Raw
  }

  New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
  Copy-Item $TargetMobile (Join-Path $BackupRoot "mobile") -Recurse -Force
  Remove-Item $TargetMobile -Recurse -Force
}

Copy-Item $SourceMobile $TargetMobile -Recurse -Force

if ($null -ne $OldLocalProperties) {
  $NewLocalPropertiesPath = Join-Path $TargetMobile "android\local.properties"
  [System.IO.File]::WriteAllText(
    $NewLocalPropertiesPath,
    $OldLocalProperties,
    [System.Text.UTF8Encoding]::new($false)
  )
}

Write-Host "Đã cài thư mục Mobile hợp nhất." -ForegroundColor Green
Write-Host "Đích   : $TargetMobile"
if (Test-Path $BackupRoot) {
  Write-Host "Backup : $BackupRoot"
}
Write-Host "Bước tiếp theo: cd '$TargetMobile'; powershell -ExecutionPolicy Bypass -File .\scripts\verify.ps1"
