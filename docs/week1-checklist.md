# Checklist hoàn thành tuần 1

## Mã nguồn

- [ ] Không còn file `.ts`, `.tsx` hoặc `tsconfig.json`.
- [ ] `npm run build` thành công.
- [ ] `npm test` thành công.
- [ ] `npm run synth` thành công.
- [ ] `npm run build:web` thành công.

## AWS

- [ ] AWS CLI profile `hospital-dev` hoạt động.
- [ ] CDK bootstrap tại `ap-southeast-1` thành công.
- [ ] `HospitalDevStack` có trạng thái `CREATE_COMPLETE`.
- [ ] S3 Frontend bật Block Public Access.
- [ ] CloudFront truy cập S3 bằng OAC.
- [ ] Cognito có Web Client và Mobile Client.
- [ ] Cognito có bốn group: ADMIN, BACSI, NHANSU, BENHNHAN.
- [ ] API `/api/health` trả 200.
- [ ] Web mở được qua CloudFront.

## Kiểm thử chức năng

- [ ] Bệnh nhân tự đăng ký và xác nhận email.
- [ ] Tài khoản mới thuộc nhóm BENHNHAN.
- [ ] ADMIN gọi `/api/admin/ping` trả 200.
- [ ] BENHNHAN gọi `/api/admin/ping` trả 403.
- [ ] NHANSU tạo được bệnh nhân.
- [ ] BACSI xem bệnh nhân và tạo hồ sơ bệnh án.
- [ ] BACSI hoặc NHANSU upload được PDF/JPEG/PNG bằng presigned URL.
- [ ] ADMIN/BACSI/NHANSU tải được tài liệu bằng download URL.

## GitHub

- [ ] Làm việc trên `feat/week1-infrastructure/khanhtam`.
- [ ] Không commit `node_modules`, `cdk.out`, `web/dist` hoặc file `.env`.
- [ ] Tạo Pull Request vào `develop`.
- [ ] Lưu ảnh minh chứng không chứa Access Key, Secret Key, JWT hoặc mật khẩu.
