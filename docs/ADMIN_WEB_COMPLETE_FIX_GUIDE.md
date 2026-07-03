# Hoàn thiện Web Admin Hospital P2TB

Bộ sửa đổi này chỉ tập trung vào Web Admin và backend API phục vụ Web Admin. Không thay đổi nghiệp vụ Mobile.

## Phạm vi đã hoàn thiện

- Dashboard Admin không còn khối hạ tầng AWS.
- Không còn trang/menu duyệt đăng ký hoặc liên kết Cognito riêng.
- Tài khoản do Admin tạo được đặt mật khẩu vĩnh viễn, trạng thái `CONFIRMED`, không cần OTP.
- Quản lý tài khoản có: danh sách, tạo, xem/sửa, phân quyền, khóa và kích hoạt lại.
- Core Lambda sử dụng đầy đủ router trong `services/core/routes.js` thay vì switch handler cũ.
- CRUD Web Admin được đăng ký đầy đủ cho:
  - Tài khoản và phân quyền.
  - Khoa, phòng khám, phòng khám ngoài.
  - Bác sĩ, nhân sự, ca trực, lịch làm việc, lịch khám.
  - Bệnh nhân, hồ sơ bệnh án.
  - Loại xét nghiệm, xét nghiệm.
  - Thuốc, nhóm thuốc, đơn vị tính.
  - Phản hồi, tin tức.
- Dashboard lấy thống kê từ API thật.
- Đã xóa trang Trợ lý bác sĩ và service liên quan.
- Stack tiếp tục sử dụng CloudFront hiện có, không tạo Distribution/OAC/Function mới.

## Các file phải xóa

```text
web/src/pages/admin/CognitoLinkPage.jsx
web/src/pages/admin/nhansu/TroLyBacSiPage.jsx
web/src/services/troly/trolyService.js
mobile/android/local.properties
```

`mobile/android/local.properties` là file máy cục bộ, không được đóng gói hoặc commit. Việc xóa file này không thay đổi source Mobile.

## Áp dụng Overlay

1. Backup project hiện tại.
2. Giải nén `Hospital_Admin_Web_Complete_Fix_Overlay.zip`.
3. Copy toàn bộ nội dung trong thư mục overlay vào thư mục gốc project và chọn ghi đè.
4. Xóa các file liệt kê trong `DELETED_FILES.txt`.

PowerShell:

```powershell
cd D:\AWS\Project\Project_Hospital_AWS_P2TB

Remove-Item .\web\src\pages\admin\CognitoLinkPage.jsx -ErrorAction SilentlyContinue
Remove-Item .\web\src\pages\admin\nhansu\TroLyBacSiPage.jsx -ErrorAction SilentlyContinue
Remove-Item .\web\src\services\troly\trolyService.js -ErrorAction SilentlyContinue
Remove-Item .\mobile\android\local.properties -ErrorAction SilentlyContinue
```

## Kiểm tra local

```powershell
npm install
npm --prefix web install

npm run build
npm test
npm run validate:data:local
npm run build:web
```

Kết quả bộ mã đã kiểm tra trước khi bàn giao:

```text
JavaScript syntax: 115 files passed
Unit/contract tests: 47/47 passed
Dataset validation: 68 items / 19 files passed
Vite production build: passed
CDK synth: passed
CloudFront Distribution trong template: 0
CloudFront OAC trong template: 0
CloudFront Function trong template: 0
Admin CRUD routes thiếu: 0
```

## Nạp biến môi trường deploy

Nếu PowerShell chặn file `.ps1`, khai báo trực tiếp trong cửa sổ hiện tại:

