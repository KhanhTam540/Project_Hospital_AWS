# Hướng dẫn sửa và kiểm tra các chức năng của bác sĩ

## 1. Các lỗi đã sửa

### Lịch làm việc

- Frontend không còn lấy `maBS` một cách mù quáng từ phiên cũ.
- Hệ thống thử lấy bác sĩ theo `maBS`, sau đó tự tra lại bằng `maTK` nếu phiên cũ sai.
- Backend cho phép group `BACSI` tạo, cập nhật và xóa lịch của chính mình.
- Bác sĩ không thể tạo hoặc chuyển lịch sang bác sĩ khác.

### Hồ sơ bệnh án và phiếu khám

- Trang phiếu khám lấy danh sách hồ sơ từ `/api/hsba`.
- Khi chọn hồ sơ, hệ thống tải phiếu khám bằng:

```text
GET /api/patients/{patientId}/examinations
```

- Danh sách được lọc đúng theo `recordId`.
- Tạo phiếu khám bằng JSON qua:

```text
POST /api/patients/{patientId}/examinations
```

- Không còn gửi `multipart/form-data` vào API không hỗ trợ Multer.
- File đính kèm được tải riêng qua S3 Presigned URL.

### Kê đơn thuốc

- Trang kê đơn chọn trực tiếp hồ sơ bệnh án thay vì chọn phiếu khám không có route backend.
- Tải đơn thuốc theo bệnh nhân rồi lọc đúng `recordId`.
- Payload kê đơn có đủ:

```text
medicineId
medicineName
quantity
dosage
frequency
durationDays
instructions
```

### Yêu cầu xét nghiệm

- Bác sĩ bắt buộc chọn hồ sơ bệnh án.
- Bác sĩ bắt buộc chọn một xét nghiệm trong danh mục `/api/xetnghiem`.
- Payload gửi đúng các trường backend yêu cầu:

```text
maBN
maHSBA
maXN
priority
ghiChu
```

### Thông tin cá nhân

- Trang thông tin bác sĩ chuyển thành read-only.
- Không còn nút chỉnh sửa, hàm lưu hoặc request `PUT /api/bacsi/{id}`.
- Chỉ Admin được cập nhật thông tin bác sĩ theo phân quyền backend hiện tại.

## 2. Các file được thay thế hoàn chỉnh

```text
services/core/routes.js
services/medical/handler.js

web/src/services/bacsi/bacsiService.js
web/src/services/bacsi/medicalRecordService.js
web/src/services/lich/lichlamviecService.js
web/src/services/kham/phieukhamService.js
web/src/services/donthuoc/donthuocService.js
web/src/services/xetnghiem/yeucauxetnghiemService.js
web/src/services/medical/medicalDocumentService.js

web/src/pages/bacsi/lich/LichLamViecPage.jsx
web/src/pages/bacsi/kham/PhieuKhamPage.jsx
web/src/pages/bacsi/kham/KeDonThuocPage.jsx
web/src/pages/bacsi/xetnghiem/QuanLyYeuCauXNPage.jsx
web/src/pages/bacsi/ThongTinCaNhanPage.jsx

tests/doctor-workflow-contract.test.js
```

## 3. Áp dụng patch

Tạo branch:

```powershell
cd D:\AWS\Project\Project_Hospital_AWS_P2TB

git checkout develop
git pull origin develop
git checkout -b fix/doctor-workflows
```

Giải nén gói patch, rồi chạy:

```powershell
Set-ExecutionPolicy -Scope Process Bypass

cd D:\AWS\Project\Doctor_Workflow_Fix_Patch

.\APPLY_PATCH.ps1 `
  -ProjectRoot "D:\AWS\Project\Project_Hospital_AWS_P2TB"
```

Script tự sao lưu file cũ trước khi thay thế.

## 4. Kiểm tra local

```powershell
cd D:\AWS\Project\Project_Hospital_AWS_P2TB

npm install
npm --prefix web install
```

Kiểm tra backend:

```powershell
node --test tests/doctor-workflow-contract.test.js
npm run test:core
npm run test:medical
npm run test:lab
npm run build
```

Kiểm tra frontend:

```powershell
npm --prefix web run build
```

Kết quả build phải có:

```text
✓ built
```

## 5. Khai báo môi trường AWS

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

Kiểm tra tài khoản:

```powershell
aws sts get-caller-identity --profile $Profile
```

## 6. Synth, diff và deploy backend

```powershell
Remove-Item .\cdk.out -Recurse -Force -ErrorAction SilentlyContinue

npx cdk synth HospitalDevStack --profile $Profile
npx cdk diff HospitalDevStack --profile $Profile
```

Trong `cdk diff`, không được có hành động thay thế hoặc xóa:

```text
HospitalTable
MedicalBucket
UserPool
FrontendBucket
```

Deploy:

```powershell
npx cdk deploy HospitalDevStack --profile $Profile
```

Kiểm tra:

```powershell
aws cloudformation describe-stacks `
  --stack-name $StackName `
  --region $Region `
  --profile $Profile `
  --query "Stacks[0].StackStatus" `
  --output text
```

Kết quả cần là:

```text
UPDATE_COMPLETE
```

## 7. Deploy frontend

```powershell
npm run outputs
npm run deploy:web
```

Dòng cuối phải là domain CloudFront hiện tại:

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

## 8. Đăng xuất và đăng nhập lại

Sau khi deploy, phải đăng xuất tài khoản bác sĩ rồi đăng nhập lại để làm mới:

