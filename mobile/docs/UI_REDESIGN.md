# Hospital P2TB Mobile – Thiết kế giao diện mới

## Mục tiêu

Bản thiết kế thay giao diện demo rời rạc bằng một ứng dụng Flutter thống nhất, responsive và bám theo các API thật trong backend AWS.

## Kiến trúc giao diện

- Material 3, Light/Dark mode.
- Mobile: AppBar, Drawer và Bottom Navigation.
- Tablet/Desktop: sidebar cố định và thanh điều hướng trên.
- Menu thay đổi theo vai trò: ADMIN, BACSI, BENHNHAN, NHANSU.
- Mỗi màn hình đều có loading, empty state, error state và pull-to-refresh.
- JWT tiếp tục do Cognito/Amplify quản lý; UI không lưu token hoặc secret.

## Màn hình mới

1. Tổng quan theo vai trò.
2. Tài khoản và phân quyền.
3. Danh sách, tạo và cập nhật bệnh nhân.
4. Bác sĩ, nhân sự, khoa và phòng khám.
5. Lịch khám: tạo, xem, lọc theo vai trò và hủy.
6. Lịch làm việc và ca trực.
7. Hồ sơ lâm sàng: bệnh án, phiếu khám, đơn thuốc, tài liệu S3.
8. Dược: thuốc, nhóm thuốc, đơn vị tính.
9. Xét nghiệm: kết quả, yêu cầu và danh mục.
10. Hóa đơn và thống kê.
11. Trợ lý AI: chat và summary qua backend.
12. Hồ sơ cá nhân và đổi mật khẩu.
13. Danh mục API để đối chiếu route backend với giao diện.

## Nguyên tắc an toàn

- Không gọi Gemini trực tiếp từ Flutter.
- Không đặt AWS credentials, Gemini API key hoặc signing key trong Mobile.
- Tài liệu y tế được tải qua pre-signed URL do backend cấp.
- Chỉ hiển thị chức năng ghi dữ liệu khi backend có route tương ứng.
- Module hóa đơn hiện là read-only vì backend chưa có API thanh toán.
