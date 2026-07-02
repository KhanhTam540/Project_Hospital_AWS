# API cần cho Mobile hợp nhất

`API_BASE_URL` nên là CloudFront URL. `AppConfig` tự nối thêm `/api` khi cần.

## Tuần 1

- `GET /api/health`
- `GET /api/me`
- Cognito User Pool và Mobile Client.
- Post Confirmation tự gán nhóm `BENHNHAN` và tạo profile ứng dụng.

## Tuần 2 đã có trong backend hiện tại

- `GET /api/khoa`
- `GET /api/bacsi`
- `GET /api/lichlamviec`
- `GET /api/lichkham/benhnhan/{patientId}`
- `GET /api/benhnhan/{patientId}`
- `PUT /api/benhnhan/{patientId}`
- `GET /api/patients/{patientId}/records`
- `GET /api/patients/{patientId}/examinations`
- `GET /api/patients/{patientId}/prescriptions`
- `GET /api/patients/{patientId}/documents`
- `GET /api/phieuxetnghiem`

## Route cần bổ sung để Tuần 2 đạt đầy đủ

Theo source backend đã kiểm tra, các route sau chưa có hoặc chưa được khai báo đầy đủ:

- `POST /api/lichkham`
- `GET /api/lichkham/{appointmentId}`
- `DELETE /api/lichkham/{appointmentId}`
- `GET /api/phieuxetnghiem/{labResultId}`

Mobile đã có giao diện và xử lý lỗi cho các route này. Chế độ Demo chạy đủ luồng tạo, xem và hủy lịch. AWS mode chỉ hoàn thành đầy đủ khi backend deploy thêm bốn route trên.

## Tuần 3 và chức năng mở rộng

- `POST /api/ai/chat` đã được `ChatbotService` sử dụng.
- Các route hóa đơn, thanh toán và chat nội bộ cần backend tương ứng nếu muốn chạy dữ liệu thật.
