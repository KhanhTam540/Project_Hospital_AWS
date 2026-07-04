# Hướng dẫn hoàn thành 3 tuần của Hoàng Phúc

## 1. Những phần đã được hoàn thiện trong bộ code này

### Tuần 1

- Shared backend: HTTP, JWT/RBAC, validation và DynamoDB helper.
- Core API: health, me, admin ping.
- Cognito Post Confirmation tự gán `BENHNHAN` và tạo USER/PATIENT.
- DynamoDB single-table với `pk`, `sk`, `gsi1pk`, `gsi1sk`.
- Dataset, seed, verify, reset và kiểm tra local.
- Unit test nền tảng.

### Tuần 2

- Cognito Admin APIs: danh sách, tạo, cập nhật role, khóa, kích hoạt, gửi lại email mời.
- CRUD khoa, phòng nội viện và phòng khám ngoài.
- CRUD bác sĩ, nhân sự và ca trực.
- CRUD lịch làm việc, kiểm tra trùng lịch.
- CRUD lịch hẹn, kiểm tra bác sĩ có lịch, khóa slot bác sĩ/bệnh nhân bằng DynamoDB transaction.
- RBAC và ownership cho bệnh nhân/bác sĩ.
- Đồng bộ các URL frontend chính.

### Tuần 3

- SQS Queue và DLQ.
- Core Lambda producer dùng `SendMessageCommand`.
- `CoreWorkerFunction` nhận SQS event.
- Partial batch response.
- Idempotency marker, audit và notification trong DynamoDB.
- CloudWatch alarm/dashboard cho Worker.
- Unit/API smoke test và tài liệu.

---

## 2. Backup và tạo branch

```powershell
cd D:\AWS\Project\Project_Hospital_AWS_P2TB

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Compress-Archive `
  -Path .\* `
  -DestinationPath "..\Project_Hospital_AWS_P2TB-backup-$stamp.zip"

git status
git checkout develop
git pull origin develop
git checkout -b feat/week1-3-core-backend/hoangphuc
```

Không copy `.git`, `node_modules`, `cdk.out`, `web/dist`, `.env.local` hoặc token từ bộ project khác.

---

## 3. Chép code

Cách an toàn:

1. Giải nén `HoangPhuc_3Weeks_Overlay.zip`.
2. Copy các thư mục trong overlay vào thư mục gốc project.
3. Chọn **Replace files in destination**.
4. Không xóa các file khác của Khánh Tâm, Hoài Phúc, Đình Bảo hoặc Cao Thiên.

Các file chính được thêm/sửa:

```text
lib/hospital-stack.js
lib/operations-resources.js
services/core/*
services/core-worker/handler.js
services/shared/*
dataset/shifts.json
dataset/external-clinics.json
scripts/validate-dataset-local.js
scripts/test-core-api.js
scripts/verify-dynamodb-data.js
tests/core-domain.test.js
tests/core-routes.test.js
tests/core-worker.test.js
web/src/pages/admin/CreateUserForm.jsx
web/.env.example
docs/*.md
package.json
package-lock.json
```

---

## 4. Cài dependency

```powershell
npm install
npm --prefix web install
```

`package-lock.json` đã được cập nhật thêm `@aws-sdk/client-sqs`. Không dùng `npm install --force` nếu chưa có lỗi dependency cụ thể.

---

## 5. Kiểm tra local

```powershell
npm run build
npm test
npm run validate:data:local
npm run build:web
```

Mục tiêu:

```text
JavaScript syntax check passed
0 tests failed
Local dataset validation completed successfully
vite build thành công
```

---

## 6. Thiết lập AWS

```powershell
$env:AWS_PROFILE="hospital-dev"
$env:AWS_REGION="ap-southeast-1"
$env:AWS_DEFAULT_REGION="ap-southeast-1"
$env:CDK_DEFAULT_REGION="ap-southeast-1"
$env:ENABLE_CLOUDFRONT="false"
$env:ENABLE_WEEK3_OPERATIONS="true"
$env:RETAIN_DATA="true"

aws sts get-caller-identity --profile hospital-dev
```

Kiểm tra Account phải là tài khoản AWS hiện tại của nhóm.

---

## 7. Synth và kiểm tra thay đổi

```powershell
Remove-Item -Recurse -Force .\cdk.out -ErrorAction SilentlyContinue

npm run synth:app
npm run diff:app
```

Trước khi deploy, đọc kỹ diff. Không tiếp tục nếu CDK dự định xóa bảng DynamoDB, Medical S3 hoặc KMS key ngoài chủ ý.

Bản sửa này khai báo lại `gsi1`; nếu AWS đã có GSI cùng logical resource thì CDK phải nhận là cập nhật/no-op, không phải xóa dữ liệu.

---

## 8. Deploy

```powershell
npm run deploy:app
```

Hoặc:

```powershell
npx cdk deploy HospitalDevStack --profile hospital-dev
```

Kết quả phải là:

```text
UPDATE_COMPLETE
```

Kiểm tra Outputs:

```powershell
aws cloudformation describe-stacks `
  --stack-name HospitalDevStack `
  --region ap-southeast-1 `
  --profile hospital-dev `
  --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" `
  --output table
```

Phải có `ApiEndpoint`, `TableName`, `UserPoolId`, `WebClientId`, `BackgroundQueueUrl`, `BackgroundDlqUrl`, `CoreWorkerFunctionName`.

---

## 9. Tạo cấu hình frontend

```powershell
$stack="HospitalDevStack"
$region="ap-southeast-1"
$profile="hospital-dev"

$api = aws cloudformation describe-stacks `
  --stack-name $stack --region $region --profile $profile `
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue | [0]" `
  --output text

