'use strict';

const { randomUUID } = require('crypto');
const {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} = require('@aws-sdk/client-s3');
const {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const {
  ApiError,
  getRouteKey,
  handleError,
  parseJsonBody,
  queryParameter,
  requestId,
  routeParameter,
  success,
} = require('../shared/http');
const { getCurrentUser, hasGroup, requireGroups } = require('../shared/auth');
const {
  dateOnly,
  optionalString,
  requiredString,
} = require('../shared/validation');
const {
  chronologicalSk,
  directKey,
  documentClient,
  patientPk,
  patientProfileKey,
} = require('../shared/dynamodb');
const {
  createMedicalObjectKey,
  normalizeMedicineItems,
  normalizeVitals,
  safeFileName,
} = require('./domain');

const s3 = new S3Client({});
const tableName = process.env.TABLE_NAME;
const bucketName = process.env.MEDICAL_BUCKET_NAME;
const maxFileSizeBytes = Number(
  process.env.MAX_FILE_SIZE_BYTES || 10 * 1024 * 1024,
);
const presignedUrlTtlSeconds = Number(
  process.env.PRESIGNED_URL_TTL_SECONDS || 300,
);

const allowedContentTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

function requireEnvironment() {
  if (!tableName || !bucketName) {
    throw new Error(
      'Medical Lambda requires TABLE_NAME and MEDICAL_BUCKET_NAME',
    );
  }
}

async function getItem(key, consistentRead = true) {
  const response = await documentClient.send(
    new GetCommand({
      TableName: tableName,
      Key: key,
      ConsistentRead: consistentRead,
    }),
  );
  return response.Item || null;
}

async function getPatient(patientId) {
  return getItem(patientProfileKey(patientId));
}

async function ensurePatient(patientId) {
  const patient = await getPatient(patientId);
  if (!patient) {
    throw new ApiError(404, 'PATIENT_NOT_FOUND', 'Patient not found');
  }
  return patient;
}

async function ensureDirectEntity(entity, id, patientId) {
  const item = await getItem(directKey(entity, id));
  if (!item) {
    throw new ApiError(404, `${entity}_NOT_FOUND`, `${entity} not found`);
  }
  if (patientId && item.patientId !== patientId) {
    throw new ApiError(
      409,
      'PATIENT_RELATION_MISMATCH',
      `${entity} does not belong to this patient`,
    );
  }
  return item;
}

async function putPatientProjection({
  entity,
  id,
  patientId,
  prefix,
  createdAt,
  item,
}) {
  const patientSk = chronologicalSk(prefix, createdAt, id);
  const directItem = {
    ...item,
    ...directKey(entity, id),
    patientSk,
  };
  const patientItem = {
    ...directItem,
    pk: patientPk(patientId),
    sk: patientSk,
  };

  await documentClient.send(
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

  return patientItem;
}

async function queryPatientItems(patientId, prefix, limit = 100) {
  const response = await documentClient.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression:
        'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': patientPk(patientId),
        ':prefix': `${prefix}#`,
      },
      ScanIndexForward: false,
      Limit: Math.min(Math.max(Number(limit) || 100, 1), 100),
    }),
  );
  return response.Items || [];
}

async function createPatient(event) {
  const actor = requireGroups(event, ['ADMIN', 'NHANSU']);
  const body = parseJsonBody(event);
  const patientId = randomUUID();
  const now = new Date().toISOString();

  const item = {
    ...patientProfileKey(patientId),
    entityType: 'PATIENT',
    patientId,
    fullName: requiredString(body.fullName, 'fullName', {
      maxLength: 150,
    }),
    dateOfBirth: dateOnly(body.dateOfBirth, 'dateOfBirth'),
    gender: requiredString(body.gender, 'gender', {
      maxLength: 10,
    }).toUpperCase(),
    phoneNumber: optionalString(body.phoneNumber, 'phoneNumber', {
      maxLength: 20,
    }),
    address: optionalString(body.address, 'address', { maxLength: 300 }),
    healthInsuranceNumber: optionalString(
      body.healthInsuranceNumber,
      'healthInsuranceNumber',
      { maxLength: 30 },
    ),
    status: 'ACTIVE',
    createdBy: actor.sub,
    createdAt: now,
    updatedAt: now,
  };

  if (!['NAM', 'NU', 'KHAC'].includes(item.gender)) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'gender must be NAM, NU or KHAC',
    );
  }

  await documentClient.send(
    new PutCommand({
      TableName: tableName,
      Item: item,
      ConditionExpression:
        'attribute_not_exists(pk) AND attribute_not_exists(sk)',
    }),
  );

  return success(item, 201);
}

async function readPatient(event) {
  const patientId = routeParameter(event, 'patientId');
  await requirePatientScope(event, patientId);
  return success(await ensurePatient(patientId));
}

async function updatePatient(event) {
  const actor = requireGroups(event, ['ADMIN', 'NHANSU', 'BENHNHAN']);
  const currentUser = getCurrentUser(event);
  const patientId = routeParameter(event, 'patientId');
  const patient = await ensurePatient(patientId);

  if (hasGroup(actor, 'BENHNHAN')) {
    const userProfiles = await scanEntityTypes(['USER']);
    const actorEmail = String(currentUser.email || '').trim().toLowerCase();
    const appUser = userProfiles.find((item) =>
      item.cognitoSub === currentUser.sub ||
      item.cognitoUsername === currentUser.username ||
      (actorEmail && String(item.email || '').trim().toLowerCase() === actorEmail),
    );

    const ownsProfile = [
      currentUser.sub,
      currentUser.username,
      appUser?.userId,
    ].filter(Boolean).includes(patient.accountUserId) ||
      patient.cognitoSub === currentUser.sub ||
      patient.cognitoUsername === currentUser.username ||
      appUser?.patientId === patientId;

    if (!ownsProfile) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'Bạn không có quyền cập nhật hồ sơ bệnh nhân này',
      );
    }
  }

  const body = parseJsonBody(event);
  const genderInput = body.gender ?? body.gioiTinh;
  const genderMap = {
    NAM: 'NAM',
    Nam: 'NAM',
    nam: 'NAM',
    NU: 'NU',
    Nữ: 'NU',
    NỮ: 'NU',
    nữ: 'NU',
    KHAC: 'KHAC',
    Khác: 'KHAC',
    khác: 'KHAC',
  };

  const updates = {};
  if (body.fullName !== undefined || body.hoTen !== undefined) {
    updates.fullName = requiredString(
      body.fullName ?? body.hoTen,
      'fullName',
      { maxLength: 150 },
    );
  }
  if (body.dateOfBirth !== undefined || body.ngaySinh !== undefined) {
    const dateValue = body.dateOfBirth ?? body.ngaySinh;
    updates.dateOfBirth = dateValue
      ? dateOnly(dateValue, 'dateOfBirth')
      : null;
  }
  if (genderInput !== undefined) {
    const normalizedGender = genderMap[genderInput] ||
      genderMap[String(genderInput).trim()] ||
      String(genderInput).trim().toUpperCase();
    if (!['NAM', 'NU', 'KHAC'].includes(normalizedGender)) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'gender must be NAM, NU or KHAC',
      );
    }
    updates.gender = normalizedGender;
  }
  if (body.phoneNumber !== undefined || body.soDienThoai !== undefined) {
    updates.phoneNumber = optionalString(
      body.phoneNumber ?? body.soDienThoai,
      'phoneNumber',
      { maxLength: 20 },
    );
  }
  if (body.address !== undefined || body.diaChi !== undefined) {
    updates.address = optionalString(
      body.address ?? body.diaChi,
      'address',
      { maxLength: 300 },
    );
  }
  if (
    body.healthInsuranceNumber !== undefined ||
    body.bhyt !== undefined
  ) {
    updates.healthInsuranceNumber = optionalString(
      body.healthInsuranceNumber ?? body.bhyt,
      'healthInsuranceNumber',
      { maxLength: 30 },
    );
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Không có trường hợp lệ để cập nhật',
    );
  }

  updates.updatedAt = new Date().toISOString();
  updates.updatedBy = currentUser.sub;

  const expressionNames = {};
  const expressionValues = {};
  const assignments = [];

  Object.entries(updates).forEach(([key, value], index) => {
    const name = `#field${index}`;
    const placeholder = `:value${index}`;
    expressionNames[name] = key;
    expressionValues[placeholder] = value;
    assignments.push(`${name} = ${placeholder}`);
  });

  const response = await documentClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: patientProfileKey(patientId),
      UpdateExpression: `SET ${assignments.join(', ')}`,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
      ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)',
      ReturnValues: 'ALL_NEW',
    }),
  );

  return success(toLegacyPatient(response.Attributes || {
    ...patient,
    ...updates,
  }));
}

