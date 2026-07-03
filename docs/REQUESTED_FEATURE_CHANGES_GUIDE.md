# Hướng dẫn áp dụng các chức năng sửa đổi

Bộ mã này sửa đồng bộ frontend, Lambda backend, API Gateway routes và dataset cho các yêu cầu:

1. Trang chủ lấy khoa, bác sĩ và tin tức từ DynamoDB.
2. Dashboard Admin không còn khối hạ tầng AWS.
3. Admin tạo tài khoản ở trạng thái `CONFIRMED`, không cần OTP.
4. Xóa trang/menu duyệt đăng ký.
5. Quản lý loại xét nghiệm và xét nghiệm.
6. Xóa bác sĩ/nhân sự thật, bảng cập nhật ngay không cần F5.
7. Quản lý phản hồi ý kiến.
8. Quản lý tin tức và hiển thị tin đã xuất bản ngoài trang chủ.

## 1. Backup và tạo branch

```powershell
cd D:\AWS\Project\Project_Hospital_AWS_P2TB

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Compress-Archive `
  -Path .\* `
  -DestinationPath "..\Project_Hospital_AWS_P2TB-before-feature-fix-$stamp.zip"

git status
git checkout develop
git pull origin develop
git checkout -b feat/fix-home-account-lab-news-feedback
```

Nếu branch hiện tại còn file chưa commit, commit hoặc `git stash` trước khi chuyển branch.

## 2. Chép bộ file sửa đổi

Giải nén `Hospital_Requested_Changes_Overlay.zip`, sau đó copy toàn bộ nội dung vào thư mục gốc project và chọn ghi đè file trùng tên.

Xóa file cũ sau khi copy:

```powershell
Remove-Item `
  .\web\src\pages\admin\AccountApprovalPage.jsx `
  -ErrorAction SilentlyContinue
```

Không copy hoặc commit:

```text
.git
node_modules
cdk.out
web/node_modules
web/dist
web/.env.local
JWT token
AWS credential
```

## 3. Cài đặt và kiểm tra local

```powershell
npm install
npm --prefix web install

npm run build
npm test
npm run build:web
```

Kết quả kiểm tra của bộ mã trước khi bàn giao:

```text
JavaScript syntax check: 100 files passed
Unit tests: 26/26 passed
Vite production build: passed
CDK synth: passed
```

Các cảnh báo Vite về bundle lớn và Browserslist cũ không làm build thất bại.

## 4. Lấy biến môi trường AWS hiện tại

```powershell
$Profile = "hospital-dev"
$Region = "ap-southeast-1"
$Stack = "HospitalDevStack"
$DistributionId = "E1KEJ6QT3MJVZ8"

$env:AWS_PROFILE = $Profile
$env:AWS_REGION = $Region
$env:AWS_DEFAULT_REGION = $Region
$env:CDK_DEFAULT_REGION = $Region
$env:ENABLE_CLOUDFRONT = "true"
$env:ENABLE_WEEK3_OPERATIONS = "true"
$env:RETAIN_DATA = "true"
```

Lấy Web ACL đang gắn với CloudFront hiện tại:

```powershell
$WebAclArn = aws cloudfront get-distribution `
  --id $DistributionId `
  --profile $Profile `
  --query "Distribution.DistributionConfig.WebACLId" `
  --output text

Write-Host "Web ACL ARN:" $WebAclArn
$env:CLOUDFRONT_WEB_ACL_ARN = $WebAclArn
```

`CLOUDFRONT_WEB_ACL_ARN` không được để trống khi `ENABLE_CLOUDFRONT=true`.

Không deploy với `ENABLE_CLOUDFRONT=false` trên stack đang chạy thật vì CDK có thể dự định xóa CloudFront và frontend bucket khỏi stack.

## 5. Synth và kiểm tra diff

```powershell
Remove-Item -Recurse -Force .\cdk.out -ErrorAction SilentlyContinue

npx cdk synth HospitalDevStack `
  --profile $Profile

