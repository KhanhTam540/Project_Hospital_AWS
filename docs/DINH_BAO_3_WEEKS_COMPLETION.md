# Hoàn thành công việc 3 tuần của Đình Bảo

Tài liệu này áp dụng cho project hiện tại có stack `HospitalDevStack`. Không đổi tên stack trong lần cập nhật này để tránh tạo lại tài nguyên AWS và làm mất liên kết với môi trường đang chạy.

## 1. Phạm vi đã chốt

### Tuần 1 — Medical Data Lambda

- Bệnh nhân.
- Hồ sơ bệnh án.
- Phiếu khám.
- Đơn thuốc.
- Tài liệu y tế trên S3 private.
- KMS và Presigned URL.

### Tuần 2 — AI, xét nghiệm, dược phẩm và audit

- Quy trình yêu cầu xét nghiệm.
- Quy trình nhập, cập nhật, duyệt và hủy kết quả xét nghiệm.
- Dược phẩm giữ nguyên module CRUD hiện có.
- Trợ lý AI dùng external OpenAI-compatible API theo quyết định của project.
- AI summary chỉ được đưa vào hồ sơ khi bác sĩ phê duyệt.
- Blockchain chỉ áp dụng cho các thành phần thuộc hồ sơ bệnh án.

Các loại dữ liệu được audit:

- `MEDICAL_RECORD`
- `EXAMINATION`
- `LAB_RESULT`
- `PRESCRIPTION`
- `MEDICAL_DOCUMENT`
- `INVOICE`
- `AI_MEDICAL_SUMMARY`

DynamoDB/S3 lưu dữ liệu thật. Audit chỉ lưu SHA-256 và metadata tối thiểu. Chế độ mặc định là `DYNAMODB_HASH_ONLY`; khi cấu hình đủ AMB Ethereum thì chuyển sang `AMB_ETHEREUM`.

### Tuần 3 — Payment & SMS

- Hóa đơn, chi tiết hóa đơn và giỏ hàng.
- Thanh toán thủ công.
- Tạo URL thanh toán VNPay/MoMo.
- Return URL, callback và IPN.
- Xác minh chữ ký, mã hóa đơn, số tiền và trạng thái.
- Idempotency chống xử lý giao dịch lặp.
- SNS OTP: gửi, gửi lại và xác minh.
- Tùy chọn bắt buộc OTP trước khi tạo giao dịch thanh toán.

## 2. Các file hoàn chỉnh được bổ sung hoặc thay thế

```text
.env.infrastructure.example
lib/hospital-stack.js
lib/operations-resources.js
package.json
package-lock.json
services/medical/handler.js
services/medical/lab-workflow.js
services/medical-audit/domain.js
services/medical-audit/handler.js
services/payment-sms/domain.js
services/payment-sms/handler.js
scripts/test-medical-api.js
scripts/test-payment-sms-api.js
tests/lab-workflow.test.js
tests/medical-audit.test.js
tests/payment-sms.test.js
docs/DINH_BAO_3_WEEKS_COMPLETION.md
docs/dinh-bao-integration-secret-template.json
```

## 3. Kết quả kiểm tra trước khi bàn giao patch

```text
npm run test:dinhbao
19 test passed, 0 failed

npm run build
JavaScript syntax check passed

ENABLE_WEEK3_OPERATIONS=true npx cdk synth HospitalDevStack
Synth thành công
```

Không dùng kết quả `npm test` của bản project được trích chọn để kết luận toàn bộ frontend/mobile, vì bản kiểm tra này chỉ chứa các file cần thiết cho backend Đình Bảo.

## 4. Tạo branch làm việc

```powershell
git checkout develop
git pull origin develop
git checkout -b feat/dinhbao-complete-3-weeks
```

Áp dụng patch rồi kiểm tra:

```powershell
npm install
npm run test:dinhbao
npm run build
```

Kết quả yêu cầu:

```text
19 passed
0 failed
JavaScript syntax check passed
```

## 5. Cấu hình PowerShell cho tài khoản AWS

