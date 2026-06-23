const { randomUUID } = require('crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const {
  ApiError,
  getSubject,
  handleError,
  json,
  parseJsonBody,
  queryParameter,
  requireAnyGroup,
  routeParameter,
} = require('../shared/http');

const s3 = new S3Client({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

const tableName = process.env.TABLE_NAME;
const bucketName = process.env.MEDICAL_BUCKET_NAME;
const maxFileSizeBytes = Number(
  process.env.MAX_FILE_SIZE_BYTES || 10 * 1024 * 1024,
);

const allowedContentTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

const requireEnvironment = () => {
  if (!tableName || !bucketName) {
    throw new Error('Medical service environment is not configured');
  }
};

const cleanText = (value, fieldName, maxLength = 255) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, `${fieldName} is required`);
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new ApiError(
      400,
      `${fieldName} must not exceed ${maxLength} characters`,
    );
  }

  return normalized;
};

const optionalText = (value, maxLength = 1000) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new ApiError(400, 'Optional text fields must be strings');
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new ApiError(
      400,
      `Text field must not exceed ${maxLength} characters`,
    );
  }

  return normalized || undefined;
};

const safeFileName = (value) => {
  const originalName = cleanText(value, 'fileName', 180);
  const sanitized = originalName
    .replace(/[\\/]/g, '_')
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .replace(/\s+/g, '_');

  if (!sanitized || sanitized === '.' || sanitized === '..') {
    throw new ApiError(400, 'fileName is invalid');
  }

  return sanitized;
};

const patientKey = (patientId) => ({
  pk: `PATIENT#${patientId}`,
  sk: 'PROFILE',
});

const getPatient = async (patientId) => {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: patientKey(patientId),
      ConsistentRead: true,
    }),
  );

  return result.Item;
};

const ensurePatientExists = async (patientId) => {
  const patient = await getPatient(patientId);
  if (!patient) {
    throw new ApiError(404, 'Patient not found');
  }
  return patient;
};

const createPatient = async (event) => {
  requireAnyGroup(event, ['ADMIN', 'NHANSU']);
  const subject = getSubject(event);
  const body = parseJsonBody(event.body);

  const fullName = cleanText(body.fullName, 'fullName', 150);
  const dateOfBirth = cleanText(body.dateOfBirth, 'dateOfBirth', 10);
  const gender = cleanText(body.gender, 'gender', 10).toUpperCase();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    throw new ApiError(400, 'dateOfBirth must use YYYY-MM-DD format');
  }

  if (!['NAM', 'NU', 'KHAC'].includes(gender)) {
    throw new ApiError(400, 'gender must be NAM, NU or KHAC');
  }

  const patientId = randomUUID();
  const now = new Date().toISOString();
  const item = {
    ...patientKey(patientId),
    entityType: 'PATIENT',
    patientId,
    fullName,
    dateOfBirth,
    gender,
    phoneNumber: optionalText(body.phoneNumber, 20),
    address: optionalText(body.address, 300),
    healthInsuranceNumber: optionalText(body.healthInsuranceNumber, 30),
    createdBy: subject,
    createdAt: now,
    updatedAt: now,
  };

  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: item,
      ConditionExpression:
        'attribute_not_exists(pk) AND attribute_not_exists(sk)',
    }),
  );

  return json(201, item);
};

const readPatient = async (event) => {
  requireAnyGroup(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const patientId = routeParameter(event, 'patientId');
  const patient = await getPatient(patientId);

  if (!patient) {
    throw new ApiError(404, 'Patient not found');
  }

  return json(200, patient);
};

const createMedicalRecord = async (event) => {
  requireAnyGroup(event, ['BACSI']);
  const subject = getSubject(event);
  const patientId = routeParameter(event, 'patientId');
  await ensurePatientExists(patientId);

  const body = parseJsonBody(event.body);
  const diagnosis = cleanText(body.diagnosis, 'diagnosis', 500);
  const recordId = randomUUID();
  const now = new Date().toISOString();

  const item = {
    pk: `PATIENT#${patientId}`,
    sk: `RECORD#${now}#${recordId}`,
    entityType: 'MEDICAL_RECORD',
    patientId,
    recordId,
    diagnosis,
    symptoms: optionalText(body.symptoms, 1000),
    medicalHistory: optionalText(body.medicalHistory, 2000),
    note: optionalText(body.note, 2000),
    createdBy: subject,
    createdAt: now,
  };

  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: item,
      ConditionExpression:
        'attribute_not_exists(pk) AND attribute_not_exists(sk)',
    }),
  );

  return json(201, item);
};

const listMedicalRecords = async (event) => {
  requireAnyGroup(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const patientId = routeParameter(event, 'patientId');
  await ensurePatientExists(patientId);

  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression:
        'pk = :pk AND begins_with(sk, :recordPrefix)',
      ExpressionAttributeValues: {
        ':pk': `PATIENT#${patientId}`,
        ':recordPrefix': 'RECORD#',
      },
      ScanIndexForward: false,
      Limit: 50,
    }),
  );

  return json(200, {
    patientId,
    items: result.Items || [],
    count: result.Count || 0,
  });
};

