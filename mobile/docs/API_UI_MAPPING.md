# Ánh xạ API Backend và giao diện Mobile

| Nhóm | API | Giao diện |
|---|---|---|
| Hệ thống | `GET /api/health` | Dashboard |
| Xác thực | `GET /api/me`, `GET /api/auth/me` | Hồ sơ cá nhân, Dashboard |
| Admin | `GET /api/admin/ping` | Dashboard Admin |
| Tài khoản | `GET /api/tai-khoan` | Tài khoản và phân quyền |
| Tài khoản | `PUT /api/tai-khoan/{username}` | Đổi vai trò |
| Tài khoản | `DELETE /api/tai-khoan/{username}` | Vô hiệu hóa |
| Bệnh nhân | `POST /api/patients` | Thêm bệnh nhân |
| Bệnh nhân | `GET/PUT /api/patients/{patientId}` | Chi tiết/cập nhật bệnh nhân |
| Bệnh án | `GET/POST /api/patients/{patientId}/records` | Hồ sơ lâm sàng |
| Phiếu khám | `GET/POST /api/patients/{patientId}/examinations` | Hồ sơ lâm sàng |
| Đơn thuốc | `GET/POST /api/patients/{patientId}/prescriptions` | Hồ sơ lâm sàng |
| Tài liệu | `GET /api/patients/{patientId}/documents` | Tài liệu y tế |
| Tài liệu | `POST /api/medical/upload-url` | Chọn ảnh và tải lên S3 |
| Tài liệu | `POST /api/medical/complete-upload` | Hoàn tất tải lên |
| Tài liệu | `GET /api/medical/download-url` | Sao chép URL tải xuống |
| AI | `POST /api/ai/chat` | Trợ lý AI |
| AI | `POST /api/ai/summary` | Tóm tắt hội thoại |
| Tương thích | `/api/benhnhan*` | Danh sách và hồ sơ cá nhân |
| Tương thích | `/api/bacsi*` | Danh sách và hồ sơ bác sĩ |
| Tương thích | `/api/nhansu*` | Danh sách và hồ sơ nhân sự |
| Danh mục | `GET /api/khoa` | Khoa |
| Danh mục | `GET /api/phongkham` | Phòng khám |
| Lịch khám | `GET/POST /api/lichkham` | Lịch khám |
| Lịch khám | `GET/DELETE /api/lichkham/{appointmentId}` | Chi tiết và hủy lịch |
| Lịch khám | `GET /api/lichkham/benhnhan/{patientId}` | Lịch của bệnh nhân |
| Lịch khám | `GET /api/lichkham/bacsi/{doctorId}` | Lịch của bác sĩ |
| Tương thích | `GET /api/hsba*` | Tab bệnh án tương thích |
| Tương thích | `GET /api/phieukham*` | Tab phiếu khám và hàng đợi |
| Tương thích | `GET /api/donthuoc` | Tab đơn thuốc tương thích |
| Dược | `GET /api/thuoc` | Danh mục thuốc |
| Dược | `GET /api/thuoc/donvitinh` | Đơn vị tính |
| Dược | `GET /api/thuoc/nhomthuoc` | Nhóm thuốc |
| Lịch làm việc | `GET /api/lichlamviec*` | Lịch làm việc |
| Ca trực | `GET /api/catruc` | Ca trực |
| Hóa đơn | `GET /api/hoadon` | Danh sách hóa đơn |
| Hóa đơn | `GET /api/hoadon/thongke` | Chỉ số hóa đơn |
| Xét nghiệm | `GET /api/xetnghiem` | Danh mục xét nghiệm |
| Xét nghiệm | `GET /api/yeucauxetnghiem` | Yêu cầu xét nghiệm |
| Xét nghiệm | `GET /api/phieuxetnghiem*` | Danh sách và chi tiết kết quả |

## API chưa có thao tác ghi

Backend hiện chưa có API tạo/cập nhật cho khoa, phòng, thuốc, ca trực, xét nghiệm, hóa đơn và thanh toán. Giao diện các nhóm này được thiết kế theo chế độ tra cứu; không tạo nút ghi dữ liệu giả.