async function createMedicalRecord(event) {
  const actor = requireGroups(event, ['BACSI']);
  const patientId = routeParameter(event, 'patientId');
  await ensurePatient(patientId);

  const body = parseJsonBody(event);
  const recordId = randomUUID();
  const now = new Date().toISOString();
  const item = {
    entityType: 'MEDICAL_RECORD',
    recordId,
    patientId,
    doctorId: actor.sub,
    symptoms: optionalString(body.symptoms, 'symptoms', {
      maxLength: 1500,
    }),
    diagnosis: requiredString(body.diagnosis, 'diagnosis', {
      maxLength: 1000,
    }),
    treatment: optionalString(body.treatment, 'treatment', {
      maxLength: 2000,
    }),
    medicalHistory: optionalString(body.medicalHistory, 'medicalHistory', {
      maxLength: 3000,
    }),
    note: optionalString(body.note, 'note', { maxLength: 2000 }),
    examinationId: optionalString(body.examinationId, 'examinationId', {
      maxLength: 100,
    }),
    prescriptionId: optionalString(body.prescriptionId, 'prescriptionId', {
      maxLength: 100,
    }),
    createdBy: actor.sub,
    createdAt: now,
    updatedAt: now,
  };

  const created = await putPatientProjection({
    entity: 'RECORD',
    id: recordId,
    patientId,
    prefix: 'RECORD',
    createdAt: now,
    item,
  });

  return success(created, 201);
}

async function listMedicalRecords(event) {
  const patientId = routeParameter(event, 'patientId');
  await requirePatientScope(event, patientId);
  await ensurePatient(patientId);
  const items = await queryPatientItems(patientId, 'RECORD');
  return success({ patientId, items, count: items.length });
}

async function createExamination(event) {
  const actor = requireGroups(event, ['BACSI', 'NHANSU']);
  const patientId = routeParameter(event, 'patientId');
  await ensurePatient(patientId);

  const body = parseJsonBody(event);
  const examinationId = randomUUID();
  const now = new Date().toISOString();
  const doctorOnlyFieldsPresent = Boolean(body.diagnosis || body.treatment);

  if (doctorOnlyFieldsPresent && !hasGroup(actor, 'BACSI')) {
    throw new ApiError(
      403,
      'DOCTOR_FIELDS_FORBIDDEN',
      'Only BACSI can enter diagnosis or treatment',
    );
  }

  const item = {
    entityType: 'EXAMINATION',
    examinationId,
    patientId,
    actorId: actor.sub,
    actorGroups: actor.groups,
    vitals: normalizeVitals(body.vitals || {}),
    symptoms: optionalString(body.symptoms, 'symptoms', {
      maxLength: 1500,
    }),
    diagnosis: optionalString(body.diagnosis, 'diagnosis', {
      maxLength: 1000,
    }),
    treatment: optionalString(body.treatment, 'treatment', {
      maxLength: 2000,
    }),
    advice: optionalString(body.advice, 'advice', { maxLength: 1500 }),
    status: body.diagnosis ? 'COMPLETED' : 'VITALS_RECORDED',
    createdBy: actor.sub,
    createdAt: now,
    updatedAt: now,
  };

  const created = await putPatientProjection({
    entity: 'EXAMINATION',
    id: examinationId,
    patientId,
    prefix: 'EXAM',
    createdAt: now,
    item,
  });

  return success(created, 201);
}

async function listExaminations(event) {
  const patientId = routeParameter(event, 'patientId');
  await requirePatientScope(event, patientId);
  await ensurePatient(patientId);
  const items = await queryPatientItems(patientId, 'EXAM');
  return success({ patientId, items, count: items.length });
}

async function createPrescription(event) {
  const actor = requireGroups(event, ['BACSI']);
  const patientId = routeParameter(event, 'patientId');
  await ensurePatient(patientId);

  const body = parseJsonBody(event);
  if (body.recordId) {
    await ensureDirectEntity('RECORD', body.recordId, patientId);
  }

  const prescriptionId = randomUUID();
  const now = new Date().toISOString();
  const item = {
    entityType: 'PRESCRIPTION',
    prescriptionId,
    patientId,
    doctorId: actor.sub,
    recordId: optionalString(body.recordId, 'recordId', { maxLength: 100 }),
    medicineItems: normalizeMedicineItems(body.medicineItems),
    generalInstructions: optionalString(
      body.generalInstructions,
      'generalInstructions',
      { maxLength: 1500 },
    ),
    status: 'ACTIVE',
    createdBy: actor.sub,
    createdAt: now,
    updatedAt: now,
  };

  const created = await putPatientProjection({
    entity: 'PRESCRIPTION',
    id: prescriptionId,
    patientId,
    prefix: 'PRESCRIPTION',
    createdAt: now,
    item,
  });

  return success(created, 201);
}

async function listPrescriptions(event) {
  const patientId = routeParameter(event, 'patientId');
  await requirePatientScope(event, patientId);
  await ensurePatient(patientId);
  const items = await queryPatientItems(patientId, 'PRESCRIPTION');
  return success({ patientId, items, count: items.length });
}

