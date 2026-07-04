# Báo cáo kiểm tra bộ code Hoàng Phúc – 3 tuần

Ngày kiểm tra: 2026-06-30

## Phạm vi

Bộ code được kiểm tra tại môi trường local, không truy cập hoặc deploy trực tiếp vào tài khoản AWS của người dùng.

## Kết quả đã chạy

| Hạng mục | Kết quả |
|---|---|
| `npm run build` | Thành công, kiểm tra cú pháp 108 file JavaScript |
| `npm test` | Thành công, 34/34 test pass, 0 fail |
| `npm run validate:data:local` | Thành công, 52 item trong 13 file dataset hợp lệ |
| `npm run build:web` | Thành công, Vite build 3.626 module |
| `npm run synth:app` | Thành công với Region Singapore, CloudFront tắt và Week 3 Operations bật |

## Tài nguyên CDK được tổng hợp

- 1 DynamoDB table, có GSI `gsi1`.
- 2 SQS queues: queue chính và DLQ.
- 6 Lambda functions.
- 1 Lambda SQS Event Source Mapping.
- 1 API Gateway HTTP API.
- 1 JWT Authorizer.
- 93 API Gateway routes tổng cộng, gồm các API Core và Medical hiện có.
- 11 CloudWatch alarms và 1 dashboard.

## Những API Core quan trọng đã có trong template

- `POST /api/tai-khoan`
- CRUD `/api/khoa`
- CRUD `/api/phongkham`
- CRUD `/api/phongkhamngoai`
- CRUD `/api/bacsi`
- CRUD `/api/nhansu`
- CRUD `/api/catruc`
- CRUD `/api/lichlamviec`
- CRUD `/api/lichkham`
- `PATCH /api/lichkham/{appointmentId}/status`

## Dataset đã kiểm tra

Tổng cộng 52 item:

- 5 Appointment
- 3 Department
- 4 Doctor
- 1 External clinic
- 3 Medical record
- 3 Medicine
- 10 Patient
- 2 Prescription
- 3 Prescription item
- 6 Room
- 2 Shift
- 2 Staff
- 4 User
- 4 Work schedule

## Cảnh báo không chặn build

- Vite cảnh báo bundle chính lớn hơn 500 kB.
- Browserslist/caniuse-lite đã cũ.
- CDK cảnh báo `logRetention` đã deprecated và nên chuyển sang `logGroup` trong lần nâng cấp sau.

Các cảnh báo trên không làm build hoặc synth thất bại.

## Những phần vẫn phải xác nhận trên AWS thật

- `npx cdk diff` không xóa nhầm tài nguyên dữ liệu.
- Deploy kết thúc bằng `UPDATE_COMPLETE`.
- Cognito thực sự gửi email mời cho `AdminCreateUser`.
- JWT/RBAC hoạt động với token thật.
- CRUD ghi dữ liệu vào bảng thật.
- SQS Worker xử lý message, retry và DLQ đúng.
- Frontend tích hợp không còn 404/401/403 ngoài các trường hợp được thiết kế.

