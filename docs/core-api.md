# Core API — Hoàng Phúc (Tuần 1–2)

Tất cả response mới dùng định dạng:

```json
{
  "success": true,
  "data": {}
}
```

Response lỗi:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Mô tả lỗi"
  }
}
```

Mọi API bên dưới, trừ `GET /api/health`, yêu cầu:

```http
Authorization: Bearer <Cognito access token>
```

## API nền tảng

| Method | Path | Role | Mục đích |
|---|---|---|---|
| GET | `/api/health` | Public | Kiểm tra Core Lambda |
| GET | `/api/me` | Đã đăng nhập | Claims và profile hiện tại |
| GET | `/api/auth/me` | Đã đăng nhập | Alias của `/api/me` |
| GET | `/api/admin/ping` | ADMIN | Kiểm tra RBAC ADMIN |

## Tài khoản Cognito

| Method | Path | Role | Mục đích |
|---|---|---|---|
| GET | `/api/tai-khoan` | ADMIN | Liệt kê user Cognito và profile DynamoDB |
| POST | `/api/tai-khoan` | ADMIN | Tạo user, gán group, tạo profile, gửi email mời |
| GET | `/api/tai-khoan/{username}` | ADMIN | Lấy chi tiết tài khoản |
| PUT | `/api/tai-khoan/{username}` | ADMIN | Cập nhật email, role và profile |
| DELETE | `/api/tai-khoan/{username}` | ADMIN | Vô hiệu hóa tài khoản |
| POST | `/api/tai-khoan/{username}/enable` | ADMIN | Kích hoạt tài khoản |
| POST | `/api/tai-khoan/{username}/resend-invitation` | ADMIN | Gửi lại email mời Cognito |

### Tạo tài khoản

```json
{
  "tenDangNhap": "bacsi001",
  "matKhau": "P2TB@Test123!",
  "email": "doctor@example.com",
  "maNhom": "BACSI",
  "hoTen": "Nguyễn Văn Bác Sĩ",
  "maKhoa": "KHOA_NOI",
  "chuyenMon": "Nội tổng quát",
  "trinhDo": "Thạc sĩ",
  "chucVu": "Bác sĩ điều trị"
}
```

Mật khẩu tạm cần ít nhất 10 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.

## Khoa

| Method | Path | Role |
|---|---|---|
| GET | `/api/khoa` | Đã đăng nhập |
| POST | `/api/khoa` | ADMIN |
| GET | `/api/khoa/{departmentId}` | Đã đăng nhập |
| PUT | `/api/khoa/{departmentId}` | ADMIN |
| DELETE | `/api/khoa/{departmentId}` | ADMIN |

```json
{
  "maKhoa": "KHOA_TIM_MACH",
  "tenKhoa": "Khoa Tim mạch",
  "moTa": "Khám và điều trị tim mạch"
}
```

## Phòng nội viện

| Method | Path | Role |
|---|---|---|
| GET | `/api/phongkham` | Đã đăng nhập |
| POST | `/api/phongkham` | ADMIN |
| GET | `/api/phongkham/{roomId}` | Đã đăng nhập |
| PUT | `/api/phongkham/{roomId}` | ADMIN |
| DELETE | `/api/phongkham/{roomId}` | ADMIN |

## Phòng khám ngoài

| Method | Path | Role |
|---|---|---|
| GET | `/api/phongkhamngoai` | Đã đăng nhập |
| POST | `/api/phongkhamngoai` | ADMIN |
| GET | `/api/phongkhamngoai/{clinicId}` | Đã đăng nhập |
| PUT | `/api/phongkhamngoai/{clinicId}` | ADMIN |
| DELETE | `/api/phongkhamngoai/{clinicId}` | ADMIN |

## Bác sĩ

| Method | Path | Role |
|---|---|---|
| GET | `/api/bacsi` | Đã đăng nhập |
| POST | `/api/bacsi` | ADMIN |
| GET | `/api/bacsi/{doctorId}` | Đã đăng nhập |
| PUT | `/api/bacsi/{doctorId}` | ADMIN |
| DELETE | `/api/bacsi/{doctorId}` | ADMIN |
| GET | `/api/bacsi/maTK/{maTK}` | Đã đăng nhập |
| GET | `/api/bacsi/tk/{maTK}` | Đã đăng nhập |

## Nhân sự

| Method | Path | Role |
|---|---|---|
| GET | `/api/nhansu` | ADMIN, NHANSU, BACSI |
| POST | `/api/nhansu` | ADMIN |
| GET | `/api/nhansu/{staffId}` | Đã đăng nhập |
| PUT | `/api/nhansu/{staffId}` | ADMIN |
| DELETE | `/api/nhansu/{staffId}` | ADMIN |
| GET | `/api/nhansu/maTK/{maTK}` | Đã đăng nhập |

## Ca trực

| Method | Path | Role |
|---|---|---|
| GET | `/api/catruc` | Đã đăng nhập |
| POST | `/api/catruc` | ADMIN, NHANSU |
| GET | `/api/catruc/{shiftId}` | Đã đăng nhập |
| PUT | `/api/catruc/{shiftId}` | ADMIN, NHANSU |
| DELETE | `/api/catruc/{shiftId}` | ADMIN, NHANSU |

```json
{
  "maCa": "CA_SANG",
  "tenCa": "Ca sáng",
  "thoiGianBatDau": "08:00",
  "thoiGianKetThuc": "12:00"
}
```

## Lịch làm việc

| Method | Path | Role |
|---|---|---|
| GET | `/api/lichlamviec` | Đã đăng nhập |
| POST | `/api/lichlamviec` | ADMIN, NHANSU |
| GET | `/api/lichlamviec/{scheduleId}` | Đã đăng nhập |
| PUT | `/api/lichlamviec/{scheduleId}` | ADMIN, NHANSU |
| DELETE | `/api/lichlamviec/{scheduleId}` | ADMIN, NHANSU |
| GET | `/api/lichlamviec/bacsi/{doctorId}` | Đã đăng nhập; bác sĩ chỉ xem mình |
| GET | `/api/lichlamviec/nhansu/{staffId}` | Đã đăng nhập |
| GET | `/api/lichlamviec/soluong` | Đã đăng nhập |

```json
{
  "maBS": "BS001",
  "maCa": "CA_SANG",
  "ngayLamViec": "2099-07-01",
  "taoTheoTuan": false
}
```

## Lịch khám

| Method | Path | Role |
|---|---|---|
| GET | `/api/lichkham` | ADMIN, NHANSU, BACSI; bác sĩ chỉ nhận lịch của mình |
| POST | `/api/lichkham` | Đã đăng nhập; bệnh nhân chỉ tạo cho mình |
| GET | `/api/lichkham/check` | Đã đăng nhập |
| GET | `/api/lichkham/{appointmentId}` | Theo quyền sở hữu |
| PUT | `/api/lichkham/{appointmentId}` | ADMIN, NHANSU, BACSI sở hữu |
| PATCH | `/api/lichkham/{appointmentId}/status` | ADMIN, NHANSU, BACSI sở hữu |
| DELETE | `/api/lichkham/{appointmentId}` | ADMIN, NHANSU, BACSI sở hữu |
| GET | `/api/lichkham/benhnhan/{patientId}` | Bệnh nhân chỉ xem mình |
| GET | `/api/lichkham/bacsi/{doctorId}` | Bác sĩ chỉ xem mình |

```json
{
  "maBN": "BN001",
  "maBS": "BS001",
  "maKhoa": "KHOA_NOI",
  "ngayKham": "2099-07-01",
  "gioKham": "08:30",
  "phong": "PK_NOI_01",
  "ghiChu": "Khám định kỳ"
}
```

Các trạng thái hỗ trợ:

```text
CHO_THANH_TOAN
DA_THANH_TOAN
DA_KHAM
DA_HUY
```

## Mã lỗi chính

| HTTP | Mã | Ý nghĩa |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | Payload sai |
| 401 | `UNAUTHORIZED` | Thiếu hoặc sai JWT |
| 403 | `FORBIDDEN` | Sai role hoặc sai chủ sở hữu |
| 404 | `*_NOT_FOUND` | Không tìm thấy tài nguyên |
| 409 | `*_IN_USE`, `SLOT_OCCUPIED` | Xung đột dữ liệu |
| 500 | `INTERNAL_ERROR` | Lỗi ngoài dự kiến |
