# Báo cáo hợp nhất Mobile Cao Thiên

## Mục tiêu

Giữ lại toàn bộ giao diện gốc của Cao Thiên nhưng thay phần nền tảng bị lỗi bằng luồng Cognito và AWS API của dự án Hospital P2TB.

## Kết quả hợp nhất

- Giữ 73 file Dart trong `lib`.
- Giữ 54 cấu hình `GoRoute` cho các vai trò.
- Giữ các khu vực giao diện:
  - Admin.
  - Bác sĩ.
  - Bệnh nhân.
  - Y tá.
  - Tiếp nhận.
  - Xét nghiệm.
  - Chat và chatbot.
  - Hóa đơn/thanh toán demo.
- Viết lại:
  - `analysis_options.yaml`.
  - `lib/main.dart`.
  - `lib/config/amplify_bootstrap.dart`.
  - `lib/auth/auth_provider.dart`.
  - `lib/services/auth_service.dart`.
  - `lib/services/api_client.dart`.
  - `lib/services/demo_api.dart`.
  - `lib/services/chatbot_service.dart`.
- Sửa import sai trong hai màn hình Nhân sự.
- Đổi upload từ `File` sang `XFile` để tương thích Flutter Web và Android.
- Thay Android platform bằng cấu hình sạch có Gradle wrapper, Java 17, `minSdk = 24` và package `com.hospitalp2tb.mobile`.
- Loại bỏ cache, build output, local SDK path và file generated cũ.

## Các lỗi cũ đã xử lý

- `Only expected one document` trong `analysis_options.yaml`.
- Trùng tên `Amplify` giữa `amplify_core` và `amplify_flutter`.
- Sử dụng sai `AmplifyOutputs`, `AuthOutputs`, `PasswordPolicy`.
- Trùng tên `AuthProvider` trong `main.dart`.
- Lỗi biểu thức ở `auth_provider.dart` dòng 126.
- Import tương đối sai `../../../auth/...`.
- `dart:io` làm Flutter Web không biên dịch.
- Android namespace không khớp `MainActivity`.
- Thiếu `gradlew`, `gradlew.bat` và `gradle-wrapper.jar`.
- Một số chuỗi tiếng Việt bị lỗi mã hóa.

## Xác minh tĩnh đã thực hiện

- Toàn bộ file Dart trong `lib` và `test` parse được bằng Dart tree-sitter.
- Không còn relative import bị thiếu.
- Không còn package import chưa khai báo trong `pubspec.yaml`.
- Không còn `dart:io` trong thư mục `lib`.
- Không tìm thấy API key, JWT cố định, AWS key hoặc signing key trong source.
- Tất cả widget được gọi trong router đều có class tương ứng.

## Giới hạn xác minh

Môi trường tạo gói không có Flutter SDK nên chưa thể chạy trực tiếp:

- `flutter pub get`.
- `flutter analyze`.
- `flutter test`.
- `flutter build apk`.

Các lệnh này đã được gom trong `mobile/scripts/verify.ps1` để chạy trên máy Windows của dự án.
