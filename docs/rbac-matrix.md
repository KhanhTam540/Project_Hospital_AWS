# RBAC Matrix — Hoàng Phúc

| Chức năng | ADMIN | NHANSU | BACSI | BENHNHAN |
|---|:---:|:---:|:---:|:---:|
| Xem `/api/me` | ✅ | ✅ | ✅ | ✅ |
| Admin ping | ✅ | ❌ | ❌ | ❌ |
| Danh sách/tạo/sửa tài khoản | ✅ | ❌ | ❌ | ❌ |
| Kích hoạt/khóa/gửi lại email mời | ✅ | ❌ | ❌ | ❌ |
| Xem khoa/phòng | ✅ | ✅ | ✅ | ✅ |
| Thêm/sửa/xóa khoa/phòng | ✅ | ❌ | ❌ | ❌ |
| Xem danh sách bác sĩ | ✅ | ✅ | ✅ | ✅ |
| Thêm/sửa/xóa bác sĩ | ✅ | ❌ | ❌ | ❌ |
| Xem nhân sự | ✅ | ✅ | ✅ | Giới hạn |
| Thêm/sửa/xóa nhân sự | ✅ | ❌ | ❌ | ❌ |
| Tạo/sửa/xóa ca trực | ✅ | ✅ | ❌ | ❌ |
| Xếp lịch làm việc | ✅ | ✅ | ❌ | ❌ |
| Xem lịch làm việc | ✅ | ✅ | Chính mình | Chỉ lịch công khai cần thiết |
| Xem toàn bộ lịch khám | ✅ | ✅ | Chỉ của mình | ❌ |
| Đặt lịch khám | ✅ | ✅ | ❌ | Chỉ cho mình |
| Sửa/hủy/trạng thái lịch | ✅ | ✅ | Lịch của mình | Theo luồng bệnh nhân nếu bổ sung |
| Đọc hồ sơ bệnh án | ✅ | Theo nghiệp vụ | Theo điều trị | Chỉ của mình |

## Quy tắc sở hữu

- `BENHNHAN`: JWT `sub` → USER profile → `patientId`; URL/payload phải đúng `patientId` này.
- `BACSI`: JWT `sub` → USER profile → `doctorId`; chỉ được xem lịch và dữ liệu bác sĩ của chính mình.
- Role lấy từ claim Cognito `cognito:groups`.
- Role ưu tiên: `ADMIN` → `BACSI` → `NHANSU` → `BENHNHAN`.
- `THUNGAN` trên giao diện được xem là loại nhân sự `NHANSU` có `loaiNS=KT`; không tạo thêm Cognito group riêng trong phạm vi Hoàng Phúc.
