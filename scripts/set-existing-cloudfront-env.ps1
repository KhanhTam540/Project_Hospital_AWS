$ErrorActionPreference = "Stop"

$Profile = "hospital-dev"
$Region = "ap-southeast-1"
$Stack = "HospitalDevStack"
$DistributionId = "E1KEJ6QT3MJVZ8"
$DistributionDomain = "dd5ev4p2d0llq.cloudfront.net"

$env:AWS_PROFILE = $Profile
$env:AWS_REGION = $Region
$env:AWS_DEFAULT_REGION = $Region
$env:CDK_DEFAULT_REGION = $Region
$env:APPLICATION_REGION = $Region
$env:STACK_NAME = $Stack
$env:DEPLOY_TARGET = "app"

$env:ENABLE_CLOUDFRONT = "true"
$env:USE_EXISTING_CLOUDFRONT = "true"
$env:EXISTING_CLOUDFRONT_DISTRIBUTION_ID = $DistributionId
$env:EXISTING_CLOUDFRONT_DOMAIN = $DistributionDomain

$env:ENABLE_API_ROUTES = "true"
$env:ENABLE_WEEK3_OPERATIONS = "true"
$env:RETAIN_DATA = "true"

$WebAclArn = aws cloudfront get-distribution `
  --id $DistributionId `
  --profile $Profile `
  --query "Distribution.DistributionConfig.WebACLId" `
  --output text

if (
  $LASTEXITCODE -eq 0 -and
  $WebAclArn -and
  $WebAclArn -ne "None" -and
  $WebAclArn -ne "null"
) {
  $env:CLOUDFRONT_WEB_ACL_ARN = $WebAclArn
} else {
  Remove-Item Env:CLOUDFRONT_WEB_ACL_ARN -ErrorAction SilentlyContinue
}

Write-Host "AWS profile          :" $env:AWS_PROFILE
Write-Host "Region               :" $env:AWS_REGION
Write-Host "Stack                :" $env:STACK_NAME
Write-Host "Use existing CF      :" $env:USE_EXISTING_CLOUDFRONT
Write-Host "Distribution ID      :" $env:EXISTING_CLOUDFRONT_DISTRIBUTION_ID
Write-Host "Distribution domain  :" $env:EXISTING_CLOUDFRONT_DOMAIN
Write-Host "Web ACL ARN          :" $env:CLOUDFRONT_WEB_ACL_ARN
