# Kiểm thử công việc 3 tuần của Hoàng Phúc

## Kiểm tra tĩnh và unit test

```powershell
npm install
npm run build
npm test
npm run validate:data:local
```

Kết quả chuẩn:

```text
JavaScript syntax check passed
33+ tests passed
0 failed
Local dataset validation completed successfully
```

## Build frontend

```powershell
npm --prefix web install
npm run build:web
```

Cảnh báo chunk lớn hoặc Browserslist cũ không làm build thất bại.

## Synth CDK

```powershell
$env:AWS_PROFILE="hospital-dev"
$env:AWS_REGION="ap-southeast-1"
$env:AWS_DEFAULT_REGION="ap-southeast-1"
$env:CDK_DEFAULT_REGION="ap-southeast-1"
$env:ENABLE_CLOUDFRONT="false"
$env:ENABLE_WEEK3_OPERATIONS="true"
$env:RETAIN_DATA="true"

npm run synth:app
```

Kiểm tra template có:

```text
AWS::DynamoDB::Table với gsi1
AWS::SQS::Queue và DLQ
CoreWorkerFunction
AWS::Lambda::EventSourceMapping
POST /api/tai-khoan
CRUD khoa/phòng/bác sĩ/nhân sự/ca/lịch
PATCH /api/lichkham/{appointmentId}/status
```

## Dataset trên AWS

```powershell
$env:TABLE_NAME="<CloudFormation TableName output>"
npm run seed:data
npm run verify:data
npm run reset:data
npm run seed:data
npm run verify:data
```

## Core API smoke test

```powershell
$env:API_ENDPOINT="https://<api-id>.execute-api.ap-southeast-1.amazonaws.com"
$env:ADMIN_TOKEN="<Cognito access token của ADMIN>"
$env:PATIENT_TOKEN="<Cognito access token của BENHNHAN>" # tùy chọn
npm run test:core:api
```

Bật kiểm tra CRUD khoa tạm thời:

```powershell
$env:CORE_API_MUTATION_TEST="true"
npm run test:core:api
```

Script tự tạo, cập nhật và xóa một khoa kiểm thử.

## Kiểm tra email Cognito

1. Đăng nhập giao diện bằng ADMIN Cognito.
2. Tạo user từ `/admin/taikhoan/tao-moi`.
3. F12 → Network → `POST /api/tai-khoan` phải trả `201`.
4. Cognito → Users: user mới có trạng thái `FORCE_CHANGE_PASSWORD`.
5. Cognito → Groups: user thuộc group đã chọn.
6. Kiểm tra Inbox, Spam và Promotions.
7. Dùng nút/API resend invitation nếu cần.

## Kiểm tra lịch trùng

1. Tạo ca trực và lịch làm việc bác sĩ.
2. Tạo lịch hẹn hợp lệ → `201`.
3. Tạo lại cùng bác sĩ, bệnh nhân và thời điểm → `409`.
4. Kiểm tra DynamoDB có `DOCTOR_SLOT#...` và `PATIENT_SLOT#...`.

## Kiểm tra SQS Worker

1. Tạo khoa/tài khoản/lịch hẹn qua API.
2. SQS queue nhận message rồi trở về 0 sau khi Worker xử lý.
3. CloudWatch Worker có log `Background event processed`.
4. DynamoDB có item `EVENT#...`, `AUDIT#...`, `NOTIFICATION#...`.
5. Worker trả partial batch response khi message sai.
