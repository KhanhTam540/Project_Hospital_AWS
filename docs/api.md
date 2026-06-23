# API tuần 1

## Quy ước

- API Gateway HTTP API xác thực JWT cho tất cả route bảo vệ.
- Client gửi access token trong header `Authorization: Bearer <token>`.
- Backend kiểm tra `cognito:groups` để phân quyền nghiệp vụ.
- Nhóm quyền: `ADMIN`, `BACSI`, `NHANSU`, `BENHNHAN`.

## Public route

### `GET /api/health`

Kết quả mẫu:

```json
{
  "service": "hospital-api",
  "status": "ok",
  "environment": "dev",
  "region": "ap-southeast-1",
  "timestamp": "2026-06-21T00:00:00.000Z"
}
```

## Route xác thực

### `GET /api/me`

Nhóm: mọi tài khoản đã đăng nhập.

### `GET /api/admin/ping`

Nhóm: `ADMIN`.

## Bệnh nhân

### `POST /api/patients`

Nhóm: `ADMIN`, `NHANSU`.

```json
{
  "fullName": "Nguyễn Văn A",
  "dateOfBirth": "2000-01-01",
  "gender": "NAM",
  "phoneNumber": "+84901234567",
  "address": "Bến Tre",
  "healthInsuranceNumber": "BHYT001"
}
```

### `GET /api/patients/{patientId}`

Nhóm: `ADMIN`, `BACSI`, `NHANSU`.

## Hồ sơ bệnh án

### `POST /api/patients/{patientId}/records`

Nhóm: `BACSI`.

```json
{
  "diagnosis": "Viêm họng",
  "symptoms": "Đau họng, sốt nhẹ",
  "medicalHistory": "Không có",
  "note": "Tái khám sau 7 ngày"
}
```

### `GET /api/patients/{patientId}/records`

Nhóm: `ADMIN`, `BACSI`, `NHANSU`.

## Tài liệu y tế

### `POST /api/medical/upload-url`

Nhóm: `BACSI`, `NHANSU`.

```json
{
  "patientId": "uuid",
  "fileName": "xquang.png",
  "contentType": "image/png",
  "fileSize": 123456
}
```

Client dùng URL trả về để `PUT` trực tiếp file lên S3, giữ đúng header `Content-Type`.

### `POST /api/medical/complete-upload`

Nhóm: `BACSI`, `NHANSU`.

```json
{
  "documentId": "uuid"
}
```

Lambda kiểm tra object đã tồn tại trên S3 và xác nhận kích thước file.

### `GET /api/medical/download-url?documentId=...`

Nhóm: `ADMIN`, `BACSI`, `NHANSU`.