async function createUploadUrl(event) {
  const actor = requireGroups(event, ['BACSI', 'NHANSU']);
  const body = parseJsonBody(event);
  const patientId = requiredString(body.patientId, 'patientId', {
    maxLength: 100,
  });
  await ensurePatient(patientId);

  const fileName = safeFileName(body.fileName);
  const contentType = requiredString(body.contentType, 'contentType', {
    maxLength: 100,
  }).toLowerCase();
  const fileSize = Number(body.fileSize);

  if (!allowedContentTypes.has(contentType)) {
    throw new ApiError(
      400,
      'UNSUPPORTED_FILE_TYPE',
      'Only PDF, JPEG and PNG files are allowed',
    );
  }
  if (
    !Number.isInteger(fileSize) ||
    fileSize <= 0 ||
    fileSize > maxFileSizeBytes
  ) {
    throw new ApiError(
      400,
      'INVALID_FILE_SIZE',
      `fileSize must be between 1 and ${maxFileSizeBytes} bytes`,
    );
  }

  const documentId = randomUUID();
  const now = new Date().toISOString();
  const key = createMedicalObjectKey(patientId, documentId, fileName);
  const patientSk = chronologicalSk('DOCUMENT', now, documentId);
  const item = {
    entityType: 'MEDICAL_DOCUMENT',
    documentId,
    patientId,
    fileName,
    contentType,
    expectedFileSize: fileSize,
    key,
    status: 'PENDING_UPLOAD',
    uploadedBy: actor.sub,
    createdAt: now,
    updatedAt: now,
  };

  await putPatientProjection({
    entity: 'DOCUMENT',
    id: documentId,
    patientId,
    prefix: 'DOCUMENT',
    createdAt: now,
    item,
  });

  const metadata = {
    documentid: documentId,
    patientid: patientId,
  };
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
      Metadata: metadata,
    }),
    { expiresIn: presignedUrlTtlSeconds },
  );

  return success(
    {
      documentId,
      objectKey: key,
      uploadUrl,
      expiresInSeconds: presignedUrlTtlSeconds,
      requiredHeaders: {
        'Content-Type': contentType,
        'x-amz-meta-documentid': documentId,
        'x-amz-meta-patientid': patientId,
      },
      status: 'PENDING_UPLOAD',
      patientSk,
    },
    201,
  );
}

async function rejectUploadedDocument(document, reason) {
  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: document.key,
      }),
    );
  } catch (error) {
    console.error('Unable to remove rejected medical object', {
      documentId: document.documentId,
      message: error.message,
    });
  }

  const values = {
    ':status': 'REJECTED',
    ':reason': reason,
    ':updatedAt': new Date().toISOString(),
  };
  const update = {
    TableName: tableName,
    UpdateExpression:
      'SET #status = :status, rejectionReason = :reason, updatedAt = :updatedAt',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: values,
  };

  await Promise.all([
    documentClient.send(
      new UpdateCommand({
        ...update,
        Key: directKey('DOCUMENT', document.documentId),
      }),
    ),
    documentClient.send(
      new UpdateCommand({
        ...update,
        Key: {
          pk: patientPk(document.patientId),
          sk: document.patientSk,
        },
      }),
    ),
  ]);
}

async function completeUpload(event) {
  const actor = requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const body = parseJsonBody(event);
  const documentId = requiredString(body.documentId, 'documentId', {
    maxLength: 100,
  });
  const document = await ensureDirectEntity('DOCUMENT', documentId);

  if (document.uploadedBy !== actor.sub && !hasGroup(actor, 'ADMIN')) {
    throw new ApiError(
      403,
      'UPLOAD_OWNER_MISMATCH',
      'Only the uploader or ADMIN can complete this upload',
    );
  }
  if (document.status === 'AVAILABLE') {
    return success({
      documentId,
      status: document.status,
      actualFileSize: document.actualFileSize,
    });
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
    throw new ApiError(
      409,
      'OBJECT_NOT_UPLOADED',
      'The file has not been uploaded to S3 yet',
    );
  }

  const actualFileSize = Number(head.ContentLength || 0);
  const invalidReason =
    actualFileSize <= 0 || actualFileSize > maxFileSizeBytes
      ? 'Uploaded file size is invalid'
      : document.expectedFileSize &&
          actualFileSize !== Number(document.expectedFileSize)
        ? 'Uploaded file size does not match the request'
        : head.ContentType && head.ContentType !== document.contentType
          ? 'Uploaded content type does not match the request'
          : head.Metadata?.documentid !== documentId ||
              head.Metadata?.patientid !== document.patientId
            ? 'Uploaded metadata does not match the request'
            : null;

  if (invalidReason) {
    await rejectUploadedDocument(document, invalidReason);
    throw new ApiError(409, 'UPLOAD_VALIDATION_FAILED', invalidReason);
  }

  const now = new Date().toISOString();
  const update = {
    TableName: tableName,
    UpdateExpression:
      'SET #status = :status, actualFileSize = :size, etag = :etag, updatedAt = :updatedAt REMOVE rejectionReason',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': 'AVAILABLE',
      ':size': actualFileSize,
      ':etag': head.ETag || null,
      ':updatedAt': now,
    },
  };

  await Promise.all([
    documentClient.send(
      new UpdateCommand({
        ...update,
        Key: directKey('DOCUMENT', documentId),
      }),
    ),
    documentClient.send(
      new UpdateCommand({
        ...update,
        Key: {
          pk: patientPk(document.patientId),
          sk: document.patientSk,
        },
      }),
    ),
  ]);

  return success({ documentId, status: 'AVAILABLE', actualFileSize });
}

async function createDownloadUrl(event) {
  const documentId = queryParameter(event, 'documentId');
  const document = await ensureDirectEntity('DOCUMENT', documentId);
  await requirePatientScope(event, document.patientId);

  if (document.status !== 'AVAILABLE') {
    throw new ApiError(
      409,
      'DOCUMENT_NOT_AVAILABLE',
      'Document upload is not complete',
    );
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
    { expiresIn: presignedUrlTtlSeconds },
  );

  return success({
    documentId,
    patientId: document.patientId,
    fileName: document.fileName,
    contentType: document.contentType,
    downloadUrl,
    expiresInSeconds: presignedUrlTtlSeconds,
  });
}

async function listDocuments(event) {
  const patientId = routeParameter(event, 'patientId');
  await requirePatientScope(event, patientId);
  await ensurePatient(patientId);
  const items = await queryPatientItems(patientId, 'DOCUMENT');
  return success({ patientId, items, count: items.length });
}


