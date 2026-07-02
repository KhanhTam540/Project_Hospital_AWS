# Hospital P2TB Mobile — Android/AWS Fixed

Ứng dụng Flutter đã được đồng bộ với `HospitalDevStack` hiện tại.

## Các lỗi đã sửa

- Xóa `android/local.properties` chứa đường dẫn máy cũ.
- Thêm script tạo lại Android SDK/Flutter SDK path trên máy hiện tại.
- GoRouter dùng một instance duy nhất và tự refresh theo `AuthProvider`.
- Thêm route `/404` thật, tránh redirect không ổn định sau đăng nhập/đăng xuất.
- Sửa đọc response `GET /api/tai-khoan`, vì backend trả `data.users` thay vì một List trực tiếp.
- Admin đổi quyền/vô hiệu hóa bằng Cognito `username`, không dùng `maTK`.
- Không gọi các route hóa đơn cũ không tồn tại.
- Ẩn Chat nội bộ khi chạy AWS thật; Chat nội bộ chỉ dùng trong Demo.
- Scripts đọc `aws-dev-outputs.json` bằng Node nên không lỗi `Region/region` trên Windows PowerShell.
- Tự nhận Android Emulator khi không truyền `-DeviceId`.

## Chạy nhanh

Tại thư mục gốc dự án:

```powershell
npm run outputs
powershell -ExecutionPolicy Bypass -File .\mobile\scripts\setup-android.ps1
powershell -ExecutionPolicy Bypass -File .\mobile\scripts\run-aws.ps1
```

Kiểm tra toàn bộ Mobile:

```powershell
powershell -ExecutionPolicy Bypass -File .\mobile\scripts\verify.ps1 -BuildDebugApk
```

Xem `HUONG_DAN_ANDROID_STUDIO.md` trong gói patch để thực hiện từng bước.