```text
maTK
maBS
accessToken
user
```

Có thể xóa thủ công phiên cũ trong Console trình duyệt:

```javascript
localStorage.removeItem("maBS");
localStorage.removeItem("user");
localStorage.removeItem("token");
localStorage.removeItem("accessToken");
```

Sau đó tải lại trang và đăng nhập.

## 9. Kiểm tra từng chức năng

### 9.1. Thông tin bác sĩ

Mở:

```text
/bacsi/thong-tin-ca-nhan
```

Điều kiện đạt:

- Hiển thị đúng mã bác sĩ.
- Hiển thị họ tên, khoa, chuyên môn, trình độ, chức vụ và cấp bậc.
- Không có nút `Chỉnh sửa`.
- Không có nút `Lưu thay đổi`.

### 9.2. Lịch làm việc

Mở trang lịch bác sĩ:

1. Chọn ca trực.
2. Chọn ngày từ hôm nay trở đi.
3. Chọn một ngày hoặc 7 ngày.
4. Nhấn `Đăng ký lịch`.
5. Tải lại trang.

Điều kiện đạt:

- Lịch mới vẫn tồn tại sau khi tải lại.
- Bác sĩ chỉ nhìn thấy lịch của mình.
- Bác sĩ xóa được lịch của mình.
- Bác sĩ không thể thao tác lịch của bác sĩ khác.

### 9.3. Phiếu khám

1. Chọn hồ sơ bệnh án.
2. Danh sách bên dưới chỉ hiển thị phiếu của hồ sơ đó.
3. Nhập triệu chứng và chẩn đoán.
4. Tạo phiếu khám.
5. Tải lại trang.

Điều kiện đạt:

- Không còn lỗi tải `/phieukham/bacsi/{maBS}`.
- Không còn request `multipart/form-data` vào `/phieukham`.
- Phiếu mới xuất hiện đúng trong hồ sơ đã chọn.

### 9.4. Đơn thuốc

1. Chọn hồ sơ bệnh án.
2. Kiểm tra danh sách đơn thuốc hiện có.
3. Thêm thuốc, số lượng, liều, tần suất và số ngày.
4. Lưu đơn.
5. Tải lại trang.

Điều kiện đạt:

- Đơn mới xuất hiện đúng hồ sơ.
- Không còn lỗi `medicineItems[...]` bị thiếu.
- Không còn request POST vào route legacy `/donthuoc` chỉ hỗ trợ GET.

### 9.5. Yêu cầu xét nghiệm

1. Chọn hồ sơ bệnh án.
2. Chọn một xét nghiệm.
3. Chọn mức ưu tiên.
4. Tạo yêu cầu.

Điều kiện đạt:

- Backend nhận đủ `maBN`, `maHSBA`, `maXN`.
- Yêu cầu xuất hiện trong danh sách của hồ sơ đã chọn.
- Không còn lỗi `medicalRecordId` hoặc `labTestId` bị thiếu.

## 10. Kiểm tra Network trong trình duyệt

Mở DevTools → Network. Các request thành công cần có:

```text
GET  /api/bacsi/maTK/{maTK}
GET  /api/lichlamviec/bacsi/{maBS}
POST /api/lichlamviec
GET  /api/hsba
GET  /api/patients/{maBN}/examinations
POST /api/patients/{maBN}/examinations
GET  /api/patients/{maBN}/prescriptions
POST /api/patients/{maBN}/prescriptions
GET  /api/xetnghiem
POST /api/yeucauxetnghiem
```

Không được còn các request lỗi cũ:

```text
GET  /api/phieukham/bacsi/{maBS}
POST /api/phieukham với multipart/form-data
POST /api/donthuoc với multipart/form-data
```

## 11. Kiểm tra CloudWatch

```powershell
npm run outputs
$Outputs = Get-Content .\docs\aws-dev-outputs.json -Raw | ConvertFrom-Json
```

Xem Core Lambda:

```powershell
$CoreFunction = aws cloudformation list-stack-resources `
  --stack-name $StackName `
  --region $Region `
  --profile $Profile `
  --query "StackResourceSummaries[?contains(LogicalResourceId, 'CoreFunction')].PhysicalResourceId | [0]" `
  --output text

aws logs tail "/aws/lambda/$CoreFunction" `
  --since 30m `
  --region $Region `
  --profile $Profile `
  --format short
```

Xem Medical Lambda:

```powershell
$MedicalFunction = aws cloudformation list-stack-resources `
  --stack-name $StackName `
  --region $Region `
  --profile $Profile `
  --query "StackResourceSummaries[?contains(LogicalResourceId, 'MedicalFunction')].PhysicalResourceId | [0]" `
  --output text

aws logs tail "/aws/lambda/$MedicalFunction" `
  --since 30m `
  --region $Region `
  --profile $Profile `
  --format short
```

Không được còn:

```text
FORBIDDEN khi bác sĩ đăng ký lịch của chính mình
MEDICAL_RECORD_NOT_FOUND với hồ sơ đang tồn tại
ROUTE_NOT_FOUND /phieukham/bacsi/...
ROUTE_NOT_FOUND POST /donthuoc
VALIDATION_ERROR thiếu labTestId hoặc medicalRecordId
```

## 12. Commit

```powershell
git status
git add -A
git commit -m "fix: repair doctor schedule and medical workflows"
git push -u origin fix/doctor-workflows
```

Tạo Pull Request:

```text
fix/doctor-workflows → develop
```
