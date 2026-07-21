# Báo cáo kiểm tra bộ sửa đổi

Ngày kiểm tra: 2026-07-01

## Kết quả local

| Hạng mục | Kết quả |
|---|---|
| Kiểm tra cú pháp JavaScript | 100 file hợp lệ |
| Unit tests | 26/26 pass, 0 fail |
| Vite production build | Thành công, 3.625 module transformed |
| CDK synth | Thành công |
| API routes yêu cầu trong template | Đầy đủ |
| IAM Cognito của Core Lambda | Có AdminCreateUser, AdminSetUserPassword, AdminDeleteUser |

## API mới hoặc được hoàn thiện

```text
GET /api/public/khoa
GET /api/public/bacsi
GET /api/public/tintuc
GET /api/public/tintuc/{newsId}

POST /api/tai-khoan
GET /api/tai-khoan/{username}

GET/POST /api/bacsi
GET/PUT/DELETE /api/bacsi/{doctorId}
GET/POST /api/nhansu
GET/PUT/DELETE /api/nhansu/{staffId}

GET/POST /api/loaixetnghiem
GET/PUT/DELETE /api/loaixetnghiem/{typeId}
GET/POST /api/xetnghiem
GET/PUT/DELETE /api/xetnghiem/{testId}

GET/POST /api/phanhoi
GET /api/phanhoi/stats
GET /api/phanhoi/benhnhan/{patientId}
GET/PUT/DELETE /api/phanhoi/{feedbackId}

GET/POST /api/tintuc
GET/PUT/DELETE /api/tintuc/{newsId}
```

## Chưa thể xác nhận tại môi trường local

Các mục sau cần kiểm tra sau khi deploy vào tài khoản AWS thật:

- Trạng thái Cognito thực tế chuyển thành `CONFIRMED`.
- JWT role và ownership với token thật.
- Ghi/xóa dữ liệu trên bảng DynamoDB thật.
- CloudFront nhận bản frontend mới sau invalidation.
- Các API public hoạt động qua behavior `/api/*` của CloudFront.
