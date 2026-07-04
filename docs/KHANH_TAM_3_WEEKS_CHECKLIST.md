# CHECKLIST KHÁNH TÂM — HOÀN THÀNH 3 TUẦN

## Phạm vi đã chốt

- CloudFront Free plan, URL mặc định `*.cloudfront.net`.
- Không Route 53, không ACM custom domain, không HospitalEdgeStack.
- Giữ Web ACL `CreatedByCloudFront` hiện tại.
- Thay Amazon Bedrock bằng external ChatAI API tương thích OpenAI.
- API key chỉ lưu trong AWS Secrets Manager.
- Tuần 3 bổ sung CloudWatch, CloudTrail và AWS Backup.

---

## Tuần 1 — CloudFront, S3 Frontend, WAF, Cognito, IAM

- [ ] `HospitalDevStack` ở `UPDATE_COMPLETE` hoặc `CREATE_COMPLETE`.
- [ ] CloudFront Distribution ở `Deployed`.
- [ ] URL có dạng `https://d....cloudfront.net`.
- [ ] `CloudFrontDefaultCertificate = true`.
- [ ] Template CDK không có `PriceClass`.
- [ ] Template CDK không có Route 53, ACM hoặc custom aliases.
- [ ] Web ACL là `CreatedByCloudFront` và không bị thay thế.
- [ ] S3 Frontend chặn public access.
- [ ] S3 Frontend bật versioning.
- [ ] CloudFront dùng Origin Access Control để đọc S3.
- [ ] SPA rewrite hoạt động khi refresh route React.
- [ ] `/api/*` đi qua CloudFront đến API Gateway.
- [ ] Cognito User Pool tồn tại.
- [ ] Web Client và Mobile Client tồn tại.
- [ ] Có đủ group `ADMIN`, `BACSI`, `NHANSU`, `BENHNHAN`.
- [ ] User mới tự động vào group `BENHNHAN`.
- [ ] Đăng ký, xác nhận email, đăng nhập thành công.
- [ ] `/api/me` chấp nhận JWT hợp lệ.
- [ ] `/api/admin/ping` kiểm tra phân quyền đúng.
- [ ] IAM Lambda không dùng AdministratorAccess.
- [ ] `npm run smoke` thành công.

---

## Tuần 2 — KMS, Secrets Manager, S3 Medical, DynamoDB, SQS, SNS

- [ ] KMS customer-managed key tồn tại và Enabled.
- [ ] KMS automatic rotation được bật.
- [ ] Secrets Manager secret tồn tại và dùng KMS.
- [ ] Secret có cấu hình external AI nhưng không lộ API key.
- [ ] S3 Medical chặn public access.
- [ ] S3 Medical dùng SSE-KMS và bật versioning.
- [ ] Presigned upload/download hoạt động.
- [ ] DynamoDB ở `ACTIVE`, billing `PAY_PER_REQUEST`.
- [ ] DynamoDB dùng KMS, TTL `expiresAt`, PITR Enabled.
- [ ] Seed và verify dữ liệu thành công.
- [ ] SQS main queue tồn tại, dùng KMS và long polling.
- [ ] SQS có DLQ và `maxReceiveCount = 5`.
- [ ] SNS OTP topic tồn tại và dùng KMS.
- [ ] Core/Medical Lambda có đúng quyền SQS/SNS.
- [ ] `AiAuditExecutionRole` tồn tại.
- [ ] Role external AI chỉ đọc secret và ghi audit DynamoDB.
- [ ] Không còn bất kỳ quyền hoặc biến môi trường Bedrock nào.
- [ ] Managed Blockchain chỉ giữ IAM permission nếu nhóm vẫn cần; không tạo network/node tính phí.

---

## Tuần 3 — External ChatAI, CloudWatch, CloudTrail, AWS Backup

### External ChatAI

