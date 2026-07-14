# Hướng dẫn thanh toán VNPay Sandbox cho Project Hospital

## File đã sửa

- `services/payment-sms/domain.js`
- `services/payment-sms/handler.js`
- `web/src/services/hoadon_BN/hoadonService.js`
- `web/src/pages/benhnhan/hoadon/GioHangThanhToanPage.jsx`
- `web/src/pages/benhnhan/hoadon/PaymentResultPage.jsx`
- `lib/hospital-stack.js`

## Luồng thanh toán sau khi sửa

1. Bệnh nhân chọn hóa đơn chưa thanh toán.
2. Frontend gọi `POST /api/payment/create-url` với `provider = VNPAY`.
3. Backend tạo URL thanh toán VNPay Sandbox.
4. Bệnh nhân được chuyển sang cổng VNPay.
5. VNPay gọi `GET /api/payment/vnpay-ipn` về backend.
6. Backend xác minh `vnp_SecureHash`, kiểm tra số tiền và mã giao dịch.
7. Backend cập nhật hóa đơn sang `PAID` / `DA_THANH_TOAN`.
8. VNPay chuyển trình duyệt về `GET /api/payment/vnpay-return`.
9. Backend redirect người dùng về `/payment-result`.
10. Trang kết quả quay lại `/patient/hoadon?reload=true` để tải lại hóa đơn.

## Biến môi trường cần set trước khi deploy

```powershell
$Profile = "hospital-dev"
$Region = "ap-southeast-1"

$env:AWS_PROFILE = $Profile
$env:AWS_REGION = $Region
$env:AWS_DEFAULT_REGION = $Region
$env:APPLICATION_REGION = $Region

$env:VNPAY_PAYMENT_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
$env:VNPAY_TMN_CODE = "YOUR_TMN_CODE"
$env:VNPAY_HASH_SECRET = "YOUR_HASH_SECRET"
$env:VNPAY_RETURN_URL = "https://dd5ev4p2d0llq.cloudfront.net/api/payment/vnpay-return"
$env:PAYMENT_RESULT_URL = "https://dd5ev4p2d0llq.cloudfront.net/payment-result"
$env:FRONTEND_BASE_URL = "https://dd5ev4p2d0llq.cloudfront.net"

$env:ENABLE_API_ROUTES = "true"
$env:ENABLE_WEEK3_OPERATIONS = "true"
$env:RETAIN_DATA = "true"
$env:ENABLE_CLOUDFRONT = "true"
$env:USE_EXISTING_CLOUDFRONT = "true"
$env:EXISTING_CLOUDFRONT_DISTRIBUTION_ID = "E1KEJ6QT3MJVZ8"
$env:EXISTING_CLOUDFRONT_DOMAIN = "dd5ev4p2d0llq.cloudfront.net"
$env:FRONTEND_ALLOWED_ORIGIN = "https://dd5ev4p2d0llq.cloudfront.net"
```

## Deploy backend

```powershell
Remove-Item .\cdk.out -Recurse -Force -ErrorAction SilentlyContinue
npx cdk synth HospitalDevStack --profile $Profile
npx cdk deploy HospitalDevStack --profile $Profile
```

## Lấy URL cấu hình trên VNPay Sandbox

```powershell
aws cloudformation describe-stacks `
  --stack-name HospitalDevStack `
  --region $Region `
  --profile $Profile `
  --query "Stacks[0].Outputs[?OutputKey=='VnpayReturnUrl' || OutputKey=='VnpayIpnUrl' || OutputKey=='PaymentResultUrl'].[OutputKey,OutputValue]" `
  --output table
```

Cấu hình trên VNPay Sandbox:

- Return URL: giá trị `VnpayReturnUrl`
- IPN URL: giá trị `VnpayIpnUrl`

## Build và upload frontend

```powershell
npm --prefix web run build

$Bucket = "hospitaldevstack-frontendbucketefe2e19c-ronugbgqrzgm"
$DistributionId = "E1KEJ6QT3MJVZ8"

aws s3 sync .\web\dist "s3://$Bucket" `
  --exclude "index.html" `
  --cache-control "public,max-age=31536000,immutable" `
  --profile $Profile

aws s3 cp .\web\dist\index.html "s3://$Bucket/index.html" `
  --content-type "text/html; charset=utf-8" `
  --cache-control "no-cache, no-store, must-revalidate" `
  --profile $Profile

$Invalidation = aws cloudfront create-invalidation `
  --distribution-id $DistributionId `
  --paths "/*" `
  --profile $Profile | ConvertFrom-Json

aws cloudfront wait invalidation-completed `
  --distribution-id $DistributionId `
  --id $Invalidation.Invalidation.Id `
  --profile $Profile
```

## Test nhanh

1. Đăng nhập bệnh nhân.
2. Vào `/patient/hoadon`.
3. Chọn hóa đơn chưa thanh toán.
4. Bấm `THANH TOÁN QUA VNPAY`.
5. Hoàn tất thanh toán trên VNPay Sandbox.
6. Chờ quay về trang kết quả.
7. Trang hóa đơn tự reload.
8. Kiểm tra hóa đơn đã vào tab `Đã thanh toán`.

## Kiểm tra DynamoDB

```powershell
$TableName = "HospitalDevStack-HospitalTable8F827962-1KADQ4K327F7V"

aws dynamodb scan `
  --table-name "$TableName" `
  --region $Region `
  --profile $Profile `
  --filter-expression "entityType = :t AND provider = :p" `
  --expression-attribute-values '{":t":{"S":"PAYMENT"},":p":{"S":"VNPAY"}}' `
  --limit 10
```
