# Hướng dẫn sửa luồng bác sĩ lần 2

## Các lỗi được sửa

1. Không chọn được hồ sơ bệnh án để lập phiếu khám.
2. Không chọn được phiếu khám để kê đơn thuốc.
3. Không lập được yêu cầu xét nghiệm.
4. Bác sĩ vẫn chỉnh sửa được thông tin cá nhân.

## Nguyên nhân chính

- Trang phiếu khám gọi `/phieukham/bacsi/{maBS}` trước. Route này không tồn tại nên hàm tải dữ liệu dừng ngay, khiến `/hsba` không được tải.
- Trang phiếu khám và kê đơn vẫn gửi `multipart/form-data` đến API cũ `/phieukham` và `/donthuoc`; Lambda hiện dùng JSON tại `/patients/{patientId}/...`.
- Hồ sơ được tạo bởi module quản lý dùng khóa `PATIENT#... / MEDICAL_RECORD#...`, còn Medical Lambda trước đây chỉ tìm `RECORD#... / METADATA`, nên báo `RECORD_NOT_FOUND` dù hồ sơ đang tồn tại.
- Trang kê đơn lấy phiếu khám theo API cũ và không gắn đơn thuốc với `examinationId`.
- Trang xét nghiệm chỉ gửi `maBN` và loại ưu tiên, trong khi backend cần `maHSBA` và `maXN`.
- Trang thông tin bác sĩ vẫn có state chỉnh sửa và gọi `PUT /bacsi/{maBS}`.

## Các file được thay thế hoàn chỉnh

```text
services/medical/handler.js
web/src/services/bacsi/doctorWorkflowService.js
web/src/services/bacsi/bacsiService.js
web/src/services/kham/phieukhamService.js
web/src/services/donthuoc/donthuocService.js
web/src/services/xetnghiem/yeucauxetnghiemService.js
web/src/pages/bacsi/kham/PhieuKhamPage.jsx
web/src/pages/bacsi/kham/KeDonThuocPage.jsx
web/src/pages/bacsi/xetnghiem/QuanLyYeuCauXNPage.jsx
web/src/pages/bacsi/ThongTinCaNhanPage.jsx
tests/doctor-workflow-second-fix.test.js
```

## 1. Tạo branch

```powershell
cd D:\AWS\Project\Project_Hospital_AWS_P2TB

git checkout develop
git pull origin develop
git checkout -b fix/doctor-workflow-v2
```

Nếu bạn đang có thay đổi chưa commit, chạy `git status` và sao lưu trước khi checkout.

## 2. Áp dụng patch

Giải nén `Doctor_Workflow_Fix_Patch_v2.zip`, sau đó:

```powershell
Set-ExecutionPolicy -Scope Process Bypass

cd D:\AWS\Project\Doctor_Workflow_Fix_Patch_v2

.\APPLY_PATCH.ps1 `
  -ProjectRoot "D:\AWS\Project\Project_Hospital_AWS_P2TB"
```

Script tự sao lưu file cũ trước khi ghi đè.

## 3. Kiểm tra local

```powershell
cd D:\AWS\Project\Project_Hospital_AWS_P2TB

npm install

node --test tests/doctor-workflow-second-fix.test.js
npm run test:medical
npm run test:lab
npm run build
npm --prefix web run build
```

Kết quả cần đạt:

```text
5 test doctor workflow passed
7 test medical passed
3 test lab passed
JavaScript syntax check passed
Vite built successfully
```

## 4. Deploy backend

Backend phải deploy lại vì `services/medical/handler.js` đã thay đổi.

```powershell
$Profile = "hospital-dev"
$Region = "ap-southeast-1"
$StackName = "HospitalDevStack"

$env:AWS_PROFILE = $Profile
$env:AWS_REGION = $Region
$env:AWS_DEFAULT_REGION = $Region
$env:APPLICATION_REGION = $Region
$env:STACK_NAME = $StackName

$env:ENABLE_API_ROUTES = "true"
$env:ENABLE_WEEK3_OPERATIONS = "true"
$env:RETAIN_DATA = "true"

$env:ENABLE_CLOUDFRONT = "true"
$env:USE_EXISTING_CLOUDFRONT = "true"
$env:EXISTING_CLOUDFRONT_DISTRIBUTION_ID = "E1KEJ6QT3MJVZ8"
$env:EXISTING_CLOUDFRONT_DOMAIN = "dd5ev4p2d0llq.cloudfront.net"
$env:FRONTEND_ALLOWED_ORIGIN = "https://dd5ev4p2d0llq.cloudfront.net"
```

```powershell
Remove-Item .\cdk.out -Recurse -Force -ErrorAction SilentlyContinue