/*
 * =========================================================
 * READ-ONLY COMPATIBILITY API FOR THE EXISTING REACT UI
 * =========================================================
 *
 * The current frontend was originally written for REST resources such as
 * /benhnhan, /bacsi, /khoa, /lichkham and /thuoc. The Week 1 AWS backend uses
 * a single DynamoDB table and English resource names. These helpers expose
 * read-only compatibility routes so the existing pages can render the data
 * already seeded in DynamoDB without changing every React page at once.
 *
 * Scan is acceptable for the small Week 1 demonstration dataset. Replace it
 * with GSIs and Query operations before using this pattern at production scale.
 */
async function scanEntityTypes(entityTypes = []) {
  if (!Array.isArray(entityTypes) || entityTypes.length === 0) {
    return [];
  }

  const expressionAttributeValues = {};
  const placeholders = entityTypes.map((entityType, index) => {
    const placeholder = `:entityType${index}`;
    expressionAttributeValues[placeholder] = entityType;
    return placeholder;
  });

  const items = [];
  let exclusiveStartKey;

  do {
    const response = await documentClient.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: exclusiveStartKey,
        FilterExpression: `#entityType IN (${placeholders.join(', ')})`,
        ExpressionAttributeNames: {
          '#entityType': 'entityType',
        },
        ExpressionAttributeValues: expressionAttributeValues,
      }),
    );

    items.push(...(response.Items || []));
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
}

function normalizeIdentity(value) {
  return String(value || '').trim().toLowerCase();
}

async function applicationUserForEvent(event) {
  const current = getCurrentUser(event);
  const users = await scanEntityTypes(['USER']);
  const email = normalizeIdentity(current.email);
  const username = normalizeIdentity(current.username);

  return users.find((item) =>
    (current.sub && (
      item.cognitoSub === current.sub ||
      item.userId === current.sub
    )) ||
    (username && normalizeIdentity(item.cognitoUsername) === username) ||
    (email && normalizeIdentity(item.email) === email),
  ) || null;
}

async function patientIdForEvent(event) {
  const current = getCurrentUser(event);
  if (!hasGroup(current, 'BENHNHAN')) {
    return null;
  }

  const appUser = await applicationUserForEvent(event);
  if (appUser?.patientId) {
    return appUser.patientId;
  }

  const patients = await scanEntityTypes(['PATIENT']);
  const email = normalizeIdentity(current.email);
  const username = normalizeIdentity(current.username);
  const patient = patients.find((item) =>
    item.cognitoSub === current.sub ||
    normalizeIdentity(item.cognitoUsername) === username ||
    (email && normalizeIdentity(item.email) === email) ||
    item.accountUserId === appUser?.userId,
  );

  return patient?.patientId || null;
}

async function requirePatientScope(
  event,
  patientId,
  allowedGroups = ['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN'],
) {
  const actor = requireGroups(event, allowedGroups);
  if (!hasGroup(actor, 'BENHNHAN')) {
    return actor;
  }

  const ownPatientId = await patientIdForEvent(event);
  if (!ownPatientId || ownPatientId !== patientId) {
    throw new ApiError(
      403,
      'PATIENT_SCOPE_FORBIDDEN',
      'Bạn chỉ được truy cập dữ liệu bệnh nhân của chính mình',
    );
  }

  return actor;
}