$userPool = aws cloudformation describe-stacks `
  --stack-name $stack --region $region --profile $profile `
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue | [0]" `
  --output text

$webClient = aws cloudformation describe-stacks `
  --stack-name $stack --region $region --profile $profile `
  --query "Stacks[0].Outputs[?OutputKey=='WebClientId'].OutputValue | [0]" `
  --output text

@"
VITE_API_BASE_URL=$api/api
VITE_COGNITO_ENABLED=true
VITE_COGNITO_REGION=$region
VITE_COGNITO_USER_POOL_ID=$userPool
VITE_COGNITO_CLIENT_ID=$webClient
VITE_COGNITO_USER_POOL_CLIENT_ID=$webClient
VITE_SOCKET_ENABLED=false
VITE_SOCKET_URL=
"@ | Set-Content .\web\.env.local -Encoding utf8
```

Khởi động lại Vite sau khi đổi `.env.local`:

```powershell
npm run dev:web
```

---

## 10. Seed dữ liệu

```powershell
$table = aws cloudformation describe-stacks `
  --stack-name HospitalDevStack `
  --region ap-southeast-1 `
  --profile hospital-dev `
  --query "Stacks[0].Outputs[?OutputKey=='TableName'].OutputValue | [0]" `
  --output text

$env:TABLE_NAME=$table
npm run seed:data
npm run verify:data
```

Không chạy `reset:data` trên môi trường có dữ liệu thật nếu chưa kiểm tra `dataSource=P2TB_SAMPLE`.

---

## 11. Kiểm tra Tuần 1

1. Mở `<ApiEndpoint>/api/health` → HTTP 200.
2. Đăng nhập Cognito → `/api/me` trả profile và group.
3. ADMIN gọi `/api/admin/ping` → 200.
4. BENHNHAN gọi `/api/admin/ping` → 403.
5. Bệnh nhân tự đăng ký, xác nhận email → tự vào group BENHNHAN.
6. DynamoDB có dữ liệu mẫu và GSI `gsi1` Active.

---

## 12. Kiểm tra Tuần 2

### Tạo tài khoản và email

1. Đăng nhập web bằng ADMIN Cognito.
2. Mở `/admin/taikhoan/tao-moi`.
3. Chọn role và nhập mật khẩu tạm đúng policy.
4. `POST /api/tai-khoan` phải trả 201.
5. Cognito user ở trạng thái `FORCE_CHANGE_PASSWORD`.
6. User thuộc đúng group.
7. Email mời xuất hiện trong Inbox/Spam.

### CRUD nghiệp vụ

Kiểm tra thêm/sửa/xóa:

```text
Khoa
Phòng nội viện
Phòng khám ngoài
Bác sĩ
Nhân sự
Ca trực
Lịch làm việc
Lịch hẹn
```

Tạo một lịch hẹn trùng giờ phải trả 409.

---

## 13. Kiểm tra Tuần 3

1. Tạo tài khoản/khoa/lịch qua API.
2. Core Lambda gửi message vào BackgroundTaskQueue.
3. CoreWorkerFunction xử lý và queue trở về 0.
4. CloudWatch không có Worker error.
5. DynamoDB có `EVENT#`, `AUDIT#`, `NOTIFICATION#`.
6. Message sai retry tối đa 5 lần rồi vào DLQ.

Xem log:

```powershell
$worker = aws cloudformation describe-stacks `
  --stack-name HospitalDevStack `
  --region ap-southeast-1 `
  --profile hospital-dev `
  --query "Stacks[0].Outputs[?OutputKey=='CoreWorkerFunctionName'].OutputValue | [0]" `
  --output text

aws logs tail "/aws/lambda/$worker" `
  --since 30m `
  --region ap-southeast-1 `
  --profile hospital-dev
```

---

## 14. Chạy smoke test

```powershell
$env:API_ENDPOINT=$api
$env:ADMIN_TOKEN="<access-token-admin>"
$env:PATIENT_TOKEN="<access-token-benhnhan>"
npm run test:core:api
```

Bật kiểm thử mutation tạm thời:

```powershell
$env:CORE_API_MUTATION_TEST="true"
npm run test:core:api
```

---

## 15. Commit Git

```powershell
git status --short

git add lib services dataset scripts tests docs web/src/pages/admin/CreateUserForm.jsx web/.env.example package.json package-lock.json README.md

git commit -m "feat: complete Hoang Phuc three-week core backend"
git push -u origin feat/week1-3-core-backend/hoangphuc
```

Tạo Pull Request:

```text
feat/week1-3-core-backend/hoangphuc → develop
```

Không merge vào `main` trước khi toàn nhóm kiểm thử tích hợp.

---

## 16. Checklist hoàn thành 100%

### Tuần 1

- [ ] Build/test/synth thành công.
- [ ] Health/me/admin ping đúng.
- [ ] Post Confirmation tự gán BENHNHAN.
- [ ] Dataset seed/verify/reset đúng.
- [ ] DynamoDB `gsi1` Active.

### Tuần 2

- [ ] Tài khoản Cognito CRUD và email mời.
- [ ] CRUD khoa/phòng.
- [ ] CRUD bác sĩ/nhân sự.
- [ ] CRUD ca và lịch làm việc.
- [ ] CRUD lịch hẹn và chống trùng.
- [ ] RBAC/ownership đúng.
- [ ] Frontend không còn 404 cho API Core.

### Tuần 3

- [ ] SQS producer hoạt động.
- [ ] Worker Lambda hoạt động.
- [ ] Partial batch response.
- [ ] Idempotency.
- [ ] DLQ được kiểm tra.
- [ ] Unit/API tests pass.
- [ ] Tài liệu hoàn chỉnh.
