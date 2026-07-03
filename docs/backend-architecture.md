# Hoàng Phúc Week 1 Backend Architecture

1. React or Flutter authenticates directly with Amazon Cognito.
2. The client sends `Authorization: Bearer <JWT>` to API Gateway.
3. API Gateway JWT Authorizer verifies issuer and audience.
4. Core Lambda reads verified claims and Cognito groups.
5. Lambda enforces application-level RBAC.
6. DynamoDB stores multiple entity types using `pk` and `sk`.
7. Dataset scripts seed, verify and reset development-only sample data.