Thay profile nếu máy đang dùng tên khác.

```powershell
$Profile = "hospital-dev"
$Region = "ap-southeast-1"

$env:AWS_PROFILE = $Profile
$env:AWS_REGION = $Region
$env:AWS_DEFAULT_REGION = $Region
$env:APPLICATION_REGION = $Region
$env:STACK_NAME = "HospitalDevStack"

aws sts get-caller-identity --profile $Profile
```

Chỉ tiếp tục khi Account ID là tài khoản AWS hiện tại của project.

## 6. Cấu hình hạ tầng lần đầu

Triển khai trước ở chế độ hash-only để kiểm tra luồng audit mà chưa phát sinh giao dịch Blockchain:

```powershell
$env:ENABLE_API_ROUTES = "true"
$env:ENABLE_WEEK3_OPERATIONS = "true"
$env:ENABLE_MANAGED_BLOCKCHAIN_PERMISSIONS = "true"
$env:BLOCKCHAIN_MODE = "DYNAMODB_HASH_ONLY"
$env:REQUIRE_PAYMENT_OTP = "false"
$env:RETAIN_DATA = "true"
```

Nếu dùng CloudFront hiện tại:

```powershell
$env:ENABLE_CLOUDFRONT = "true"
$env:USE_EXISTING_CLOUDFRONT = "true"
$env:EXISTING_CLOUDFRONT_DISTRIBUTION_ID = "YOUR_DISTRIBUTION_ID"
$env:EXISTING_CLOUDFRONT_DOMAIN = "YOUR_DOMAIN.cloudfront.net"
$env:FRONTEND_ALLOWED_ORIGIN = "https://YOUR_DOMAIN.cloudfront.net"
```

Nếu chỉ kiểm tra backend:

```powershell
$env:ENABLE_CLOUDFRONT = "false"
$env:USE_EXISTING_CLOUDFRONT = "false"
$env:FRONTEND_ALLOWED_ORIGIN = "http://localhost:5173"
```

## 7. Synth, diff và deploy

```powershell
Remove-Item .\cdk.out -Recurse -Force -ErrorAction SilentlyContinue

npx cdk synth HospitalDevStack --profile $Profile
npx cdk diff HospitalDevStack --profile $Profile
npx cdk deploy HospitalDevStack --profile $Profile
```

Sau deploy:

```powershell
npm run outputs
Get-Content .\docs\aws-dev-outputs.json
```

Phải có thêm các output:

```text
MedicalAuditFunctionName
PaymentSmsFunctionName
IntegrationSecretArn
BlockchainMode
```

Kiểm tra trạng thái stack:

```powershell
aws cloudformation describe-stacks `
  --stack-name HospitalDevStack `
  --region $Region `
  --profile $Profile `
  --query "Stacks[0].StackStatus" `
  --output text
```

Kết quả cần là `UPDATE_COMPLETE` hoặc `CREATE_COMPLETE`.

## 8. Cấu hình Secrets Manager

Lấy output:

```powershell
$Outputs = Get-Content .\docs\aws-dev-outputs.json | ConvertFrom-Json
$SecretArn = $Outputs.IntegrationSecretArn
$ApiEndpoint = $Outputs.ApiEndpoint.TrimEnd('/')
```

Tải secret hiện tại ra file tạm để giữ nguyên `INTERNAL_SIGNING_KEY`:

```powershell
aws secretsmanager get-secret-value `
  --secret-id $SecretArn `
  --region $Region `
  --profile $Profile `
  --query SecretString `
  --output text | Set-Content .\integration-secret.local.json
```

Mở file:

```powershell
notepad .\integration-secret.local.json
```

Cập nhật các URL:

```text
VNPAY_RETURN_URL = {ApiEndpoint}/api/payment/vnpay-return
VNPAY_IPN_URL = {ApiEndpoint}/api/payment/vnpay-ipn
MOMO_REDIRECT_URL = {ApiEndpoint}/api/payment/momo-callback
MOMO_IPN_URL = {ApiEndpoint}/api/payment/momo-ipn
PAYMENT_RESULT_URL = https://YOUR_FRONTEND_HOST/payment-result
```

