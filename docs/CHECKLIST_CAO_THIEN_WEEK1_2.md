# CHECKLIST CAO THIÊN TUẦN 1–2

## Tuần 1

- [ ] Thư mục là `mobile/`, không còn `moblie/`.
- [ ] `flutter doctor` không có lỗi chặn Android.
- [ ] `flutter pub get` thành công.
- [ ] `flutter analyze` không có error.
- [ ] Mobile chạy với `DEMO_MODE=false`.
- [ ] Amplify kết nối đúng Region/User Pool/Mobile Client.
- [ ] Đăng ký email thành công.
- [ ] Nhận mã xác nhận email.
- [ ] Xác nhận tài khoản thành công.
- [ ] PostConfirmation thêm user vào `BENHNHAN`.
- [ ] Đăng nhập thành công.
- [ ] Nếu Cognito yêu cầu OTP/MFA, màn hình nhập mã hoạt động.
- [ ] `/api/me` trả role `BENHNHAN` và `maBN`.
- [ ] Quên mật khẩu thành công.
- [ ] Đổi mật khẩu thành công.
- [ ] Đăng xuất thành công.
- [ ] Không lưu JWT trong SharedPreferences.
- [ ] Không có AWS/Gemini secret trong Flutter.

## Tuần 2

- [ ] `GET /api/khoa` trả danh sách khoa.
- [ ] `GET /api/bacsi` trả danh sách bác sĩ.
- [ ] `POST /api/lichkham` trả 201.
- [ ] Lịch mới có `maLich` và `soThuTu`.
- [ ] Bệnh nhân xem danh sách lịch của mình.
- [ ] Bệnh nhân xem chi tiết lịch.
- [ ] Bệnh nhân hủy lịch chưa hoàn thành.
- [ ] Bệnh nhân không xem/hủy lịch của người khác.
- [ ] Hồ sơ bệnh án tải từ AWS thật.
- [ ] Phiếu khám tải từ AWS thật.
- [ ] Đơn thuốc tải từ AWS thật.
- [ ] Tài liệu y tế tải metadata từ AWS thật.
- [ ] Kết quả xét nghiệm tải từ AWS thật.
- [ ] Chi tiết xét nghiệm hoạt động.
- [ ] Thông tin cá nhân cập nhật thành công.
- [ ] Trạng thái loading/empty/error hiển thị đúng.

## Kiểm thử và bàn giao

- [ ] `npm run test:mobile:contract` PASS.
- [ ] `npm test` PASS sau `npm install`.
- [ ] `npm run test:medical` PASS.
- [ ] `npm run synth:app` PASS.
- [ ] `npm run diff:app` không replace dữ liệu quan trọng.
- [ ] `npm run deploy:app` hoàn tất `UPDATE_COMPLETE`.
- [ ] `npm run seed:medical` thành công.
- [ ] `npm run verify:medical` PASS.
- [ ] `npm run test:mobile:backend` PASS.
- [ ] `npm run build:mobile` tạo APK debug.
- [ ] Không commit secret, token, outputs hoặc build artifacts.
- [ ] Branch `feat/week2-mobile-health/caothien` đã push.
- [ ] Pull Request vào `develop`.