function uniqueBy(items, selector) {
  const seen = new Set();
  const result = [];

  for (const item of items || []) {
    const key = selector(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

const normalizeStatus = (status) => String(status || 'ACTIVE').toUpperCase();

function toLegacyPatient(item) {
  return {
    maBN: item.patientId,
    patientId: item.patientId,
    hoTen: item.fullName,
    fullName: item.fullName,
    ngaySinh: item.dateOfBirth || null,
    dateOfBirth: item.dateOfBirth || null,
    gioiTinh: item.gender || null,
    gender: item.gender || null,
    soDienThoai: item.phoneNumber || null,
    phoneNumber: item.phoneNumber || null,
    diaChi: item.address || null,
    address: item.address || null,
    bhyt: item.healthInsuranceNumber || null,
    healthInsuranceNumber: item.healthInsuranceNumber || null,
    trangThai: normalizeStatus(item.status),
    status: normalizeStatus(item.status),
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

function toLegacyDepartment(item) {
  return {
    maKhoa: item.departmentId,
    departmentId: item.departmentId,
    tenKhoa: item.departmentName,
    departmentName: item.departmentName,
    moTa: item.description || '',
    description: item.description || '',
    trangThai: normalizeStatus(item.status),
  };
}

function toLegacyDoctor(item, departmentMap = new Map()) {
  const department = departmentMap.get(item.departmentId);
  return {
    maBS: item.doctorId || item.staffId,
    doctorId: item.doctorId || item.staffId,
    maTK: item.accountUserId || null,
    hoTen: item.fullName,
    fullName: item.fullName,
    chuyenMon: item.specialty || '',
    specialty: item.specialty || '',
    maKhoa: item.departmentId || null,
    departmentId: item.departmentId || null,
    KhoaPhong: department ? toLegacyDepartment(department) : null,
    trangThai: normalizeStatus(item.status),
    status: normalizeStatus(item.status),
  };
}

function toLegacyStaff(item, departmentMap = new Map()) {
  const department = departmentMap.get(item.departmentId);
  const typeMap = {
    DIEU_DUONG: 'YT',
    Y_TA: 'YT',
    XET_NGHIEM: 'XN',
    TIEP_DON: 'TN',
    TIEP_NHAN: 'TN',
  };

  return {
    maNS: item.staffId,
    staffId: item.staffId,
    maTK: item.accountUserId || null,
    hoTen: item.fullName,
    fullName: item.fullName,
    loaiNS: typeMap[item.staffType] || item.staffType || 'TN',
    staffType: item.staffType || null,
    maKhoa: item.departmentId || null,
    departmentId: item.departmentId || null,
    KhoaPhong: department ? toLegacyDepartment(department) : null,
    trangThai: normalizeStatus(item.status),
    status: normalizeStatus(item.status),
  };
}

function toLegacyAppointment(item, doctorMap = new Map(), patientMap = new Map()) {
  const doctor = doctorMap.get(item.doctorId);
  const patient = patientMap.get(item.patientId);
  const ngayKham = item.appointmentDate || null;
  const gioKham = item.appointmentTime || null;

  return {
    maLich: item.appointmentId,
    appointmentId: item.appointmentId,
    maBN: item.patientId,
    patientId: item.patientId,
    maBS: item.doctorId,
    doctorId: item.doctorId,
    maKhoa: item.departmentId || null,
    maPhong: item.roomId || null,
    phong: item.roomId || null,
    ngayKham,
    appointmentDate: ngayKham,
    gioKham,
    appointmentTime: gioKham,
    ghiChu: item.note || '',
    note: item.note || '',
    soThuTu: item.queueNumber || null,
    queueNumber: item.queueNumber || null,
    trangThai: normalizeStatus(item.status),
    status: normalizeStatus(item.status),
    BacSi: doctor ? { maBS: doctor.doctorId || doctor.staffId, hoTen: doctor.fullName } : null,
    BenhNhan: patient ? { maBN: patient.patientId, hoTen: patient.fullName } : null,
    createdAt: item.createdAt || null,
  };
}

function toLegacyMedicalRecord(item) {
  return {
    maHSBA: item.recordId,
    recordId: item.recordId,
    maBN: item.patientId,
    patientId: item.patientId,
    maBS: item.doctorId || item.createdBy || null,
    doctorId: item.doctorId || item.createdBy || null,
    trieuChung: item.symptoms || '',
    symptoms: item.symptoms || '',
    chuanDoan: item.diagnosis || '',
    diagnosis: item.diagnosis || '',
    dieuTri: item.treatment || '',
    treatment: item.treatment || '',
    ghiChu: item.note || '',
    note: item.note || '',
    trangThai: normalizeStatus(item.status || 'OPEN'),
    ngayLap: item.createdAt || null,
    createdAt: item.createdAt || null,
  };
}

function toLegacyExamination(item) {
  return {
    maPK: item.examinationId,
    examinationId: item.examinationId,
    maBN: item.patientId,
    patientId: item.patientId,
    maBS: item.doctorId || item.actorId || null,
    doctorId: item.doctorId || item.actorId || null,
    trieuChung: item.symptoms || '',
    symptoms: item.symptoms || '',
    chuanDoan: item.diagnosis || '',
    diagnosis: item.diagnosis || '',
    dieuTri: item.treatment || '',
    treatment: item.treatment || '',
    loiDan: item.advice || '',
    advice: item.advice || '',
    sinhHieu: item.vitals || {},
    vitals: item.vitals || {},
    trangThai: normalizeStatus(item.status),
    ngayKham: item.createdAt || null,
    createdAt: item.createdAt || null,
  };
}

function toLegacyPrescription(item) {
  return {
    maDT: item.prescriptionId,
    prescriptionId: item.prescriptionId,
    maHSBA: item.recordId || null,
    recordId: item.recordId || null,
    maBN: item.patientId,
    patientId: item.patientId,
    maBS: item.doctorId || item.createdBy || null,
    doctorId: item.doctorId || item.createdBy || null,
    chiTiet: item.medicineItems || [],
    medicineItems: item.medicineItems || [],
    loiDan: item.generalInstructions || '',
    generalInstructions: item.generalInstructions || '',
    trangThai: normalizeStatus(item.status),
    ngayKeDon: item.createdAt || null,
    createdAt: item.createdAt || null,
  };
}

function toLegacyLabResult(item) {
  return {
    maPhieuXN: item.labResultId,
    labResultId: item.labResultId,
    maBN: item.patientId,
    patientId: item.patientId,
    maHSBA: item.recordId || null,
    recordId: item.recordId || null,
    ngayThucHien: item.performedAt || item.createdAt || null,
    performedAt: item.performedAt || item.createdAt || null,
    ketQua: item.resultText || '',
    resultText: item.resultText || '',
    khoangThamChieu: item.referenceRange || '',
    referenceRange: item.referenceRange || '',
    donVi: item.unit || '',
    unit: item.unit || '',
    trangThai: normalizeStatus(item.status || 'COMPLETED'),
    status: normalizeStatus(item.status || 'COMPLETED'),
    XetNghiem: {
      maXN: item.testId || item.labResultId,
      tenXN: item.testName || 'Xét nghiệm',
      LoaiXetNghiem: {
        maLoaiXN: item.categoryId || null,
        tenLoai: item.categoryName || 'Tổng quát',
      },
    },
    NhanSuYTe: {
      maNS: item.staffId || null,
      hoTen: item.staffName || 'Kỹ thuật viên',
    },
    YeuCau: {
      maBN: item.patientId,
    },
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

function toLegacyMedicine(item) {
  return {
    maThuoc: item.medicineId,
    medicineId: item.medicineId,
    tenThuoc: item.medicineName,
    medicineName: item.medicineName,
    donViTinh: item.unit || 'VIEN',
    unit: item.unit || 'VIEN',
    trangThai: normalizeStatus(item.status),
    status: normalizeStatus(item.status),
  };
}

function toLegacySchedule(item) {
  return {
    maLichLV: item.scheduleId,
    scheduleId: item.scheduleId,
    maBS: item.staffId,
    maNS: item.staffId,
    staffId: item.staffId,
    maKhoa: item.departmentId || null,
    maPhong: item.roomId || null,
    ngayLamViec: item.workDate,
    workDate: item.workDate,
    maCa: item.shiftId,
    shiftId: item.shiftId,
    gioBatDau: item.startTime,
    startTime: item.startTime,
    gioKetThuc: item.endTime,
    endTime: item.endTime,
    trangThai: normalizeStatus(item.status),
  };
}

async function legacyListPatients(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const patients = uniqueBy(await scanEntityTypes(['PATIENT']), (item) => item.patientId);
  return success(patients.map(toLegacyPatient));
}

async function legacyReadPatient(event) {
  const patientId = routeParameter(event, 'patientId');
  await requirePatientScope(event, patientId);
  const patient = await getPatient(patientId);
  if (!patient) throw new ApiError(404, 'PATIENT_NOT_FOUND', 'Patient not found');
  return success(toLegacyPatient(patient));
}

async function legacyPatientByAccount(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN']);
  const maTK = routeParameter(event, 'maTK');
  const fallbackId = maTK === 'USER004' ? 'BN001' : maTK;
  const patients = uniqueBy(await scanEntityTypes(['PATIENT']), (item) => item.patientId);
  const patient = patients.find(
    (item) => item.accountUserId === maTK || item.patientId === fallbackId,
  );
  if (!patient) throw new ApiError(404, 'PATIENT_NOT_FOUND', 'Patient not found');
  return success(toLegacyPatient(patient));
}

async function legacyListDepartments(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN']);
  const departments = uniqueBy(
    await scanEntityTypes(['DEPARTMENT']),
    (item) => item.departmentId,
  );
  return success(departments.map(toLegacyDepartment));
}

async function legacyListDoctors(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN']);
  const [doctors, departments] = await Promise.all([
    scanEntityTypes(['DOCTOR']),
    scanEntityTypes(['DEPARTMENT']),
  ]);
  const departmentMap = new Map(
    uniqueBy(departments, (item) => item.departmentId).map((item) => [
      item.departmentId,
      item,
    ]),
  );
  return success(
    uniqueBy(doctors, (item) => item.doctorId || item.staffId).map((item) =>
      toLegacyDoctor(item, departmentMap),
    ),
  );
}

async function legacyDoctorByAccount(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const maTK = routeParameter(event, 'maTK');
  const fallbackId = maTK === 'USER002' ? 'BS001' : maTK;
  const [doctors, departments] = await Promise.all([
    scanEntityTypes(['DOCTOR']),
    scanEntityTypes(['DEPARTMENT']),
  ]);
  const departmentMap = new Map(
    uniqueBy(departments, (item) => item.departmentId).map((item) => [
      item.departmentId,
      item,
    ]),
  );
  const doctor = uniqueBy(doctors, (item) => item.doctorId || item.staffId).find(
    (item) =>
      item.accountUserId === maTK ||
      item.doctorId === fallbackId ||
      item.staffId === fallbackId,
  );
  if (!doctor) throw new ApiError(404, 'DOCTOR_NOT_FOUND', 'Doctor not found');
  return success(toLegacyDoctor(doctor, departmentMap));
}

async function legacyListStaff(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const [staff, departments] = await Promise.all([
    scanEntityTypes(['STAFF']),
    scanEntityTypes(['DEPARTMENT']),
  ]);
  const departmentMap = new Map(
    uniqueBy(departments, (item) => item.departmentId).map((item) => [
      item.departmentId,
      item,
    ]),
  );
  return success(
    uniqueBy(staff, (item) => item.staffId).map((item) =>
      toLegacyStaff(item, departmentMap),
    ),
  );
}

async function legacyStaffByAccount(event) {
  requireGroups(event, ['ADMIN', 'NHANSU']);
  const maTK = routeParameter(event, 'maTK');
  const fallbackId = maTK === 'USER003' ? 'NS001' : maTK;
  const [staff, departments] = await Promise.all([
    scanEntityTypes(['STAFF']),
    scanEntityTypes(['DEPARTMENT']),
  ]);
  const departmentMap = new Map(
    uniqueBy(departments, (item) => item.departmentId).map((item) => [
      item.departmentId,
      item,
    ]),
  );
  const employee = uniqueBy(staff, (item) => item.staffId).find(
    (item) => item.accountUserId === maTK || item.staffId === fallbackId,
  );
  if (!employee) throw new ApiError(404, 'STAFF_NOT_FOUND', 'Staff not found');
  return success(toLegacyStaff(employee, departmentMap));
}

function appointmentTime(value) {
  const result = requiredString(value, 'gioKham', { maxLength: 5 });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(result)) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'gioKham phải có định dạng HH:mm',
    );
  }
  return result;
}

async function appointmentMaps() {
  const [doctors, patients] = await Promise.all([
    scanEntityTypes(['DOCTOR']),
    scanEntityTypes(['PATIENT']),
  ]);

  return {
    doctorMap: new Map(
      uniqueBy(doctors, (item) => item.doctorId || item.staffId).map((item) => [
        item.doctorId || item.staffId,
        item,
      ]),
    ),
    patientMap: new Map(
      uniqueBy(patients, (item) => item.patientId).map((item) => [
        item.patientId,
        item,
      ]),
    ),
  };
}

async function legacyCreateAppointment(event) {
  const body = parseJsonBody(event);
  const patientId = requiredString(
    body.maBN ?? body.patientId,
    'maBN',
    { maxLength: 100 },
  );
  const actor = await requirePatientScope(event, patientId);
  await ensurePatient(patientId);

  const doctorId = requiredString(
    body.maBS ?? body.doctorId,
    'maBS',
    { maxLength: 100 },
  );
  const appointmentDate = dateOnly(
    body.ngayKham ?? body.appointmentDate,
    'ngayKham',
  );
  const time = appointmentTime(body.gioKham ?? body.appointmentTime);
  const departmentId = optionalString(
    body.maKhoa ?? body.departmentId ?? body.tenKhoa,
    'maKhoa',
    { maxLength: 100 },
  );
  const note = optionalString(body.ghiChu ?? body.note, 'ghiChu', {
    maxLength: 1000,
  });
  const roomId = optionalString(body.phong ?? body.roomId, 'phong', {
    maxLength: 100,
  });

  const appointmentAt = new Date(`${appointmentDate}T${time}:00+07:00`);
  if (Number.isNaN(appointmentAt.getTime())) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Ngày hoặc giờ khám không hợp lệ');
  }
  if (appointmentAt.getTime() <= Date.now()) {
    throw new ApiError(400, 'APPOINTMENT_IN_PAST', 'Lịch khám phải ở tương lai');
  }

  const [doctors, appointments] = await Promise.all([
    scanEntityTypes(['DOCTOR']),
    scanEntityTypes(['APPOINTMENT']),
  ]);
  const doctor = uniqueBy(
    doctors,
    (item) => item.doctorId || item.staffId,
  ).find((item) => (item.doctorId || item.staffId) === doctorId);

  if (!doctor) {
    throw new ApiError(404, 'DOCTOR_NOT_FOUND', 'Không tìm thấy bác sĩ');
  }

  const uniqueAppointments = uniqueBy(
    appointments,
    (item) => item.appointmentId,
  );
  const duplicate = uniqueAppointments.find((item) =>
    item.patientId === patientId &&
    item.appointmentDate === appointmentDate &&
    item.appointmentTime === time &&
    !['CANCELLED', 'COMPLETED'].includes(normalizeStatus(item.status)),
  );

  if (duplicate) {
    throw new ApiError(
      409,
      'APPOINTMENT_DUPLICATE',
      'Bạn đã có lịch khám ở thời điểm này',
    );
  }

  const sameSlot = uniqueAppointments.filter((item) =>
    item.doctorId === doctorId &&
    item.appointmentDate === appointmentDate &&
    item.appointmentTime === time &&
    normalizeStatus(item.status) !== 'CANCELLED',
  );

  const appointmentId = randomUUID();
  const now = new Date().toISOString();
  const item = {
    entityType: 'APPOINTMENT',
    appointmentId,
    patientId,
    doctorId,
    departmentId: departmentId || doctor.departmentId || null,
    roomId: roomId || null,
    appointmentDate,
    appointmentTime: time,
    queueNumber: sameSlot.length + 1,
    note: note || '',
    status: 'PENDING',
    createdBy: actor.sub,
    createdAt: now,
    updatedAt: now,
  };

  const created = await putPatientProjection({
    entity: 'APPOINTMENT',
    id: appointmentId,
    patientId,
    prefix: 'APPOINTMENT',
    createdAt: now,
    item,
  });

  const { doctorMap, patientMap } = await appointmentMaps();
  return success(toLegacyAppointment(created, doctorMap, patientMap), 201);
}

async function legacyReadAppointment(event) {
  const appointmentId = routeParameter(event, 'appointmentId');
  const appointment = await ensureDirectEntity('APPOINTMENT', appointmentId);
  await requirePatientScope(event, appointment.patientId);
  const { doctorMap, patientMap } = await appointmentMaps();
  return success(toLegacyAppointment(appointment, doctorMap, patientMap));
}

async function legacyCancelAppointment(event) {
  const appointmentId = routeParameter(event, 'appointmentId');
  const appointment = await ensureDirectEntity('APPOINTMENT', appointmentId);
  const actor = await requirePatientScope(event, appointment.patientId);
  const status = normalizeStatus(appointment.status);

  if (status === 'COMPLETED') {
    throw new ApiError(
      409,
      'APPOINTMENT_COMPLETED',
      'Không thể hủy lịch đã hoàn thành',
    );
  }

  if (status !== 'CANCELLED') {
    const now = new Date().toISOString();
    const update = {
      TableName: tableName,
      UpdateExpression:
        'SET #status = :status, cancelledBy = :cancelledBy, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'CANCELLED',
        ':cancelledBy': actor.sub,
        ':updatedAt': now,
      },
    };

    await Promise.all([
      documentClient.send(
        new UpdateCommand({
          ...update,
          Key: directKey('APPOINTMENT', appointmentId),
        }),
      ),
      appointment.patientSk
        ? documentClient.send(
            new UpdateCommand({
              ...update,
              Key: {
                pk: patientPk(appointment.patientId),
                sk: appointment.patientSk,
              },
            }),
          )
        : Promise.resolve(),
    ]);

    appointment.status = 'CANCELLED';
    appointment.updatedAt = now;
  }

  const { doctorMap, patientMap } = await appointmentMaps();
  return success(toLegacyAppointment(appointment, doctorMap, patientMap));
}

async function legacyListAppointments(event) {
  const actor = requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN']);
  const [appointments, doctors, patients] = await Promise.all([
    scanEntityTypes(['APPOINTMENT']),
    scanEntityTypes(['DOCTOR']),
    scanEntityTypes(['PATIENT']),
  ]);
  const doctorMap = new Map(
    uniqueBy(doctors, (item) => item.doctorId || item.staffId).map((item) => [
      item.doctorId || item.staffId,
      item,
    ]),
  );
  const patientMap = new Map(
    uniqueBy(patients, (item) => item.patientId).map((item) => [item.patientId, item]),
  );
  const query = event.queryStringParameters || {};
  let filtered = uniqueBy(appointments, (item) => item.appointmentId);

  if (query.maBS) filtered = filtered.filter((item) => item.doctorId === query.maBS);
  if (query.maBN) filtered = filtered.filter((item) => item.patientId === query.maBN);

  if (hasGroup(actor, 'BENHNHAN')) {
    const ownPatientId = await patientIdForEvent(event);
    if (!ownPatientId) {
      throw new ApiError(
        403,
        'PATIENT_PROFILE_NOT_LINKED',
        'Tài khoản chưa được liên kết với hồ sơ bệnh nhân',
      );
    }
    if (query.maBN && query.maBN !== ownPatientId) {
      throw new ApiError(
        403,
        'PATIENT_SCOPE_FORBIDDEN',
        'Bạn chỉ được xem lịch khám của chính mình',
      );
    }
    filtered = filtered.filter((item) => item.patientId === ownPatientId);
  }

  return success(filtered.map((item) => toLegacyAppointment(item, doctorMap, patientMap)));
}

async function legacyPatientAppointments(event) {
  const patientId = routeParameter(event, 'patientId');
  await requirePatientScope(event, patientId);
  event.queryStringParameters = {
    ...(event.queryStringParameters || {}),
    maBN: patientId,
  };
  return legacyListAppointments(event);
}

async function legacyDoctorAppointments(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const doctorId = routeParameter(event, 'doctorId');
  event.queryStringParameters = {
    ...(event.queryStringParameters || {}),
    maBS: doctorId,
  };
  return legacyListAppointments(event);
}

async function legacyListLabResults(event) {
  const actor = requireGroups(event, [
    'ADMIN',
    'BACSI',
    'NHANSU',
    'BENHNHAN',
  ]);
  const query = event.queryStringParameters || {};
  let items = uniqueBy(
    await scanEntityTypes(['LAB_RESULT']),
    (item) => item.labResultId,
  );

  if (query.maBN) {
    items = items.filter((item) => item.patientId === query.maBN);
  }

  if (hasGroup(actor, 'BENHNHAN')) {
    const ownPatientId = await patientIdForEvent(event);
    if (!ownPatientId) {
      throw new ApiError(
        403,
        'PATIENT_PROFILE_NOT_LINKED',
        'Tài khoản chưa được liên kết với hồ sơ bệnh nhân',
      );
    }
    if (query.maBN && query.maBN !== ownPatientId) {
      throw new ApiError(
        403,
        'PATIENT_SCOPE_FORBIDDEN',
        'Bạn chỉ được xem kết quả xét nghiệm của chính mình',
      );
    }
    items = items.filter((item) => item.patientId === ownPatientId);
  }

  items.sort((left, right) =>
    String(right.performedAt || right.createdAt || '').localeCompare(
      String(left.performedAt || left.createdAt || ''),
    ),
  );

  return success(items.map(toLegacyLabResult));
}

async function legacyReadLabResult(event) {
  const labResultId = routeParameter(event, 'labResultId');
  const item = await ensureDirectEntity('LAB_RESULT', labResultId);
  await requirePatientScope(event, item.patientId);
  return success(toLegacyLabResult(item));
}

async function legacyListMedicalRecords(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const records = uniqueBy(
    await scanEntityTypes(['MEDICAL_RECORD']),
    (item) => item.recordId,
  );
  return success(records.map(toLegacyMedicalRecord));
}

async function legacyPatientMedicalRecords(event) {
  const patientId = routeParameter(event, 'patientId');
  await requirePatientScope(event, patientId);
  const records = uniqueBy(
    await scanEntityTypes(['MEDICAL_RECORD']),
    (item) => item.recordId,
  ).filter((item) => item.patientId === patientId);
  return success(records.map(toLegacyMedicalRecord));
}

async function legacyListExaminations(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const items = uniqueBy(
    await scanEntityTypes(['EXAMINATION']),
    (item) => item.examinationId,
  );
  return success(items.map(toLegacyExamination));
}

async function legacyListPrescriptions(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN']);
  const query = event.queryStringParameters || {};
  let items = uniqueBy(
    await scanEntityTypes(['PRESCRIPTION']),
    (item) => item.prescriptionId,
  );
  if (query.maBS) items = items.filter((item) => (item.doctorId || item.createdBy) === query.maBS);
  if (query.maBN) items = items.filter((item) => item.patientId === query.maBN);
  return success(items.map(toLegacyPrescription));
}

async function legacyListMedicines(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN']);
  const items = uniqueBy(
    await scanEntityTypes(['MEDICINE']),
    (item) => item.medicineId,
  );
  return success(items.map(toLegacyMedicine));
}

async function legacyListUnits(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN']);
  const medicines = uniqueBy(
    await scanEntityTypes(['MEDICINE']),
    (item) => item.medicineId,
  );
  const units = [...new Set(medicines.map((item) => item.unit || 'VIEN'))];
  return success(
    units.map((unit, index) => ({
      maDVT: `DVT${String(index + 1).padStart(3, '0')}`,
      tenDVT: unit,
      value: unit,
      label: unit,
    })),
  );
}

async function legacyListMedicineGroups(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN']);
  return success([
    {
      maNhomThuoc: 'NHOM_CHUNG',
      tenNhomThuoc: 'Thuá»‘c thÃ´ng dá»¥ng',
      description: 'NhÃ³m dá»¯ liá»‡u máº«u Tuáº§n 1',
    },
  ]);
}

async function legacyListSchedules(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN']);
  const query = event.queryStringParameters || {};
  let items = uniqueBy(
    await scanEntityTypes(['WORK_SCHEDULE']),
    (item) => item.scheduleId,
  );
  if (query.maBS) items = items.filter((item) => item.staffId === query.maBS);
  if (query.maNS) items = items.filter((item) => item.staffId === query.maNS);
  return success(items.map(toLegacySchedule));
}

async function legacyDoctorSchedules(event) {
  const doctorId = routeParameter(event, 'doctorId');
  event.queryStringParameters = {
    ...(event.queryStringParameters || {}),
    maBS: doctorId,
  };
  return legacyListSchedules(event);
}

async function legacyStaffSchedules(event) {
  const staffId = routeParameter(event, 'staffId');
  event.queryStringParameters = {
    ...(event.queryStringParameters || {}),
    maNS: staffId,
  };
  return legacyListSchedules(event);
}

async function legacyListShifts(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN']);
  const schedules = uniqueBy(
    await scanEntityTypes(['WORK_SCHEDULE']),
    (item) => item.shiftId,
  );
  return success(
    schedules.map((item) => ({
      maCa: item.shiftId,
      tenCa: item.shiftId === 'CA_SANG' ? 'Ca sÃ¡ng' : item.shiftId === 'CA_CHIEU' ? 'Ca chiá»u' : item.shiftId,
      gioBatDau: item.startTime,
      gioKetThuc: item.endTime,
    })),
  );
}

async function legacyListRooms(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN']);
  const rooms = uniqueBy(await scanEntityTypes(['ROOM']), (item) => item.roomId);
  return success(
    rooms.map((item) => ({
      maPhong: item.roomId,
      roomId: item.roomId,
      tenPhong: item.roomName,
      roomName: item.roomName,
      maKhoa: item.departmentId,
      departmentId: item.departmentId,
      trangThai: normalizeStatus(item.status),
    })),
  );
}

async function legacyEmptyList(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN']);
  return success([]);
}

async function legacyInvoiceStatistics(event) {
  requireGroups(event, ['ADMIN']);
  const query = event.queryStringParameters || {};
  return success({
    tuNgay: query.from || query.tuNgay || null,
    denNgay: query.to || query.denNgay || null,
    tongSo: 0,
    tongTien: 0,
    daThanhToan: 0,
    chuaThanhToan: 0,
    message: 'Module hóa đơn chưa có dữ liệu trong phạm vi Tuần 1.',
  });
}

const routeHandlers = Object.freeze({
  'GET /api/benhnhan': legacyListPatients,
  'GET /api/benhnhan/{patientId}': legacyReadPatient,
  'PUT /api/benhnhan/{patientId}': updatePatient,
  'GET /api/benhnhan/findByMaTK/{maTK}': legacyPatientByAccount,
  'GET /api/bacsi': legacyListDoctors,
  'GET /api/bacsi/maTK/{maTK}': legacyDoctorByAccount,
  'GET /api/bacsi/tk/{maTK}': legacyDoctorByAccount,
  'GET /api/nhansu': legacyListStaff,
  'GET /api/nhansu/maTK/{maTK}': legacyStaffByAccount,
  'GET /api/khoa': legacyListDepartments,
  'GET /api/phongkham': legacyListRooms,
  'GET /api/lichkham': legacyListAppointments,
  'POST /api/lichkham': legacyCreateAppointment,
  'GET /api/lichkham/{appointmentId}': legacyReadAppointment,
  'DELETE /api/lichkham/{appointmentId}': legacyCancelAppointment,
  'GET /api/lichkham/benhnhan/{patientId}': legacyPatientAppointments,
  'GET /api/lichkham/bacsi/{doctorId}': legacyDoctorAppointments,
  'GET /api/hsba': legacyListMedicalRecords,
  'GET /api/hsba/benhnhan/{patientId}': legacyPatientMedicalRecords,
  'GET /api/phieukham': legacyListExaminations,
  'GET /api/phieukham/nurse/queue': legacyListExaminations,
  'GET /api/donthuoc': legacyListPrescriptions,
  'GET /api/thuoc': legacyListMedicines,
  'GET /api/thuoc/donvitinh': legacyListUnits,
  'GET /api/thuoc/nhomthuoc': legacyListMedicineGroups,
  'GET /api/lichlamviec': legacyListSchedules,
  'GET /api/lichlamviec/bacsi/{doctorId}': legacyDoctorSchedules,
  'GET /api/lichlamviec/nhansu/{staffId}': legacyStaffSchedules,
  'GET /api/catruc': legacyListShifts,
  'GET /api/hoadon': legacyEmptyList,
  'GET /api/hoadon/thongke': legacyInvoiceStatistics,
  'GET /api/xetnghiem': legacyEmptyList,
  'GET /api/yeucauxetnghiem': legacyEmptyList,
  'GET /api/phieuxetnghiem': legacyListLabResults,
  'GET /api/phieuxetnghiem/{labResultId}': legacyReadLabResult,
  'POST /api/patients': createPatient,
  'GET /api/patients/{patientId}': readPatient,
  'PUT /api/patients/{patientId}': updatePatient,
  'POST /api/patients/{patientId}/records': createMedicalRecord,
  'GET /api/patients/{patientId}/records': listMedicalRecords,
  'POST /api/patients/{patientId}/examinations': createExamination,
  'GET /api/patients/{patientId}/examinations': listExaminations,
  'POST /api/patients/{patientId}/prescriptions': createPrescription,
  'GET /api/patients/{patientId}/prescriptions': listPrescriptions,
  'GET /api/patients/{patientId}/documents': listDocuments,
  'POST /api/medical/upload-url': createUploadUrl,
  'POST /api/medical/complete-upload': completeUpload,
  'GET /api/medical/download-url': createDownloadUrl,
});

async function handler(event) {
  const routeKey = getRouteKey(event);
  const context = {
    requestId: requestId(event),
    routeKey,
  };

  try {
    requireEnvironment();
    const routeHandler = routeHandlers[routeKey];
    if (!routeHandler) {
      throw new ApiError(404, 'ROUTE_NOT_FOUND', `Route ${routeKey} not found`);
    }

    console.info('Medical API request started', context);
    const response = await routeHandler(event);
    console.info('Medical API request completed', {
      ...context,
      statusCode: response.statusCode,
    });
    return response;
  } catch (error) {
    return handleError(error, context);
  }
}

module.exports = {
  handler,
  routeHandlers,
};
