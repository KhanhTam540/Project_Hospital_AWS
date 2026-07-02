# Tương thích Mobile với AWS Backend

Ứng dụng Mobile này chỉ chạy với backend thật. Không còn luồng đăng nhập demo,
không còn dữ liệu giả và không gọi trực tiếp DynamoDB, S3 hoặc Gemini.

## Luồng xác thực

Flutter → Amazon Cognito → ID Token → CloudFront `/api/*` → API Gateway JWT Authorizer.

## API ghi dữ liệu hiện có

- `PUT /api/tai-khoan/{username}`: đổi vai trò.
- `DELETE /api/tai-khoan/{username}`: vô hiệu hóa tài khoản.
- `POST /api/patients`: tạo bệnh nhân.
- `PUT /api/patients/{patientId}`: cập nhật bệnh nhân.
- `POST /api/lichkham`: tạo lịch khám.
- `DELETE /api/lichkham/{appointmentId}`: hủy lịch khám.
- `POST /api/patients/{patientId}/records`: tạo bệnh án.
- `POST /api/patients/{patientId}/examinations`: tạo phiếu khám/sinh hiệu.
- `POST /api/patients/{patientId}/prescriptions`: tạo đơn thuốc.
- `POST /api/medical/upload-url`: tạo URL tải tài liệu.
- `POST /api/medical/complete-upload`: hoàn tất tải tài liệu.
- `POST /api/ai/chat`, `POST /api/ai/summary`: gọi Gemini qua Lambda.

## API chỉ đọc

Backend hiện chỉ cung cấp thao tác đọc cho khoa, phòng khám, bác sĩ, nhân sự,
thuốc, nhóm thuốc, đơn vị tính, lịch làm việc, ca trực, xét nghiệm và hóa đơn.
Mobile hiển thị các module này ở chế độ tra cứu, không tạo nút ghi dữ liệu giả.

## Chức năng chưa thể hoàn thiện chỉ từ Mobile

Backend chưa có API tạo/cập nhật khoa, phòng, thuốc, lịch làm việc, xét nghiệm,
hóa đơn hoặc thanh toán VNPay/MoMo. Khi backend bổ sung route, các màn hình có
thể mở rộng mà không phải thay đổi cơ chế xác thực và API client.
