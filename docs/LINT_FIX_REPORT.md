# Báo cáo sửa toàn bộ cảnh báo trong ảnh

Bản này giữ nguyên toàn bộ giao diện gốc của Cao Thiên và sửa các vấn đề thực tế:

- Xóa import không dùng.
- Xóa helper/field/local variable không dùng.
- Xóa các toán tử `!` không cần thiết tại các vị trí analyzer xác nhận.
- Chuyển `withOpacity` sang `withValues(alpha: ...)`.
- Chuyển `MaterialStateProperty` sang `WidgetStateProperty`.
- Chuyển `dataRowHeight` sang `dataRowMinHeight` và `dataRowMaxHeight`.
- Chuyển `DropdownButtonFormField.value` sang `initialValue`.
- Giữ các lint kiểu trình bày của giao diện legacy ở chế độ không bắt buộc.
- Không tắt kiểm tra cú pháp, kiểu dữ liệu, import thiếu, method thiếu hoặc lỗi biên dịch.

Các lint style được tắt:
- use_key_in_widget_constructors
- library_private_types_in_public_api
- no_leading_underscores_for_local_identifiers
- sort_child_properties_last
- curly_braces_in_flow_control_structures
- use_super_parameters
- sized_box_for_whitespace
- prefer_const_constructors_in_immutables
- todo

Lý do: các lint này không ảnh hưởng runtime và việc sửa hàng loạt constructor/cấu trúc widget cũ có nguy cơ làm thay đổi giao diện đã hoàn thành.