Điền credential sandbox do VNPay và MoMo cấp. Không tự tạo giả `HASH_SECRET`, `ACCESS_KEY` hoặc `SECRET_KEY`.

Cập nhật secret:

```powershell
aws secretsmanager put-secret-value `
  --secret-id $SecretArn `
  --secret-string file://integration-secret.local.json `
  --region $Region `
  --profile $Profile
```

Xóa file tạm ngay sau đó:

```powershell
Remove-Item .\integration-secret.local.json -Force
```

Không commit file chứa secret.

## 9. Kiểm tra Tuần 1 và Tuần 2

Tạo token demo nếu project đã có user Cognito:

```powershell
npm run tokens:medical
```

Seed và xác minh dữ liệu:

```powershell
npm run seed:medical
npm run verify:medical
```

Chạy kiểm thử Medical, lab và audit:

```powershell
npm run test:medical:api
```

Script kiểm tra luồng:

1. Tạo bệnh nhân.
2. Tạo hồ sơ bệnh án.
3. Tạo phiếu khám gắn với hồ sơ.
4. Tạo đơn thuốc gắn với hồ sơ.
5. Tạo loại xét nghiệm và xét nghiệm.
6. Tạo yêu cầu xét nghiệm.
7. Nhập và duyệt kết quả xét nghiệm.
8. Upload tài liệu S3 và hoàn tất upload.
9. Bác sĩ phê duyệt AI summary.
10. Đợi DynamoDB Stream tạo audit.
11. Kiểm tra `/audit` và `/integrity`.

Kết quả yêu cầu:

```text
Medical Week 1 API integration test completed successfully
```

Kiểm tra audit trực tiếp:

```powershell
curl.exe `
  -H "Authorization: Bearer YOUR_ADMIN_OR_DOCTOR_TOKEN" `
  "$ApiEndpoint/api/medical-records/RECORD_ID/audit"

curl.exe `
  -H "Authorization: Bearer YOUR_ADMIN_OR_DOCTOR_TOKEN" `
  "$ApiEndpoint/api/medical-records/RECORD_ID/integrity"
```

Ở chế độ `DYNAMODB_HASH_ONLY`, audit item phải có:

```text
blockchainStatus = HASH_ONLY
payloadHash = 64 ký tự hex
```

## 10. Kích hoạt Blockchain thật

Chỉ thực hiện sau khi chế độ hash-only hoạt động ổn định.

Cần chuẩn bị:

- AMB Ethereum RPC endpoint/token.
- Một test wallet riêng cho project.
- Test coin đủ trả gas.
- Chain ID đúng với mạng đang sử dụng.

Cập nhật secret:

```text
BLOCKCHAIN_MODE=AMB_ETHEREUM
AMB_ETHEREUM_RPC_URL=<RPC URL đầy đủ>
AMB_ETHEREUM_PRIVATE_KEY=<private key của test wallet>
AMB_ETHEREUM_CHAIN_ID=<chain id>
```

Cập nhật biến deploy:

```powershell
$env:BLOCKCHAIN_MODE = "AMB_ETHEREUM"
npx cdk deploy HospitalDevStack --profile $Profile
```

Sau đó tạo hoặc cập nhật một thành phần hồ sơ bệnh án và kiểm tra audit. Kết quả yêu cầu:

```text
blockchainStatus = CONFIRMED
blockchainTransactionId = 0x...
blockchainBlockNumber có giá trị
```

Private key chỉ được lưu trong Secrets Manager. Không đưa vào `.env`, source code, ảnh báo cáo hoặc GitHub.

## 11. Kiểm tra SNS OTP

Nếu tài khoản đang ở SNS SMS sandbox, cần xác minh số điện thoại nhận thử trong cùng Region.

Đặt số thử theo E.164:

```powershell
$env:TEST_PHONE_NUMBER = "+84901234567"
```