const createUploadUrl = async (event) => {
  requireAnyGroup(event, ['BACSI', 'NHANSU']);
  const subject = getSubject(event);
  const body = parseJsonBody(event.body);

  const patientId = cleanText(body.patientId, 'patientId', 100);
  await ensurePatientExists(patientId);

  const fileName = safeFileName(body.fileName);
  const contentType = cleanText(body.contentType, 'contentType', 100);
  const fileSize = Number(body.fileSize);

  if (!allowedContentTypes.has(contentType)) {
    throw new ApiError(400, 'Only PDF, JPEG and PNG files are allowed');
  }

  if (
    !Number.isInteger(fileSize) ||
    fileSize <= 0 ||
    fileSize > maxFileSizeBytes
  ) {
    throw new ApiError(
      400,
      `fileSize must be an integer between 1 and ${maxFileSizeBytes}`,
    );
  }

  const documentId = randomUUID();
  const now = new Date().toISOString();
  const key = `patients/${patientId}/documents/${documentId}/${fileName}`;
  const patientDocumentSk = `DOCUMENT#${now}#${documentId}`;

  const directItem = {
    pk: `DOCUMENT#${documentId}`,
    sk: 'METADATA',
    entityType: 'MEDICAL_DOCUMENT',
    documentId,
    patientId,
    patientDocumentSk,
    uploadedBy: subject,
    key,
    fileName,
    contentType,
    expectedFileSize: fileSize,
    status: 'PENDING_UPLOAD',
    createdAt: now,
    updatedAt: now,
  };

  const patientItem = {
    ...directItem,
    pk: `PATIENT#${patientId}`,
    sk: patientDocumentSk,
  };

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 300 },
  );

  await ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: tableName,
            Item: directItem,
            ConditionExpression:
              'attribute_not_exists(pk) AND attribute_not_exists(sk)',
          },
        },
        {
          Put: {
            TableName: tableName,
            Item: patientItem,
            ConditionExpression:
              'attribute_not_exists(pk) AND attribute_not_exists(sk)',
          },
        },
      ],
    }),
  );

  return json(201, {
    documentId,
    uploadUrl,
    expiresInSeconds: 300,
    requiredHeaders: {
      'Content-Type': contentType,
    },
  });
};

const completeUpload = async (event) => {
  requireAnyGroup(event, ['BACSI', 'NHANSU']);
  const body = parseJsonBody(event.body);
  const documentId = cleanText(body.documentId, 'documentId', 100);

  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `DOCUMENT#${documentId}`,
        sk: 'METADATA',
      },
      ConsistentRead: true,
    }),
  );

  const document = result.Item;
  if (!document) {
    throw new ApiError(404, 'Document not found');
  }

  let head;
  try {
    head = await s3.send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: document.key,
      }),
    );
  } catch {
    throw new ApiError(409, 'The file has not been uploaded to S3 yet');
  }

  const actualFileSize = Number(head.ContentLength || 0);
  if (head.ContentType && head.ContentType !== document.contentType) {
    throw new ApiError(409, 'Uploaded content type does not match the request');
  }

  if (actualFileSize <= 0 || actualFileSize > maxFileSizeBytes) {
    throw new ApiError(400, 'Uploaded file size is invalid');
  }

  if (
    document.expectedFileSize &&
    actualFileSize !== Number(document.expectedFileSize)
  ) {
    throw new ApiError(409, 'Uploaded file size does not match the request');
  }

  const now = new Date().toISOString();
  const updateExpression =
    'SET #status = :available, actualFileSize = :actualFileSize, etag = :etag, updatedAt = :updatedAt';
  const expressionAttributeNames = {
    '#status': 'status',
  };
  const expressionAttributeValues = {
    ':available': 'AVAILABLE',
    ':actualFileSize': actualFileSize,
    ':etag': head.ETag || null,
    ':updatedAt': now,
  };

  await Promise.all([
    ddb.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          pk: `DOCUMENT#${documentId}`,
          sk: 'METADATA',
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      }),
    ),
    ddb.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          pk: `PATIENT#${document.patientId}`,
          sk: document.patientDocumentSk,
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      }),
    ),
  ]);

  return json(200, {
    documentId,
    status: 'AVAILABLE',
    actualFileSize,
  });
};

const createDownloadUrl = async (event) => {
  requireAnyGroup(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const documentId = queryParameter(event, 'documentId');

  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `DOCUMENT#${documentId}`,
        sk: 'METADATA',
      },
      ConsistentRead: true,
    }),
  );

  const document = result.Item;
  if (!document) {
    throw new ApiError(404, 'Document not found');
  }

  if (document.status !== 'AVAILABLE') {
    throw new ApiError(409, 'Document upload is not complete');
  }

  const downloadUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucketName,
      Key: document.key,
      ResponseContentDisposition: `attachment; filename="${safeFileName(
        document.fileName || 'medical-document',
      )}"`,
    }),
    { expiresIn: 300 },
  );

  return json(200, {
    documentId,
    fileName: document.fileName,
    contentType: document.contentType,
    downloadUrl,
    expiresInSeconds: 300,
  });
};

exports.handler = async (event) => {
  try {
    requireEnvironment();

    switch (event.routeKey) {
      case 'POST /api/patients':
        return await createPatient(event);
      case 'GET /api/patients/{patientId}':
        return await readPatient(event);
      case 'POST /api/patients/{patientId}/records':
        return await createMedicalRecord(event);
      case 'GET /api/patients/{patientId}/records':
        return await listMedicalRecords(event);
      case 'POST /api/medical/upload-url':
        return await createUploadUrl(event);
      case 'POST /api/medical/complete-upload':
        return await completeUpload(event);
      case 'GET /api/medical/download-url':
        return await createDownloadUrl(event);
      default:
        return json(404, { message: 'Route not found' });
    }
  } catch (error) {
    return handleError(error, 'Medical API request failed');
  }
};
