# Medical Upload Flow

## 1. Xin Presigned URL

Frontend gọi:

```http
POST /api/medical/upload-url
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "patientId": "BN001",
  "fileName": "xquang.png",
  "contentType": "image/png",
  "fileSize": 68
}
```

Backend kiểm tra bệnh nhân, quyền Cognito, loại file và kích thước. Metadata được ghi vào DynamoDB ở trạng thái `PENDING_UPLOAD`.

## 2. Upload trực tiếp lên S3

Frontend dùng `uploadUrl` và gửi đúng toàn bộ `requiredHeaders`:

```http
PUT <uploadUrl>
Content-Type: image/png
x-amz-meta-documentid: <documentId>
x-amz-meta-patientid: <patientId>
```

Medical Bucket là private, bật versioning và mã hóa mặc định bằng AWS KMS.

## 3. Xác nhận upload

```http
POST /api/medical/complete-upload
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "documentId": "..."
}
```

Lambda gọi `HeadObject` để kiểm tra:

- object tồn tại;
- kích thước khớp yêu cầu;
- content type khớp;
- metadata `documentid` và `patientid` khớp.

Nếu hợp lệ, trạng thái chuyển thành `AVAILABLE`. Nếu sai, object bị xóa và metadata chuyển thành `REJECTED`.

## 4. Tạo URL tải xuống

```http
GET /api/medical/download-url?documentId=...
Authorization: Bearer <access-token>
```

Chỉ `ADMIN`, `BACSI`, `NHANSU` được phép lấy URL. URL hết hạn sau 300 giây.
