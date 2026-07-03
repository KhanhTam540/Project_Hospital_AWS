# API Tuần 1 – Medical Data Lambda

Mọi route bên dưới, trừ `/api/health`, yêu cầu:

```http
Authorization: Bearer <Cognito access token>
```

## Bệnh nhân

### `POST /api/patients`

Nhóm: `ADMIN`, `NHANSU`.

```json
{
  "fullName": "Nguyễn Văn A",
  "dateOfBirth": "2000-01-01",
  "gender": "NAM",
  "phoneNumber": "0900000000",
  "address": "TP. Hồ Chí Minh",
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
  "symptoms": "Đau họng",
  "diagnosis": "Viêm họng cấp",
  "treatment": "Theo dõi và dùng thuốc theo đơn",
  "medicalHistory": "Không có",
  "note": "Tái khám sau 7 ngày"
}
```

### `GET /api/patients/{patientId}/records`

Nhóm: `ADMIN`, `BACSI`, `NHANSU`.

## Phiếu khám

### `POST /api/patients/{patientId}/examinations`

Nhóm: `BACSI`, `NHANSU`. `NHANSU` chỉ nhập chỉ số sinh tồn; `diagnosis` và `treatment` chỉ dành cho `BACSI`.

```json
{
  "vitals": {
    "temperature": 36.8,
    "heartRate": 78,
    "systolicBloodPressure": 115,
    "diastolicBloodPressure": 75,
    "oxygenSaturation": 99,
    "weightKg": 60,
    "heightCm": 168
  },
  "symptoms": "Mệt mỏi"
}
```

### `GET /api/patients/{patientId}/examinations`

Nhóm: `ADMIN`, `BACSI`, `NHANSU`.

## Đơn thuốc

### `POST /api/patients/{patientId}/prescriptions`

Nhóm: `BACSI`.

```json
{
  "recordId": "...",
  "medicineItems": [
    {
      "medicineId": "TH001",
      "medicineName": "Paracetamol 500mg",
      "quantity": 10,
      "dosage": "1 viên",
      "frequency": "2 lần/ngày",
      "durationDays": 5,
      "instructions": "Uống sau ăn"
    }
  ],
  "generalInstructions": "Uống đủ nước"
}
```

### `GET /api/patients/{patientId}/prescriptions`

Nhóm: `ADMIN`, `BACSI`, `NHANSU`.

## Tài liệu y tế

### `POST /api/medical/upload-url`

Nhóm: `BACSI`, `NHANSU`.

Chỉ chấp nhận `application/pdf`, `image/jpeg`, `image/png`; tối đa 10 MB.

### `POST /api/medical/complete-upload`

Nhóm: `ADMIN`, `BACSI`, `NHANSU`. Chỉ uploader hoặc `ADMIN` được xác nhận.

### `GET /api/medical/download-url?documentId=...`

Nhóm: `ADMIN`, `BACSI`, `NHANSU`.

### `GET /api/patients/{patientId}/documents`

Nhóm: `ADMIN`, `BACSI`, `NHANSU`.

## Mã lỗi

- `400`: request hoặc dữ liệu không hợp lệ.
- `401`: chưa đăng nhập hoặc JWT không hợp lệ.
- `403`: không đúng nhóm Cognito.
- `404`: bệnh nhân, hồ sơ hoặc tài liệu không tồn tại.
- `409`: dữ liệu xung đột hoặc upload chưa hợp lệ.
- `500`: lỗi nội bộ.
