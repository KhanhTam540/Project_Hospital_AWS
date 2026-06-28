# Checklist Khánh Tâm — Tuần 1 và Tuần 2

## Tuần 1 — Edge, hosting, identity

- [ ] Route 53 Public Hosted Zone hoạt động với domain thật.
- [ ] Bản ghi NS tại nhà đăng ký domain trỏ về Route 53.
- [ ] ACM Certificate ở `us-east-1` có trạng thái `ISSUED`.
- [ ] WAF Web ACL scope `CLOUDFRONT` được tạo ở `us-east-1`.
- [ ] WAF có Common Rules, Known Bad Inputs, IP Reputation và Rate Limit.
- [ ] CloudFront gắn WAF Web ACL.
- [ ] CloudFront gắn ACM Certificate và alternate domain.
- [ ] Route 53 có A Alias và AAAA Alias trỏ vào CloudFront.
- [ ] S3 Frontend là private và dùng OAC.
- [ ] HTTPS custom domain mở được.
- [ ] Cognito User Pool, Web Client, Mobile Client hoạt động.
- [ ] Có đủ nhóm `ADMIN`, `BACSI`, `NHANSU`, `BENHNHAN`.
- [ ] IAM role của Lambda tuân theo quyền cần thiết.

## Tuần 2 — Encryption, secrets, messaging, integration IAM

- [ ] Customer-managed KMS key tồn tại.
- [ ] KMS automatic rotation bật.
- [ ] Medical S3 dùng SSE-KMS, versioning, SSL và block public access.
- [ ] DynamoDB dùng KMS, PITR, TTL và on-demand billing.
- [ ] Secrets Manager secret dùng customer-managed KMS key.
- [ ] Background SQS queue dùng KMS và SSL.
- [ ] SQS DLQ dùng KMS và có redrive policy.
- [ ] SNS OTP topic dùng KMS và SSL.
- [ ] Core/Medical Lambda có quyền gửi SQS theo yêu cầu.
- [ ] Core Lambda có quyền publish SNS theo yêu cầu.
- [ ] AI/Audit execution role tồn tại.
- [ ] AI/Audit role có Bedrock invoke permissions.
- [ ] AI/Audit role có Managed Blockchain read/query permissions.
- [ ] AI/Audit role đọc được Secret, DynamoDB, Medical S3 và SQS.
- [ ] CloudFormation Outputs chứa ARN/URL của tài nguyên mới.
- [ ] `cdk synth`, `cdk diff`, deploy và smoke test thành công.