- [ ] `services/ai-audit/handler.js` tồn tại.
- [ ] `AiAuditFunction` được deploy.
- [ ] Route `POST /api/ai/chat` có JWT authorizer.
- [ ] Route `POST /api/ai/summary` có JWT authorizer.
- [ ] API key nằm trong Secrets Manager, không nằm trong frontend/Lambda environment.
- [ ] `AI_BASE_URL`, `AI_API_STYLE`, `AI_MODEL`, `AI_API_KEY` được cấu hình.
- [ ] External API trả kết quả thành công.
- [ ] Có timeout và xử lý 429/502/504.
- [ ] Có disclaimer y tế.
- [ ] Dữ liệu email/số điện thoại/mã định danh được ẩn cơ bản trước khi gửi.
- [ ] Không log toàn bộ prompt, response hoặc API key.
- [ ] DynamoDB chỉ lưu hash và metadata audit.
- [ ] `npm run verify:no-bedrock` thành công.
- [ ] `npm run test:ai` thành công.

### CloudWatch

- [ ] Dashboard `Hospital-P2TB-Operations` tồn tại.
- [ ] Có metric Lambda invocations, errors và duration.
- [ ] Có alarm Core Lambda errors/throttles.
- [ ] Có alarm Medical Lambda errors/throttles.
- [ ] Có alarm AI Lambda errors/throttles.
- [ ] Có alarm HTTP API 5xx.
- [ ] Có alarm SQS DLQ messages.
- [ ] Có alarm tuổi message SQS lớn hơn 5 phút.
- [ ] SNS operations alert topic tồn tại.
- [ ] Email subscription đã nhấn Confirm subscription.
- [ ] Lambda log retention là 14 ngày.

### CloudTrail

- [ ] Trail `hospital-p2tb-audit-trail` tồn tại.
- [ ] `IsLogging = true`.
- [ ] Trail multi-region và gồm global service events.
- [ ] Management events Read/Write được bật.
- [ ] CloudTrail bucket chặn public access.
- [ ] CloudTrail bucket dùng KMS và versioning.
- [ ] Log file validation được bật.
- [ ] Lifecycle xóa log sau 30 ngày.
- [ ] `lookup-events` tìm được sự kiện kiểm thử.

### AWS Backup

- [ ] Backup vault `hospital-p2tb-backup-vault` tồn tại.
- [ ] Vault dùng KMS và RemovalPolicy RETAIN.
- [ ] Backup plan `hospital-p2tb-daily-backup` tồn tại.
- [ ] Lịch chạy hằng ngày lúc 18:00 UTC.
- [ ] Retention là 7 ngày.
- [ ] DynamoDB nằm trong backup selection.
- [ ] S3 AWS Backup chỉ bật khi chấp nhận chi phí.
- [ ] Có recovery point sau khi lịch chạy hoặc backup thủ công.
- [ ] Đã thử restore sang tài nguyên thử nghiệm, không ghi đè dữ liệu thật.

---

## Kiểm tra hồi quy và bàn giao

- [ ] `node --check` đạt cho toàn bộ file mới.
- [ ] `npm run build` thành công.
- [ ] `npm test` thành công.
- [ ] `npm run test:medical` thành công.
- [ ] `npm run build:web` thành công.
- [ ] `npm run synth:app` thành công.
- [ ] `npm run diff:app` không replace DynamoDB/KMS/S3/Cognito/CloudFront.
- [ ] `npm run deploy:app` thành công.
- [ ] `npm run outputs` thành công.
- [ ] `npm run deploy:web` thành công.
- [ ] `npm run smoke` thành công.
- [ ] Không commit `.env.local`, API key, AWS credentials, `node_modules`, `cdk.out`.
- [ ] Code được push lên feature branch và merge vào `develop`.
- [ ] Đã lưu ảnh bằng chứng CloudFormation, CloudFront, Cognito, KMS, S3, DynamoDB, SQS/SNS, AI, CloudWatch, CloudTrail và Backup.

## Kết luận

- [ ] Tuần 1 hoàn thành 100% theo phạm vi CloudFront Free plan.
- [ ] Tuần 2 hoàn thành 100% phần bảo mật và dữ liệu.
- [ ] Tuần 3 hoàn thành 100% external AI, vận hành, audit và backup.