```powershell
$env:AWS_PROFILE = "hospital-dev"
$env:AWS_REGION = "ap-southeast-1"
$env:AWS_DEFAULT_REGION = "ap-southeast-1"
$env:CDK_DEFAULT_REGION = "ap-southeast-1"
$env:APPLICATION_REGION = "ap-southeast-1"
$env:STACK_NAME = "HospitalDevStack"
$env:DEPLOY_TARGET = "app"

$env:ENABLE_CLOUDFRONT = "true"
$env:USE_EXISTING_CLOUDFRONT = "true"
$env:EXISTING_CLOUDFRONT_DISTRIBUTION_ID = "E1KEJ6QT3MJVZ8"
$env:EXISTING_CLOUDFRONT_DOMAIN = "dd5ev4p2d0llq.cloudfront.net"

$env:ENABLE_API_ROUTES = "true"
$env:ENABLE_WEEK3_OPERATIONS = "true"
$env:RETAIN_DATA = "true"
```

## Synth và kiểm tra CloudFront

```powershell
Remove-Item -Recurse -Force .\cdk.out -ErrorAction SilentlyContinue
npx cdk synth HospitalDevStack --profile hospital-dev
```

```powershell
$Template = Get-Content .\cdk.out\HospitalDevStack.template.json -Raw | ConvertFrom-Json

@(
  $Template.Resources.PSObject.Properties |
    Where-Object { $_.Value.Type -eq "AWS::CloudFront::Distribution" }
).Count

@(
  $Template.Resources.PSObject.Properties |
    Where-Object { $_.Value.Type -eq "AWS::CloudFront::OriginAccessControl" }
).Count

@(
  $Template.Resources.PSObject.Properties |
    Where-Object { $_.Value.Type -eq "AWS::CloudFront::Function" }
).Count
```

Cả ba kết quả phải bằng `0`.

## Diff và deploy backend

```powershell
npx cdk diff HospitalDevStack --profile hospital-dev
npx cdk deploy HospitalDevStack --profile hospital-dev
```

Không deploy nếu diff dự định thay thế/xóa DynamoDB table, Cognito User Pool, S3 bucket, KMS key hoặc CloudFront Distribution hiện tại.

## Seed dữ liệu danh mục Admin

```powershell
$TableName = aws cloudformation describe-stacks `
  --stack-name HospitalDevStack `
  --region ap-southeast-1 `
  --profile hospital-dev `
  --query "Stacks[0].Outputs[?OutputKey=='TableName'].OutputValue | [0]" `
  --output text

$env:TABLE_NAME = $TableName
npm run seed:data
npm run verify:data
```

## Deploy Web

```powershell
npm run outputs
npm run deploy:web

$InvalidationId = aws cloudfront create-invalidation `
  --distribution-id E1KEJ6QT3MJVZ8 `
  --paths "/*" `
  --profile hospital-dev `
  --query "Invalidation.Id" `
  --output text

aws cloudfront wait invalidation-completed `
  --distribution-id E1KEJ6QT3MJVZ8 `
  --id $InvalidationId `
  --profile hospital-dev
```

## Checklist Web Admin

```text
[ ] Dashboard không còn phần hạ tầng AWS
[ ] Không còn trang/menu duyệt đăng ký
[ ] Không còn Trợ lý bác sĩ
[ ] Admin tạo tài khoản nhận trạng thái CONFIRMED
[ ] Tài khoản đăng nhập ngay, không OTP
[ ] Danh sách tài khoản tải được
[ ] Sửa vai trò/thông tin tài khoản được
[ ] Khóa và kích hoạt lại tài khoản được
[ ] CRUD khoa và phòng khám được
[ ] CRUD bác sĩ, nhân sự, ca trực được
[ ] CRUD lịch khám được
[ ] CRUD bệnh nhân và hồ sơ bệnh án được
[ ] CRUD loại xét nghiệm và xét nghiệm được
[ ] CRUD thuốc, nhóm thuốc, đơn vị tính được
[ ] Quản lý phản hồi được
[ ] CRUD tin tức được
[ ] Các trang thống kê tải được dữ liệu
[ ] F12 Network không còn 404 route hoặc 500 do handler cũ
```
