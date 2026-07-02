param(
  [string]$DeviceId = "",
  [switch]$Demo,
  [switch]$SkipPubGet
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$mobileScripts = Join-Path $projectRoot "mobile\scripts"

if ($Demo) {
  & (Join-Path $mobileScripts "run-demo.ps1") `
    -DeviceId $DeviceId `
    -SkipPubGet:$SkipPubGet
}
else {
  & (Join-Path $mobileScripts "run-aws.ps1") `
    -DeviceId $DeviceId `
    -SkipPubGet:$SkipPubGet
}

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
