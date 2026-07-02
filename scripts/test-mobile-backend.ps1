param(
  [string]$IdToken = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$mobileScripts = Join-Path $projectRoot "mobile\scripts"
$outputsFile = Join-Path $projectRoot "docs\aws-dev-outputs.json"

. (Join-Path $mobileScripts "common.ps1")
$outputs = Read-HospitalMobileOutputs -OutputsPath $outputsFile
$baseUrl = $outputs.ApiBaseUrl.TrimEnd('/')

function Invoke-TestGet {
  param(
    [string]$Name,
    [string]$Path,
    [hashtable]$Headers = @{}
  )

  try {
    $response = Invoke-RestMethod `
      -Uri "$baseUrl$Path" `
      -Method GET `
      -Headers $Headers `
      -TimeoutSec 60

    Write-Host "[PASS] $Name" -ForegroundColor Green
    return $response
  }
  catch {
    Write-Host "[FAIL] $Name - $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
    throw
  }
}

Invoke-TestGet -Name "CloudFront health" -Path "/api/health" | Out-Null

if ([string]::IsNullOrWhiteSpace($IdToken)) {
  $secureToken = Read-Host "Nhập Cognito ID token mới" -AsSecureString
  $IdToken = [System.Net.NetworkCredential]::new("", $secureToken).Password
}
if ([string]::IsNullOrWhiteSpace($IdToken)) { throw "ID token đang trống." }

$headers = @{ Authorization = "Bearer $IdToken" }
$me = Invoke-TestGet -Name "Cognito /api/me" -Path "/api/me" -Headers $headers
$profile = $me.data
$patientId = [string]$profile.maBN
if ([string]::IsNullOrWhiteSpace($patientId)) {
  $patientId = [string]$profile.patientId
}

Invoke-TestGet -Name "Danh sách khoa" -Path "/api/khoa" -Headers $headers | Out-Null
Invoke-TestGet -Name "Danh sách bác sĩ" -Path "/api/bacsi" -Headers $headers | Out-Null

if (-not [string]::IsNullOrWhiteSpace($patientId)) {
  Invoke-TestGet -Name "Lịch khám bệnh nhân" -Path "/api/lichkham/benhnhan/$patientId" -Headers $headers | Out-Null
  Invoke-TestGet -Name "Hồ sơ bệnh án" -Path "/api/patients/$patientId/records" -Headers $headers | Out-Null
  Invoke-TestGet -Name "Phiếu khám" -Path "/api/patients/$patientId/examinations" -Headers $headers | Out-Null
  Invoke-TestGet -Name "Đơn thuốc" -Path "/api/patients/$patientId/prescriptions" -Headers $headers | Out-Null
  Invoke-TestGet -Name "Tài liệu y tế" -Path "/api/patients/$patientId/documents" -Headers $headers | Out-Null
  Invoke-TestGet -Name "Kết quả xét nghiệm" -Path "/api/phieuxetnghiem" -Headers $headers | Out-Null
}
else {
  Write-Warning "Tài khoản chưa có maBN/patientId; bỏ qua API dữ liệu bệnh nhân."
}

Write-Host "Kiểm tra backend Mobile hoàn tất." -ForegroundColor Green
$IdToken = $null