npx cdk diff HospitalDevStack `
  --profile $Profile
```

Diff dự kiến có:

```text
Core Lambda: thêm quyền AdminCreateUser/AdminSetUserPassword/AdminDeleteUser
Medical Lambda: cập nhật code
API Gateway: thêm public home/news routes
API Gateway: thêm CRUD bác sĩ, nhân sự, xét nghiệm, phản hồi, tin tức
```

Không tiếp tục nếu diff báo thay thế hoặc xóa ngoài ý muốn:

```text
Cognito User Pool
DynamoDB table
Medical S3 bucket
CloudFront distribution
Frontend S3 bucket
KMS key
```

## 6. Deploy backend

```powershell
npx cdk deploy HospitalDevStack `
  --profile $Profile
```

Kết quả phải là:

```text
UPDATE_COMPLETE
```

Kiểm tra:

```powershell
aws cloudformation describe-stacks `
  --stack-name $Stack `
  --region $Region `
  --profile $Profile `
  --query "Stacks[0].StackStatus" `
  --output text
```

## 7. Seed dữ liệu mới

Lấy tên bảng:

```powershell
$TableName = aws cloudformation describe-stacks `
  --stack-name $Stack `
  --region $Region `
  --profile $Profile `
  --query "Stacks[0].Outputs[?OutputKey=='TableName'].OutputValue | [0]" `
  --output text

$env:TABLE_NAME = $TableName
```

Ghi dữ liệu mẫu loại xét nghiệm, xét nghiệm, tin tức và phản hồi:

```powershell
npm run seed:data
npm run verify:data
```

`seed:data` chỉ ghi các item có `dataSource=P2TB_SAMPLE`; không chạy `reset:data` trên môi trường có dữ liệu cần giữ nếu chưa backup.

## 8. Deploy frontend

```powershell
npm run deploy:web
```

Tạo invalidation:

```powershell
$InvalidationId = aws cloudfront create-invalidation `
  --distribution-id $DistributionId `
  --paths "/*" `
  --profile $Profile `
  --query "Invalidation.Id" `
  --output text

aws cloudfront wait invalidation-completed `
  --distribution-id $DistributionId `
  --id $InvalidationId `
  --profile $Profile
```

Mở bằng cửa sổ ẩn danh:

```text
https://dd5ev4p2d0llq.cloudfront.net
```

## 9. Kiểm tra API tự động

Lấy API endpoint:

```powershell
$ApiEndpoint = aws cloudformation describe-stacks `
  --stack-name $Stack `
  --region $Region `
  --profile $Profile `
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue | [0]" `
  --output text

