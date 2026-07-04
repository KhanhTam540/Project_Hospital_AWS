$ErrorActionPreference = "Stop"

function Assert-CommandExists {
  param([Parameter(Mandatory = $true)][string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Không tìm thấy '$Name' trong PATH."
  }
}

function Get-AndroidDeviceId {
  Assert-CommandExists -Name "flutter"

  $raw = & flutter devices --machine
  if ($LASTEXITCODE -ne 0) {
    throw "Không đọc được danh sách thiết bị Flutter."
  }

  $devices = $raw | ConvertFrom-Json
  $android = @(
    $devices | Where-Object {
      ([string]$_.targetPlatform).StartsWith("android") -or
      ([string]$_.sdk).ToLowerInvariant().Contains("android")
    }
  )

  if ($android.Count -eq 0) {
    throw @"
Không tìm thấy Android Emulator hoặc điện thoại Android.
Mở Android Studio > Device Manager > Start emulator, sau đó chạy flutter devices.
"@
  }

  if ($android.Count -gt 1) {
    Write-Host "Phát hiện nhiều thiết bị Android; sử dụng thiết bị đầu tiên:" -ForegroundColor Yellow
    $android | Select-Object id, name, targetPlatform | Format-Table -AutoSize
  }

  return [string]$android[0].id
}

function Read-HospitalMobileOutputs {
  param([Parameter(Mandatory = $true)][string]$OutputsPath)

  Assert-CommandExists -Name "node"

  if (-not (Test-Path $OutputsPath)) {
    throw "Không tìm thấy '$OutputsPath'. Hãy chạy npm run outputs tại thư mục gốc."
  }

  $nodeScript = @'
const fs = require('fs');
const path = process.argv[1];
const value = JSON.parse(fs.readFileSync(path, 'utf8'));
const pick = (...names) => {
  for (const name of names) {
    const candidate = value[name];
    if (candidate !== undefined && candidate !== null && String(candidate).trim()) {
      return String(candidate).trim();
    }
  }
  return '';
};
console.log(JSON.stringify({
  ApiBaseUrl: pick('CloudFrontUrl', 'CloudFrontURL', 'ApiBaseUrl', 'ApiUrl', 'ApiEndpoint'),
  Region: pick('Region', 'region', 'AwsRegion'),
  UserPoolId: pick('UserPoolId', 'CognitoUserPoolId'),
  ClientId: pick('MobileClientId', 'UserPoolClientId', 'CognitoClientId')
}));
'@

  $normalizedJson = & node -e $nodeScript $OutputsPath
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($normalizedJson)) {
    throw "Không đọc được CloudFormation outputs bằng Node.js."
  }

  $outputs = $normalizedJson | ConvertFrom-Json
  $apiBaseUrl = [string]$outputs.ApiBaseUrl

  if ($apiBaseUrl -notmatch '^https?://') {
    if ($apiBaseUrl -match '^[A-Za-z0-9.-]+$') {
      $apiBaseUrl = "https://$apiBaseUrl"
    }
  }

  $result = [PSCustomObject]@{
    ApiBaseUrl = $apiBaseUrl.TrimEnd('/')
    Region = ([string]$outputs.Region).Trim()
    UserPoolId = ([string]$outputs.UserPoolId).Trim()
    ClientId = ([string]$outputs.ClientId).Trim()
  }

  $missing = @()
  if ($result.ApiBaseUrl -notmatch '^https://') { $missing += "CloudFrontUrl/ApiEndpoint HTTPS" }
  if ([string]::IsNullOrWhiteSpace($result.Region)) { $missing += "Region" }
  if ([string]::IsNullOrWhiteSpace($result.UserPoolId)) { $missing += "UserPoolId" }
  if ([string]::IsNullOrWhiteSpace($result.ClientId)) { $missing += "MobileClientId" }

  if ($missing.Count -gt 0) {
    throw "File outputs thiếu hoặc sai: $($missing -join ', ')."
  }

  return $result
}

function Get-FlutterRunDefines {
  param([Parameter(Mandatory = $true)]$Outputs)

  return @(
    "--dart-define=API_BASE_URL=$($Outputs.ApiBaseUrl)",
    "--dart-define=AWS_REGION=$($Outputs.Region)",
    "--dart-define=COGNITO_USER_POOL_ID=$($Outputs.UserPoolId)",
    "--dart-define=COGNITO_CLIENT_ID=$($Outputs.ClientId)"
  )
}
