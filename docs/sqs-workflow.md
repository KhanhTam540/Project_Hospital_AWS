# SQS Workflow — Hoàng Phúc Tuần 3

## Kiến trúc

```text
Core Lambda
    │ SendMessageCommand
    ▼
BackgroundTaskQueue
    │ Lambda event source
    ▼
CoreWorkerFunction
    │ TransactWriteItems
    ├── Idempotency marker
    ├── Background audit
    └── Notification items

Sau 5 lần thất bại
    ▼
BackgroundTaskDlq
```

## Event được phát

```text
USER_CREATED
USER_UPDATED
USER_DISABLED
USER_ENABLED
DEPARTMENT_CREATED / UPDATED / DELETED
ROOM_CREATED / UPDATED / DELETED
EXTERNAL_CLINIC_CREATED / UPDATED / DELETED
DOCTOR_CREATED / UPDATED / DEACTIVATED
STAFF_CREATED / UPDATED / DEACTIVATED
SHIFT_CREATED / UPDATED / DELETED
WORK_SCHEDULE_CREATED / UPDATED / DELETED
APPOINTMENT_CREATED / UPDATED / CANCELLED
```

## Message schema

```json
{
  "eventId": "uuid",
  "eventType": "APPOINTMENT_CREATED",
  "createdAt": "2099-07-01T01:00:00.000Z",
  "actor": {
    "sub": "cognito-sub",
    "username": "admin@example.com",
    "groups": ["ADMIN"]
  },
  "payload": {
    "appointmentId": "LH001",
    "patientId": "BN001",
    "doctorId": "BS001"
  }
}
```

## Idempotency

Worker tạo item:

```text
pk = EVENT#<eventId>
sk = PROCESSED
```

với `ConditionExpression` chống xử lý trùng. Marker hết hạn sau 7 ngày qua DynamoDB TTL.

## Partial batch response

Worker trả:

```json
{
  "batchItemFailures": [
    { "itemIdentifier": "message-id-that-failed" }
  ]
}
```

Message thành công không bị retry lại; chỉ message lỗi được SQS giao lại.

## Kiểm tra trên AWS Console

1. SQS → `BackgroundTaskQueue` → Monitoring.
2. Lambda → `CoreWorkerFunction` → Monitor → CloudWatch Logs.
3. DynamoDB → Explore table items → tìm `EVENT#` và `AUDIT#`.
4. Gây lỗi có chủ đích trong môi trường test, chờ đủ `maxReceiveCount=5`.
5. SQS → `BackgroundTaskDlq` → Send and receive messages để xác nhận message lỗi.
