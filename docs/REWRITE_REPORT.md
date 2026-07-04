# Báo cáo viết lại thư mục Mobile

## Các lỗi của thư mục cũ đã được loại bỏ

- `analysis_options.yaml` chứa lệnh PowerShell và nhiều YAML document.
- Cấu hình Amplify dùng class nội bộ/sai constructor.
- Import `amplify_core` và `amplify_flutter` gây trùng tên `Amplify`.
- Class `AuthProvider` của dự án trùng với type do Amplify export.
- Mã phân tích lỗi trong provider xác thực.
- API client dùng `dart:io`, không chạy được trên Flutter Web.
- URL backend local `10.0.2.2:4000` và API đăng nhập local.
- Package Android và `MainActivity` không cùng namespace.
- Thiếu Gradle wrapper trong module chính.
- Nhiều màn hình vai trò khác chưa hoàn thiện làm tăng lỗi analyzer.

## Kiến trúc mới

```text
lib/
├── config/
├── controllers/
├── models/
├── screens/
│   ├── auth/
│   └── patient/
├── services/
├── theme/
├── widgets/
└── main.dart
```

Module runtime được giới hạn đúng phần Cao Thiên Tuần 1–2: ứng dụng bệnh nhân. Giao diện Admin/Bác sĩ/Nhân sự cũ không được đưa vào runtime sạch vì không thuộc phạm vi nghiệm thu này và chứa nhiều TODO/deprecated code.

## Kiểm tra đã thực hiện trong môi trường tạo bản sửa

- Parse toàn bộ file Dart bằng tree-sitter: không có lỗi cú pháp.
- Kiểm tra toàn bộ relative import: không thiếu file.
- Parse `pubspec.yaml` và `analysis_options.yaml`: hợp lệ.
- Kiểm tra namespace Android và MainActivity: đồng nhất.
- Kiểm tra không chứa URL local, API key hoặc JWT cố định.

Flutter SDK không có trong môi trường tạo gói, vì vậy `flutter analyze`, `flutter test` và `flutter build apk` phải được chạy trên máy Windows theo `scripts/verify.ps1` trước khi merge.
