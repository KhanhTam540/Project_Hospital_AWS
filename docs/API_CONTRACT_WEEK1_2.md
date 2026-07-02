# API Contract — Cao Thiên Tuần 1–2

## Xác thực

Mọi route bảo vệ nhận Cognito **ID Token**:

```http
Authorization: Bearer <id-token>
```

Mobile không nhận AWS credentials và không gọi DynamoDB/S3 trực tiếp.

## GET /api/me

Phản hồi phải cho phép xác định:

- `primaryRole` hoặc `maNhom` bằng `BENHNHAN`.
- `patientId` hoặc `maBN` không rỗng.
- Email và họ tên bệnh nhân.

Mobile hỗ trợ dữ liệu lồng trong các object: `user`, `identity`, `appUser`, `domainUser`, `patient`, `benhNhan`, `profile`.

## Lịch khám

### POST /api/lichkham

Mobile gửi đồng thời tên trường tiếng Việt và tên trường tương thích:

```json
{
  "maBN": "BN001",
  "patientId": "BN001",
  "maBS": "BS001",
  "doctorId": "BS001",
  "maKhoa": "K01",
  "departmentId": "K01",
  "ngayHen": "2026-07-10",
  "ngayKham": "2026-07-10",
  "maCa": "CA_SANG",
  "shift": "CA_SANG"
}
```

Phản hồi cần có mã lịch và nên có `soThuTu`.

### DELETE /api/lichkham/{appointmentId}

Phản hồi nên trả lịch sau khi chuyển sang `DA_HUY`.

## Hồ sơ y tế

Các route danh sách có thể trả trực tiếp array hoặc bọc trong `data`, `items`, `records`, `results`.

Backend phải kiểm tra `patientId` trong token/profile để ngăn bệnh nhân đọc dữ liệu của người khác.