npx cdk synth HospitalDevStack --profile $Profile
npx cdk diff HospitalDevStack --profile $Profile
npx cdk deploy HospitalDevStack --profile $Profile
```

Kiểm tra trạng thái:

```powershell
aws cloudformation describe-stacks `
  --stack-name $StackName `
  --region $Region `
  --profile $Profile `
  --query "Stacks[0].StackStatus" `
  --output text
```

Kết quả phải là `UPDATE_COMPLETE`.

## 5. Deploy frontend

```powershell
npm run outputs
npm run deploy:web
```

Dòng cuối phải trỏ đến CloudFront đang dùng:

```text
Web deployed: https://dd5ev4p2d0llq.cloudfront.net
```

Xóa cache:

```powershell
aws cloudfront create-invalidation `
  --distribution-id "E1KEJ6QT3MJVZ8" `
  --paths "/*" `
  --profile $Profile
```

## 6. Xóa cache đăng nhập trên trình duyệt

Mở DevTools → Console:

```javascript
localStorage.removeItem("maBS");
localStorage.removeItem("user");
localStorage.removeItem("token");
localStorage.removeItem("accessToken");
```

Sau đó đăng nhập lại tài khoản bác sĩ.

## 7. Kiểm tra phiếu khám

Mở trang phiếu khám.

Network đúng phải có:

```text
GET  /api/hsba
GET  /api/patients/{patientId}/examinations
POST /api/patients/{patientId}/examinations
```

Không được còn:

```text
GET  /api/phieukham/bacsi/{maBS}
POST /api/phieukham
multipart/form-data
```

Sau khi chọn hồ sơ, form được mở và danh sách phiếu khám của hồ sơ đó được hiển thị.

## 8. Kiểm tra kê đơn thuốc

Thứ tự thao tác:

```text
Chọn hồ sơ bệnh án
→ Chọn phiếu khám
→ Thêm thuốc
→ Nhập số lượng, liều, tần suất, số ngày
→ Lưu đơn thuốc
```

Network đúng:

```text
GET  /api/hsba
GET  /api/patients/{patientId}/examinations
GET  /api/patients/{patientId}/prescriptions
POST /api/patients/{patientId}/prescriptions
```

Payload POST phải có:

```json
{
  "recordId": "HS...",
  "examinationId": "PK...",
  "medicineItems": [
    {
      "medicineId": "TH...",
      "medicineName": "...",
      "quantity": 10,
      "dosage": "1 viên",
      "frequency": "2 lần/ngày",
      "durationDays": 5,
      "instructions": "Uống sau ăn"
    }
  ]
}
```

Phiếu khám cũ chưa có `recordId` vẫn được hiển thị theo bệnh nhân. Khi tạo đơn mới, backend sẽ gắn đơn với hồ sơ và phiếu khám đã chọn.

## 9. Kiểm tra yêu cầu xét nghiệm

Thứ tự:

```text
Chọn hồ sơ bệnh án
→ Chọn xét nghiệm cụ thể
→ Chọn ưu tiên
→ Tạo yêu cầu
```

Network đúng:

```text
GET  /api/hsba
GET  /api/xetnghiem
GET  /api/yeucauxetnghiem
POST /api/yeucauxetnghiem
```

Payload phải có:

```json
{
  "maBN": "BN...",
  "maHSBA": "HS...",
  "maXN": "XN...",
  "priority": "NORMAL",
  "ghiChu": "..."
}
```

## 10. Kiểm tra thông tin cá nhân

Trang thông tin cá nhân bác sĩ phải:

- Chỉ hiển thị dữ liệu.
- Có thông báo “Thông tin chỉ đọc”.
- Không có nút `Chỉnh sửa`.
- Không có nút `Lưu thay đổi`.
- Không có input/select chỉnh sửa.
- Không phát sinh request `PUT /api/bacsi/{maBS}`.

Backend hiện cũng chỉ cho group `ADMIN` gọi API cập nhật bác sĩ, nên bác sĩ không thể sửa bằng request trực tiếp.

## 11. Kiểm tra CloudWatch

```powershell
npm run outputs
$Outputs = Get-Content .\docs\aws-dev-outputs.json -Raw | ConvertFrom-Json
```

```powershell
aws logs tail `
  "/aws/lambda/$($Outputs.MedicalFunctionName)" `
  --since 30m `
  --region $Region `
  --profile $Profile `
  --format short
```

Không được còn các lỗi:

```text
ROUTE_NOT_FOUND /phieukham/bacsi
ROUTE_NOT_FOUND POST /donthuoc
RECORD_NOT_FOUND cho hồ sơ đang tồn tại
VALIDATION_ERROR thiếu maHSBA
VALIDATION_ERROR thiếu maXN
EXAMINATION_RECORD_MISMATCH với phiếu vừa tạo
```

## 12. Commit

```powershell
git status
git add -A
git commit -m "fix: repair doctor medical record workflows v2"
git push -u origin fix/doctor-workflow-v2
```

Tạo Pull Request từ `fix/doctor-workflow-v2` vào `develop`.
