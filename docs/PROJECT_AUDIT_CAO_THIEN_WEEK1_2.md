# KIỂM TRA PROJECT HOSPITAL P2TB — CAO THIÊN TUẦN 1–2

## 1. Phạm vi đã kiểm tra

- AWS CDK JavaScript trong `lib/` và `bin/`.
- Lambda `core`, `auth-trigger`, `medical`.
- API Gateway routes và Cognito User Pool/Mobile Client.
- Dataset và script seed/verify dữ liệu y tế.
- Toàn bộ Flutter source ban đầu nằm trong thư mục viết sai `moblie/`.
- Các màn hình Auth và Patient phục vụ phân công Tuần 1–2 của Cao Thiên.

## 2. Kết luận tổng quan

Hạ tầng AWS hiện có đủ nền tảng để tích hợp Mobile: Cognito, Mobile Client, API Gateway, Lambda, DynamoDB, S3 Medical và CloudFront. Giao diện Flutter của Cao Thiên có nhiều màn hình, nhưng trước khi sửa vẫn là ứng dụng demo vì:

1. `DEMO_MODE` mặc định là `true`.
2. API bị hard-code tới `http://10.0.2.2:4000/api`.
3. Login/register/reset password gọi các API `/auth/*` không tồn tại trên AWS.
4. JWT được lưu trong `SharedPreferences`.
5. `auth_service.dart` trống.
6. Hồ sơ chi tiết gọi backend local và chức năng blockchain demo cũ.
7. Đặt lịch chỉ dùng demo, backend chưa có create/detail/cancel route.
8. Kết quả xét nghiệm backend luôn trả danh sách rỗng.
9. Thư mục `moblie` viết sai tên.
10. Package Flutter chưa có Amplify Cognito và Android chưa được chuẩn hóa cho Amplify.

## 3. Các phần đã sửa trong patch

### Tuần 1 — Mobile Auth

- Đổi cấu hình sang `--dart-define` theo môi trường.
- `DEMO_MODE=false` là mặc định.
- Kết nối User Pool và Mobile Client hiện có bằng Amplify.
- Đăng ký bằng email, gửi mã xác nhận, xác nhận tài khoản.
- Đăng nhập Cognito.
- Hỗ trợ bước OTP/MFA hoặc mật khẩu mới do Cognito yêu cầu.
- Quên mật khẩu và xác nhận mật khẩu mới.
- Đổi mật khẩu khi đã đăng nhập.
- Đăng xuất Cognito.
- Lấy ID Token bằng `fetchAuthSession` và tự gắn vào API request.
- Không lưu JWT thô trong `SharedPreferences`.
- Gọi `/api/me` để lấy role, mã tài khoản và mã bệnh nhân.

### Tuần 2 — Mobile Health

- Backend thêm `POST /api/lichkham`.
- Backend thêm `GET /api/lichkham/{appointmentId}`.
- Backend thêm `DELETE /api/lichkham/{appointmentId}`.
- Bệnh nhân chỉ được tạo, xem và hủy lịch của chính mình.
- Sinh số thứ tự theo bác sĩ, ngày và giờ khám.
- Màn hình đặt lịch dùng khoa/bác sĩ/dữ liệu thật.
- Màn hình lịch hẹn hiển thị số thứ tự và trạng thái.
- Hồ sơ bệnh án sử dụng API `/patients/{patientId}/records`.
- Chi tiết hồ sơ tải phiếu khám, đơn thuốc và tài liệu y tế.
- Cập nhật thông tin cá nhân qua API thật.
- Backend thêm danh sách và chi tiết kết quả xét nghiệm.
- Dataset bổ sung ba kết quả xét nghiệm mẫu.
- Script seed/verify được cập nhật.

## 4. Bảo mật

Các file sau xuất hiện trong gói dự án local nhưng không được commit:

- `.medical-test-tokens.json`
- `docs/aws-dev-outputs.json`
- `web/.env.local`
- `web/.env.local.generated`
- `.env.infrastructure`
- `cdk.out/`
- `mobile/.dart_tool/`
- `mobile/build/`
- Android keystore và `key.properties`

Đặc biệt, `.medical-test-tokens.json` chứa JWT tạm thời. Hãy xóa khỏi Git index nếu từng được theo dõi.

## 5. Các phần chưa thuộc phạm vi Tuần 1–2

- Chat Gemini trên Flutter.
- Thanh toán VNPay/MoMo và QR thật.
- Push notification thật.
- Các màn hình Admin/Bác sĩ/Nhân sự trên Mobile vẫn còn nhiều API cũ và demo.
- Hóa đơn bệnh nhân vẫn là phạm vi Tuần 3.
- Lab staff tạo kết quả xét nghiệm trên Mobile chưa nằm trong phân công Cao Thiên Tuần 2; patch chỉ bảo đảm bệnh nhân xem được kết quả.

## 6. Mức hoàn thành sau khi deploy và test

- Tuần 1 đạt 100% khi đăng ký, xác nhận email, đăng nhập, OTP/MFA step, quên mật khẩu, đổi mật khẩu, đăng xuất và `/api/me` đều PASS.
- Tuần 2 đạt 100% khi đặt lịch, xem/hủy lịch, xem số thứ tự, hồ sơ, phiếu khám, đơn thuốc, tài liệu và xét nghiệm đều lấy từ AWS thật.
- Chưa được tính 100% chỉ vì giao diện chạy ở `DEMO_MODE=true`.