$env:API_ENDPOINT = $ApiEndpoint
```

Copy Access Token của ADMIN từ DevTools → Network → Request Headers → Authorization:

```powershell
$env:ADMIN_TOKEN = "DAN_ACCESS_TOKEN_ADMIN"
```

Tùy chọn thêm token bệnh nhân:

```powershell
$env:PATIENT_TOKEN = "DAN_ACCESS_TOKEN_BENH_NHAN"
```

Chạy:

```powershell
npm run test:requested-features
```

Script kiểm tra:

```text
/api/health
/api/public/khoa
/api/public/bacsi
/api/public/tintuc
/api/tai-khoan
/api/bacsi
/api/nhansu
/api/loaixetnghiem
/api/xetnghiem
/api/phanhoi
/api/phanhoi/stats
/api/tintuc
```

## 10. Kiểm tra từng yêu cầu

### Trang chủ

1. Mở trang chủ.
2. F12 → Network.
3. Xác nhận các request sau trả HTTP 200:

```text
GET /api/public/khoa
GET /api/public/bacsi
GET /api/public/tintuc
```

4. Thêm/sửa khoa, bác sĩ hoặc tin `HIEN_THI` trong Admin.
5. Tải lại trang chủ và xác nhận dữ liệu mới xuất hiện.
6. Tin có trạng thái `AN` không được xuất hiện ngoài trang chủ.

### Dashboard Admin

Dashboard không còn các mục:

```text
API Gateway & Lambda
Amazon Cognito
DynamoDB
CloudFront
Trạng thái dịch vụ AWS
```

Các thống kê nghiệp vụ và thao tác nhanh vẫn hoạt động.

### Tạo tài khoản CONFIRMED

1. Đăng nhập ADMIN.
2. Vào `/admin/taikhoan/tao-moi`.
3. Tạo tài khoản bằng mật khẩu có 10+ ký tự, chữ hoa, chữ thường, số và ký tự đặc biệt.
4. Request `POST /api/tai-khoan` phải trả HTTP 201.
5. Vào Cognito → Users.
6. Trạng thái tài khoản phải là:

```text
CONFIRMED
```

7. Người dùng đăng nhập ngay bằng mật khẩu Admin đã nhập.
8. Không có bước nhập OTP và không có trạng thái `FORCE_CHANGE_PASSWORD`.

Lưu ý: đăng ký công khai của bệnh nhân vẫn có thể dùng OTP; thay đổi này chỉ áp dụng cho tài khoản do Admin tạo.

### Trang duyệt đăng ký

- Sidebar không còn menu `Duyệt đăng ký`.
- Route `/admin/taikhoan/duyet-dang-ky` không còn được khai báo.
- File `AccountApprovalPage.jsx` đã được xóa.

### Loại xét nghiệm và xét nghiệm

Kiểm tra đủ:

```text
GET danh sách
POST thêm
PUT sửa
DELETE xóa
```

Trang:

```text
/admin/loaixetnghiem
/admin/xetnghiem
```

Loại xét nghiệm đang có xét nghiệm sử dụng sẽ trả HTTP 409 khi xóa.
Xét nghiệm đang được dùng trong yêu cầu/kết quả sẽ trả HTTP 409 khi xóa.

### Xóa bác sĩ và nhân sự

Để kiểm tra xóa thật, hãy tạo một bác sĩ/nhân sự mới chưa có lịch hoặc hồ sơ liên quan rồi xóa.

Kết quả đúng:

```text
DELETE trả HTTP 200
Dòng dữ liệu biến mất ngay khỏi bảng
Frontend tự gọi lại API danh sách
Không cần nhấn F5
DynamoDB không còn item hồ sơ đó
```

Nếu bác sĩ/nhân sự đang có lịch, hồ sơ hoặc dữ liệu liên quan, backend trả HTTP 409 và frontend hiển thị lý do; không còn thông báo thành công giả.

### Phản hồi ý kiến

Bệnh nhân:

1. Đăng nhập bệnh nhân có `maBN`.
2. Vào `/patient/lienhe`.
3. Gửi phản hồi.
4. Phản hồi xuất hiện ngay trong lịch sử.

Admin:

1. Vào `/admin/phanhoi`.
2. Xem thống kê.
3. Lọc theo trạng thái.
4. Nhập câu trả lời và đổi trạng thái.
5. Bệnh nhân tải lại trang và thấy câu trả lời.

### Tin tức

Admin:

1. Vào `/admin/tintuc`.
2. Thêm tin `HIEN_THI`.
3. Tin xuất hiện ngoài trang chủ và `/patient/tintuc`.
4. Đổi tin thành `AN`.
5. Tin không còn xuất hiện ở API public.
6. Sửa và xóa tin phải cập nhật bảng ngay.

## 11. Commit Git

```powershell
git status --short

git add dataset lib services scripts tests web package.json docs

git rm web/src/pages/admin/AccountApprovalPage.jsx

git commit -m "feat: load public data and complete account lab news feedback management"

git push -u origin feat/fix-home-account-lab-news-feedback
```

Tạo Pull Request vào `develop`; chưa merge thẳng vào `main` trước khi kiểm tra tích hợp toàn nhóm.
