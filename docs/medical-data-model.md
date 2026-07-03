# Medical Data Model – Tuần 1 Đình Bảo

DynamoDB sử dụng single-table với hai khóa `pk` và `sk`.

## Bệnh nhân

```text
pk = PATIENT#<patientId>
sk = PROFILE
```

## Hồ sơ bệnh án

Bản ghi trong phân vùng bệnh nhân:

```text
pk = PATIENT#<patientId>
sk = RECORD#<createdAt>#<recordId>
```

Bản ghi tra cứu trực tiếp:

```text
pk = RECORD#<recordId>
sk = METADATA
```

## Phiếu khám

```text
pk = PATIENT#<patientId>
sk = EXAM#<createdAt>#<examinationId>
```

Tra cứu trực tiếp:

```text
pk = EXAMINATION#<examinationId>
sk = METADATA
```

`NHANSU` được nhập chỉ số sinh tồn. Chỉ `BACSI` được nhập `diagnosis` và `treatment`.

## Đơn thuốc

```text
pk = PATIENT#<patientId>
sk = PRESCRIPTION#<createdAt>#<prescriptionId>
```

Tra cứu trực tiếp:

```text
pk = PRESCRIPTION#<prescriptionId>
sk = METADATA
```

Mỗi phần tử `medicineItems` gồm mã thuốc, tên thuốc, số lượng, liều dùng, tần suất, số ngày và hướng dẫn.

## Tài liệu y tế

```text
pk = PATIENT#<patientId>
sk = DOCUMENT#<createdAt>#<documentId>
```

Tra cứu trực tiếp:

```text
pk = DOCUMENT#<documentId>
sk = METADATA
```

Trạng thái:

- `PENDING_UPLOAD`: đã cấp URL nhưng chưa xác nhận file.
- `AVAILABLE`: file đã được kiểm tra bằng `HeadObject`.
- `REJECTED`: sai kích thước, content type hoặc metadata.
- `DEMO_METADATA`: chỉ là dữ liệu mẫu, không có object S3 thực.
