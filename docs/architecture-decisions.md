# Quyết định kiến trúc tuần 1

1. Toàn bộ mã nguồn dùng JavaScript. AWS CDK và Lambda dùng CommonJS; React dùng JavaScript/JSX.
2. Region chính là `ap-southeast-1`. CloudFront là dịch vụ toàn cầu.
3. Không tạo VPC trong tuần 1 vì Lambda chỉ truy cập các dịch vụ AWS managed qua public service endpoints. Việc thêm NAT Gateway khi chưa cần thiết làm tăng chi phí.
4. Frontend bucket là S3 private, bật Block Public Access và chỉ cho CloudFront truy cập bằng Origin Access Control.
5. Medical bucket tách riêng, mã hóa bằng customer-managed KMS key, bật versioning và chỉ truy cập qua IAM hoặc presigned URL.
6. DynamoDB sử dụng single-table baseline với `pk`, `sk`, TTL và Point-in-Time Recovery.
7. Cognito có hai public app client riêng cho Web và Mobile, không tạo client secret.
8. Người dùng tự đăng ký được tự động thêm vào nhóm `BENHNHAN` bằng Post Confirmation Lambda.
9. API Gateway xác thực Cognito JWT; Lambda tiếp tục kiểm tra claim `cognito:groups` cho từng nghiệp vụ.
10. File không đi qua API Gateway hoặc Lambda. Client xin presigned URL rồi upload trực tiếp vào S3.
11. Route 53, ACM custom domain và WAF được hoãn cho đến khi nhóm có tên miền thật và chấp nhận chi phí.
12. Bedrock, thanh toán, SMS OTP, SQS worker và blockchain không nằm trong phạm vi code tuần 1.