Mặc định `REQUIRE_PAYMENT_OTP=false`, vì vậy thanh toán có thể kiểm tra độc lập. Sau khi frontend đã hoàn thành luồng gửi và xác minh OTP, bật:

```powershell
$env:REQUIRE_PAYMENT_OTP = "true"
npx cdk deploy HospitalDevStack --profile $Profile
```

Luồng frontend phải là:

```text
POST /api/otp/send
POST /api/otp/verify
Nhận otpToken
POST /api/payment/create-url kèm otpToken
```

## 12. Kiểm tra Tuần 3

Chạy test backend local:

```powershell
npm run test:payment
```

Chạy integration test AWS:

```powershell
npm run test:week3:api
```

Script kiểm tra:

- Tạo giỏ hàng.
- Xác nhận giỏ hàng thành hóa đơn.
- Thanh toán thủ công.
- Gửi lại cùng idempotency key và kiểm tra không tạo giao dịch trùng.
- Tùy chọn gửi/xác minh SNS OTP nếu có `TEST_PHONE_NUMBER`.
- Tùy chọn tạo giao dịch VNPay nếu secret sandbox đã cấu hình.

MoMo và VNPay chỉ được xác nhận hoàn tất khi callback/IPN thật đi đến API và chữ ký hợp lệ.

## 13. Kiểm tra CloudWatch

```powershell
aws logs tail `
  "/aws/lambda/$($Outputs.MedicalAuditFunctionName)" `
  --since 30m `
  --follow `
  --region $Region `
  --profile $Profile
```

Terminal khác:

```powershell
aws logs tail `
  "/aws/lambda/$($Outputs.PaymentSmsFunctionName)" `
  --since 30m `
  --follow `
  --region $Region `
  --profile $Profile
```

Không được còn lỗi quyền DynamoDB, Secrets Manager, SNS hoặc lỗi route.

## 14. Checklist hoàn thành

### Tuần 1

- [ ] MedicalFunction deploy thành công.
- [ ] Bệnh nhân, hồ sơ, phiếu khám và đơn thuốc hoạt động.
- [ ] Upload/download S3 Presigned URL hoạt động.
- [ ] Bucket private và mã hóa KMS.
- [ ] `npm run test:medical:api` thành công.

### Tuần 2

- [ ] CRUD loại xét nghiệm và xét nghiệm hoạt động.
- [ ] Yêu cầu xét nghiệm hoạt động.
- [ ] Nhập/cập nhật/duyệt kết quả xét nghiệm hoạt động.
- [ ] Dược phẩm hiện có hoạt động.
- [ ] External AI hoạt động.
- [ ] Bác sĩ phê duyệt AI summary vào hồ sơ.
- [ ] MedicalAuditFunction nhận DynamoDB Stream.
- [ ] Audit chỉ áp dụng cho dữ liệu thuộc hồ sơ bệnh án.
- [ ] API audit/integrity trả đúng kết quả.
- [ ] AMB Ethereum trả transaction hash nếu project bắt buộc Blockchain thật.

### Tuần 3

- [ ] PaymentSmsFunction deploy thành công.
- [ ] Giỏ hàng, hóa đơn, chi tiết hóa đơn hoạt động.
- [ ] Thanh toán thủ công hoạt động.
- [ ] VNPay create URL và IPN hoạt động trên sandbox.
- [ ] MoMo create URL và IPN hoạt động trên sandbox.
- [ ] Callback sai chữ ký bị từ chối.
- [ ] Callback lặp không tạo giao dịch trùng.
- [ ] SNS OTP send/resend/verify hoạt động.
- [ ] Integration test hoạt động.

## 15. Commit và Pull Request

```powershell
git status
git add -A
git commit -m "feat: complete Dinh Bao backend tasks for three weeks"
git push -u origin feat/dinhbao-complete-3-weeks
```

Tạo Pull Request:

```text
base: develop
compare: feat/dinhbao-complete-3-weeks
```

Chỉ merge vào `develop` khi test, synth và deploy đều đạt. Đến tuần cuối, cả nhóm mới kiểm thử `develop` rồi merge sang `main`.
