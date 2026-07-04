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
const adminFeatures = require('./admin-features');
const adminCatalog = require('./admin-catalog');
const labWorkflow = require('./lab-workflow');

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

function sameIdentifier(left, right) {
  return String(left || '').trim().toUpperCase() ===
    String(right || '').trim().toUpperCase();
}

async function ensureDirectEntity(entity, id, patientId) {
  const normalizedEntity = String(entity || '').trim().toUpperCase();
  let item = await getItem(directKey(normalizedEntity, id));

  // Hồ sơ được tạo từ API quản lý cũ có dạng:
  // PATIENT#{patientId} / MEDICAL_RECORD#{recordId}
  // và không có bản ghi trực tiếp RECORD#{recordId} / METADATA.
  // Fallback này giúp phiếu khám, đơn thuốc và xét nghiệm dùng được cả hai kiểu dữ liệu.
  if (!item) {
    const fallback = {
      RECORD: {
        entityType: 'MEDICAL_RECORD',
        idField: 'recordId',
      },
      EXAMINATION: {
        entityType: 'EXAMINATION',
        idField: 'examinationId',
      },
      PRESCRIPTION: {
        entityType: 'PRESCRIPTION',
        idField: 'prescriptionId',
      },
      DOCUMENT: {
        entityType: 'MEDICAL_DOCUMENT',
        idField: 'documentId',
      },
    }[normalizedEntity];

    if (fallback) {
      const candidates = await scanEntityTypes([fallback.entityType]);
      item = candidates.find(
        (candidate) => sameIdentifier(candidate?.[fallback.idField], id),
      );
    }
  }

  if (!item) {
    throw new ApiError(
      404,
      `${normalizedEntity}_NOT_FOUND`,
      `${normalizedEntity} not found`,
    );
  }
  if (patientId && !sameIdentifier(item.patientId, patientId)) {
    throw new ApiError(
      409,
      'PATIENT_RELATION_MISMATCH',
      `${normalizedEntity} does not belong to this patient`,
    );
  }
  return item;
}

async function ensureMedicalRecordForPatient(recordId, patientId) {
  try {
    return await ensureDirectEntity('RECORD', recordId, patientId);
  } catch (error) {
    if (error?.code !== 'RECORD_NOT_FOUND' && error?.statusCode !== 404) {
      throw error;
    }
  }

  const patient = await ensurePatient(patientId);
  const citizenId = String(patient.citizenId || '').trim();

  if (!/^\d{12}$/.test(citizenId)) {
    throw new ApiError(
      409,
      'PATIENT_CCCD_REQUIRED',
      'Bệnh nhân phải có CCCD hợp lệ trước khi lập hồ sơ bệnh án',
    );
  }

  if (!sameIdentifier(citizenId, recordId)) {
    throw new ApiError(
      409,
      'MEDICAL_RECORD_CCCD_MISMATCH',
      'Mã hồ sơ bệnh án phải trùng với CCCD của bệnh nhân',
    );
  }

  const now = new Date().toISOString();
  const item = {
    entityType: 'RECORD',
    recordId: citizenId,
    medicalRecordId: citizenId,
    recordCode: citizenId,
    citizenId,
    patientId,
    status: 'OPEN',
    dataSource: 'CCCD_AUTO_RECORD',
    createdBy: 'SYSTEM',
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  try {
    return await putPatientProjection({
      entity: 'RECORD',
      id: citizenId,
      patientId,
      prefix: 'RECORD',
      createdAt: now,
      item,
    });
  } catch (error) {
    // Hai request đồng thời có thể cùng tạo hồ sơ. Sau xung đột,
    // đọc lại hồ sơ vừa được request còn lại tạo thành công.
    if (
      error?.name !== 'TransactionCanceledException' &&
      error?.name !== 'ConditionalCheckFailedException'
    ) {
      throw error;
    }
    return ensureDirectEntity('RECORD', citizenId, patientId);
  }
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
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const patientId = routeParameter(event, 'patientId');
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
    version: 1,
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
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const patientId = routeParameter(event, 'patientId');
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

  const rawMedicalRecordId =
    body.medicalRecordId || body.recordId || body.maHSBA || null;
  const medicalRecordId = rawMedicalRecordId
    ? requiredString(rawMedicalRecordId, 'medicalRecordId', { maxLength: 100 })
    : null;

  if (hasGroup(actor, 'BACSI') && !medicalRecordId) {
    throw new ApiError(
      400,
      'MEDICAL_RECORD_REQUIRED',
      'Bác sĩ phải chọn hồ sơ bệnh án trước khi lập phiếu khám',
    );
  }

  if (medicalRecordId) {
    await ensureMedicalRecordForPatient(medicalRecordId, patientId);
  }

  const item = {
    entityType: 'EXAMINATION',
    examinationId,
    patientId,
    medicalRecordId,
    recordId: medicalRecordId,
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
    version: 1,
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
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const patientId = routeParameter(event, 'patientId');
  await ensurePatient(patientId);

  const query = event.queryStringParameters || {};
  const requestedRecordId =
    query.medicalRecordId || query.recordId || query.maHSBA || null;

  const [projected, legacy] = await Promise.all([
    queryPatientItems(patientId, 'EXAM'),
    scanEntityTypes(['EXAMINATION']),
  ]);

  let items = uniqueBy(
    [
      ...projected,
      ...legacy.filter((item) => sameIdentifier(item.patientId, patientId)),
    ],
    (item) => item.examinationId,
  );

  if (requestedRecordId) {
    await ensureMedicalRecordForPatient(requestedRecordId, patientId);
    const patientRecords = uniqueBy(
      (await scanEntityTypes(['MEDICAL_RECORD', 'RECORD']))
        .filter((item) => sameIdentifier(item.patientId, patientId)),
      (item) => item.recordId,
    );
    const allowUnlinkedLegacy = patientRecords.length <= 1;

    items = items.filter((item) => {
      const itemRecordId =
        item.recordId || item.medicalRecordId || item.maHSBA || null;
      return itemRecordId
        ? sameIdentifier(itemRecordId, requestedRecordId)
        : allowUnlinkedLegacy;
    });
  }

  items.sort((left, right) =>
    String(right.createdAt || '').localeCompare(String(left.createdAt || '')),
  );

  return success({
    patientId,
    medicalRecordId: requestedRecordId,
    items: items.map(toLegacyExamination),
    count: items.length,
  });
}

async function createPrescription(event) {
  const actor = requireGroups(event, ['BACSI']);
  const patientId = routeParameter(event, 'patientId');
  await ensurePatient(patientId);

  const body = parseJsonBody(event);
  const recordId = requiredString(
    body.recordId || body.medicalRecordId || body.maHSBA,
    'recordId',
    { maxLength: 100 },
  );
  const record = await ensureMedicalRecordForPatient(recordId, patientId);

  const examinationId = requiredString(
    body.examinationId || body.maPK,
    'examinationId',
    { maxLength: 100 },
  );
  const examination = await ensureDirectEntity(
    'EXAMINATION',
    examinationId,
    patientId,
  );

  const examinationRecordId =
    examination.recordId ||
    examination.medicalRecordId ||
    examination.maHSBA ||
    null;

  if (
    examinationRecordId &&
    !sameIdentifier(examinationRecordId, recordId)
  ) {
    throw new ApiError(
      409,
      'EXAMINATION_RECORD_MISMATCH',
      'Phiếu khám không thuộc hồ sơ bệnh án đã chọn',
    );
  }

  const prescriptionId = randomUUID();
  const now = new Date().toISOString();
  const item = {
    entityType: 'PRESCRIPTION',
    prescriptionId,
    patientId,
    doctorId: actor.sub,
    recordId,
    medicalRecordId: recordId,
    examinationId,
    recordCreatedAt: record.createdAt || null,
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
    version: 1,
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
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const patientId = routeParameter(event, 'patientId');
  await ensurePatient(patientId);

  const query = event.queryStringParameters || {};
  const requestedRecordId =
    query.medicalRecordId || query.recordId || query.maHSBA || null;
  const requestedExaminationId =
    query.examinationId || query.maPK || null;

  const [projected, legacy] = await Promise.all([
    queryPatientItems(patientId, 'PRESCRIPTION'),
    scanEntityTypes(['PRESCRIPTION']),
  ]);

  let items = uniqueBy(
    [
      ...projected,
      ...legacy.filter((item) => sameIdentifier(item.patientId, patientId)),
    ],
    (item) => item.prescriptionId,
  );

  if (requestedRecordId) {
    await ensureMedicalRecordForPatient(requestedRecordId, patientId);
    items = items.filter((item) =>
      sameIdentifier(
        item.recordId || item.medicalRecordId || item.maHSBA,
        requestedRecordId,
      ),
    );
  }

  if (requestedExaminationId) {
    items = items.filter((item) =>
      sameIdentifier(item.examinationId || item.maPK, requestedExaminationId),
    );
  }

  items.sort((left, right) =>
    String(right.createdAt || '').localeCompare(String(left.createdAt || '')),
  );

  return success({
    patientId,
    medicalRecordId: requestedRecordId,
    examinationId: requestedExaminationId,
    items: items.map(toLegacyPrescription),
    count: items.length,
  });
}

async function createUploadUrl(event) {
  const actor = requireGroups(event, ['BACSI', 'NHANSU']);
  const body = parseJsonBody(event);
  const patientId = requiredString(body.patientId, 'patientId', {
    maxLength: 100,
  });
  await ensurePatient(patientId);
  const medicalRecordId = body.medicalRecordId || body.recordId || body.maHSBA
    ? requiredString(
        body.medicalRecordId || body.recordId || body.maHSBA,
        'medicalRecordId',
        { maxLength: 100 },
      )
    : null;
  if (medicalRecordId) {
    await ensureMedicalRecordForPatient(medicalRecordId, patientId);
  }

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
    medicalRecordId,
    recordId: medicalRecordId,
    fileName,
    contentType,
    expectedFileSize: fileSize,
    key,
    status: 'PENDING_UPLOAD',
    uploadedBy: actor.sub,
    createdAt: now,
    updatedAt: now,
    version: 1,
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
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const documentId = queryParameter(event, 'documentId');
  const document = await ensureDirectEntity('DOCUMENT', documentId);

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
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const patientId = routeParameter(event, 'patientId');
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
  const currentUser = getCurrentUser(event);
  const users = await scanEntityTypes(['USER']);

  const email = normalizeIdentity(currentUser.email);
  const username = normalizeIdentity(currentUser.username);

  return (
    users.find((item) => {
      const sameSub =
        currentUser.sub &&
        (
          item.cognitoSub === currentUser.sub ||
          item.userId === currentUser.sub
        );

      const sameUsername =
        username &&
        normalizeIdentity(item.cognitoUsername) === username;

      const sameEmail =
        email &&
        normalizeIdentity(item.email) === email;

      return sameSub || sameUsername || sameEmail;
    }) || null
  );
}

async function patientIdForEvent(event) {
  const currentUser = getCurrentUser(event);

  if (!hasGroup(currentUser, 'BENHNHAN')) {
    return null;
  }

  const applicationUser =
    await applicationUserForEvent(event);

  if (applicationUser?.patientId) {
    return applicationUser.patientId;
  }

  const patients = await scanEntityTypes(['PATIENT']);

  const email = normalizeIdentity(currentUser.email);
  const username = normalizeIdentity(
    currentUser.username,
  );

  const patient = patients.find((item) => {
    const sameSub =
      currentUser.sub &&
      item.cognitoSub === currentUser.sub;

    const sameUsername =
      username &&
      normalizeIdentity(item.cognitoUsername) ===
        username;

    const sameEmail =
      email &&
      normalizeIdentity(item.email) === email;

    const sameAccount =
      applicationUser?.userId &&
      item.accountUserId === applicationUser.userId;

    return (
      sameSub ||
      sameUsername ||
      sameEmail ||
      sameAccount
    );
  });

  return patient?.patientId || null;
}

async function requirePatientScope(
  event,
  patientId,
  allowedGroups = [
    'ADMIN',
    'BACSI',
    'NHANSU',
    'BENHNHAN',
  ],
) {
  const actor = requireGroups(
    event,
    allowedGroups,
  );

  if (!hasGroup(actor, 'BENHNHAN')) {
    return actor;
  }

  const ownPatientId =
    await patientIdForEvent(event);

  if (
    !ownPatientId ||
    ownPatientId !== patientId
  ) {
    throw new ApiError(
      403,
      'PATIENT_SCOPE_FORBIDDEN',
      'Bạn chỉ được xem dữ liệu bệnh nhân của chính mình',
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
  const birthDate = item.birthDate || item.dateOfBirth || null;
  const healthInsurance =
    item.healthInsurance || item.healthInsuranceNumber || null;
  const citizenId = item.citizenId || item.cccd || null;

  return {
    maBN: item.patientId,
    patientId: item.patientId,
    maTK: item.accountUserId || null,
    hoTen: item.fullName,
    fullName: item.fullName,
    ngaySinh: birthDate,
    birthDate,
    dateOfBirth: birthDate,
    gioiTinh: item.gender || null,
    gender: item.gender || null,
    soDienThoai: item.phoneNumber || null,
    phoneNumber: item.phoneNumber || null,
    diaChi: item.address || null,
    address: item.address || null,
    email: item.email || null,
    bhyt: healthInsurance,
    healthInsurance,
    healthInsuranceNumber: healthInsurance,
    cccd: citizenId,
    citizenId,
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
  const recordId =
    item.recordId ||
    item.medicalRecordId ||
    item.maHSBA ||
    null;

  return {
    maPK: item.examinationId,
    examinationId: item.examinationId,
    maHSBA: recordId,
    recordId,
    medicalRecordId: recordId,
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
  const recordId =
    item.recordId ||
    item.medicalRecordId ||
    item.maHSBA ||
    null;
  const examinationId =
    item.examinationId ||
    item.maPK ||
    null;

  return {
    maDT: item.prescriptionId,
    prescriptionId: item.prescriptionId,
    maHSBA: recordId,
    recordId,
    medicalRecordId: recordId,
    maPK: examinationId,
    examinationId,
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

    ngayThucHien:
      item.performedAt ||
      item.createdAt ||
      null,

    performedAt:
      item.performedAt ||
      item.createdAt ||
      null,

    ketQua: item.resultText || '',
    resultText: item.resultText || '',

    khoangThamChieu:
      item.referenceRange || '',

    referenceRange:
      item.referenceRange || '',

    donVi: item.unit || '',
    unit: item.unit || '',

    trangThai: normalizeStatus(
      item.status || 'COMPLETED',
    ),

    status: normalizeStatus(
      item.status || 'COMPLETED',
    ),

    XetNghiem: {
      maXN:
        item.testId ||
        item.labResultId,

      tenXN:
        item.testName ||
        'Xét nghiệm',

      LoaiXetNghiem: {
        maLoaiXN:
          item.categoryId ||
          item.testTypeId ||
          null,

        tenLoai:
          item.categoryName ||
          item.testTypeName ||
          'Tổng quát',
      },
    },

    NhanSuYTe: {
      maNS: item.staffId || null,
      hoTen:
        item.staffName ||
        'Kỹ thuật viên',
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
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN']);
  const patientId = routeParameter(event, 'patientId');
  const patient = await getPatient(patientId);
  if (!patient) throw new ApiError(404, 'PATIENT_NOT_FOUND', 'Patient not found');
  return success(toLegacyPatient(patient));
}

async function legacyPatientByAccount(event) {
  const actor = requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN']);
  const maTK = String(routeParameter(event, 'maTK') || '').trim();
  const [patients, users] = await Promise.all([
    scanEntityTypes(['PATIENT']),
    scanEntityTypes(['USER']),
  ]);

  const candidates = [
    maTK,
    actor.sub,
    actor.username,
    actor.email,
  ].filter(Boolean);

  const applicationUser = users.find((item) =>
    [item.userId, item.cognitoSub, item.cognitoUsername, item.email].some(
      (value) =>
        candidates.some(
          (candidate) => normalizeIdentity(value) === normalizeIdentity(candidate),
        ),
    ),
  );

  const patient = patients.find((item) =>
    [
      item.patientId,
      item.accountUserId,
      item.cognitoSub,
      item.cognitoUsername,
      item.email,
    ].some((value) =>
      candidates.some(
        (candidate) => normalizeIdentity(value) === normalizeIdentity(candidate),
      ),
    ) ||
    (applicationUser?.patientId && item.patientId === applicationUser.patientId),
  );

  if (!patient) {
    throw new ApiError(404, 'PATIENT_NOT_FOUND', 'Không tìm thấy hồ sơ bệnh nhân');
  }

  if (hasGroup(actor, 'BENHNHAN')) {
    const ownPatientId = await patientIdForEvent(event);
    if (!ownPatientId || ownPatientId !== patient.patientId) {
      throw new ApiError(403, 'PATIENT_SCOPE_FORBIDDEN', 'Bạn chỉ được xem hồ sơ của chính mình');
    }
  }

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

  // A patient must use the patient-specific route in the UI. The general route
  // returns only a demo patient's own records when the role is BENHNHAN.
  if (hasGroup(actor, 'BENHNHAN') && !query.maBN) {
    filtered = filtered.filter((item) => item.patientId === 'BN001');
  }

  return success(filtered.map((item) => toLegacyAppointment(item, doctorMap, patientMap)));
}

async function legacyPatientAppointments(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN']);
  const patientId = routeParameter(event, 'patientId');
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

  const query =
    event.queryStringParameters || {};

  let items = uniqueBy(
    await scanEntityTypes(['LAB_RESULT']),
    (item) => item.labResultId,
  );

  const requestedPatientId =
    query.maBN ||
    query.patientId ||
    null;

  if (requestedPatientId) {
    items = items.filter(
      (item) =>
        item.patientId === requestedPatientId,
    );
  }

  if (hasGroup(actor, 'BENHNHAN')) {
    const ownPatientId =
      await patientIdForEvent(event);

    if (!ownPatientId) {
      throw new ApiError(
        403,
        'PATIENT_PROFILE_NOT_LINKED',
        'Tài khoản chưa được liên kết với hồ sơ bệnh nhân',
      );
    }

    if (
      requestedPatientId &&
      requestedPatientId !== ownPatientId
    ) {
      throw new ApiError(
        403,
        'PATIENT_SCOPE_FORBIDDEN',
        'Bạn chỉ được xem kết quả xét nghiệm của chính mình',
      );
    }

    items = items.filter(
      (item) =>
        item.patientId === ownPatientId,
    );
  }

  items.sort((left, right) =>
    String(
      right.performedAt ||
      right.createdAt ||
      '',
    ).localeCompare(
      String(
        left.performedAt ||
        left.createdAt ||
        '',
      ),
    ),
  );

  return success(
    items.map(toLegacyLabResult),
  );
}

async function legacyReadLabResult(event) {
  const labResultId = routeParameter(
    event,
    'labResultId',
  );

  const item = await ensureDirectEntity(
    'LAB_RESULT',
    labResultId,
  );

  await requirePatientScope(
    event,
    item.patientId,
  );

  return success(
    toLegacyLabResult(item),
  );
}
function eventDateValue(item, fields = []) {
  for (const field of fields) {
    const value = item?.[field];
    if (value) return value;
  }
  return null;
}

function datePart(value) {
  if (!value) return '';
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function earliestDate(values = []) {
  return values
    .filter(Boolean)
    .map((value) => String(value))
    .sort((left, right) => left.localeCompare(right))[0] || null;
}

function normalizedText(value) {
  return String(value || '').trim().toLowerCase();
}

function isTwelveDigitCitizenId(value) {
  return /^\d{12}$/.test(String(value || '').trim());
}

function isClinicalRecordEvent(record = {}) {
  return Boolean(
    record.examinationId ||
      record.encounterAt ||
      record.examinedAt ||
      record.symptoms ||
      record.diagnosis ||
      record.treatment ||
      record.advice ||
      record.vitals,
  );
}

function pickCanonicalPatientRecord(records = [], patient = {}) {
  const citizenId = String(patient.citizenId || patient.cccd || patient.medicalRecordId || '').trim();
  const exactCitizenRecord = records.find((record) =>
    isTwelveDigitCitizenId(record.recordId) &&
    (record.recordId === citizenId || record.citizenId === citizenId || record.recordCode === citizenId),
  );
  if (exactCitizenRecord) return exactCitizenRecord;

  const anyCitizenRecord = records.find((record) =>
    isTwelveDigitCitizenId(record.recordId || record.medicalRecordId || record.recordCode || record.citizenId),
  );
  if (anyCitizenRecord) return anyCitizenRecord;

  return records[0] || null;
}

function buildPrescriptionItems(prescription, rawItems, medicineMap) {
  const embeddedItems = Array.isArray(prescription.medicineItems)
    ? prescription.medicineItems
    : [];
  const separateItems = rawItems.filter(
    (item) => item.prescriptionId === prescription.prescriptionId,
  );
  const source = embeddedItems.length > 0 ? embeddedItems : separateItems;

  return source.map((item) => {
    const medicineId = item.medicineId || item.maThuoc || null;
    const medicine = medicineMap.get(medicineId);
    return {
      maThuoc: medicineId,
      medicineId,
      tenThuoc:
        item.medicineName ||
        item.tenThuoc ||
        medicine?.name ||
        medicine?.medicineName ||
        'Thuốc',
      soLuong: item.quantity ?? item.soLuong ?? null,
      quantity: item.quantity ?? item.soLuong ?? null,
      lieuDung: item.dosage || item.lieuDung || '',
      dosage: item.dosage || item.lieuDung || '',
      tanSuat: item.frequency || item.tanSuat || '',
      frequency: item.frequency || item.tanSuat || '',
      soNgayDung: item.durationDays ?? item.soNgayDung ?? null,
      durationDays: item.durationDays ?? item.soNgayDung ?? null,
      huongDan: item.instructions || item.huongDan || '',
      instructions: item.instructions || item.huongDan || '',
      donVi: item.unit || medicine?.unit || '',
      unit: item.unit || medicine?.unit || '',
    };
  });
}

async function getPatientMedicalTimeline(event) {
  const patientId = routeParameter(event, 'patientId');
  await ensurePatient(patientId);
  await requirePatientScope(
    event,
    patientId,
    ['BACSI', 'NHANSU', 'BENHNHAN'],
  );

  const allItems = await scanEntityTypes([
    'PATIENT',
    'MEDICAL_RECORD',
    'RECORD',
    'EXAMINATION',
    'PRESCRIPTION',
    'PRESCRIPTION_ITEM',
    'LAB_RESULT',
    'APPOINTMENT',
    'DOCTOR',
    'STAFF',
    'MEDICINE',
  ]);

  const patient = allItems.find(
    (item) => item.entityType === 'PATIENT' && item.patientId === patientId,
  );
  if (!patient) {
    throw new ApiError(404, 'PATIENT_NOT_FOUND', 'Không tìm thấy bệnh nhân');
  }

  const records = uniqueBy(
    allItems.filter(
      (item) =>
        ['MEDICAL_RECORD', 'RECORD'].includes(item.entityType) &&
        item.patientId === patientId,
    ),
    (item) => item.recordId || item.medicalRecordId || item.citizenId,
  ).sort((left, right) => {
    const leftCitizenRank = isTwelveDigitCitizenId(
      left.recordId || left.medicalRecordId || left.recordCode || left.citizenId,
    )
      ? 0
      : 1;
    const rightCitizenRank = isTwelveDigitCitizenId(
      right.recordId || right.medicalRecordId || right.recordCode || right.citizenId,
    )
      ? 0
      : 1;
    if (leftCitizenRank !== rightCitizenRank) {
      return leftCitizenRank - rightCitizenRank;
    }
    return String(left.createdAt || left.encounterAt || '').localeCompare(
      String(right.createdAt || right.encounterAt || ''),
    );
  });
  const canonicalRecord = pickCanonicalPatientRecord(records, patient);
  const canonicalRecordId =
    canonicalRecord?.recordId ||
    canonicalRecord?.medicalRecordId ||
    canonicalRecord?.recordCode ||
    patient.citizenId ||
    patient.cccd ||
    `HSBA-${patientId}`;

  const examinations = uniqueBy(
    allItems.filter(
      (item) => item.entityType === 'EXAMINATION' && item.patientId === patientId,
    ),
    (item) => item.examinationId,
  );
  const prescriptions = uniqueBy(
    allItems.filter(
      (item) => item.entityType === 'PRESCRIPTION' && item.patientId === patientId,
    ),
    (item) => item.prescriptionId,
  );
  const prescriptionItems = allItems.filter(
    (item) => item.entityType === 'PRESCRIPTION_ITEM',
  );
  const labResults = uniqueBy(
    allItems.filter(
      (item) => item.entityType === 'LAB_RESULT' && item.patientId === patientId,
    ),
    (item) => item.labResultId,
  );
  const appointments = uniqueBy(
    allItems.filter(
      (item) => item.entityType === 'APPOINTMENT' && item.patientId === patientId,
    ),
    (item) => item.appointmentId,
  );

  const doctorMap = new Map(
    allItems
      .filter((item) => item.entityType === 'DOCTOR')
      .map((item) => [item.doctorId || item.staffId, item]),
  );
  const staffMap = new Map(
    allItems
      .filter((item) => item.entityType === 'STAFF')
      .map((item) => [item.staffId, item]),
  );
  const medicineMap = new Map(
    allItems
      .filter((item) => item.entityType === 'MEDICINE')
      .map((item) => [item.medicineId, item]),
  );

  const examinationKeys = new Set(
    examinations.map((item) => {
      const occurredAt = eventDateValue(item, ['examinedAt', 'createdAt', 'updatedAt']);
      return `${datePart(occurredAt)}|${normalizedText(item.diagnosis)}`;
    }),
  );

  const events = [];

  for (const record of records) {
    if (!isClinicalRecordEvent(record)) continue;
    const occurredAt = eventDateValue(record, [
      'encounterAt',
      'examinedAt',
      'createdAt',
      'updatedAt',
    ]);
    const duplicateKey = `${datePart(occurredAt)}|${normalizedText(record.diagnosis)}`;
    if (record.diagnosis && examinationKeys.has(duplicateKey)) continue;

    const doctorId = record.doctorId || record.createdBy || null;
    const doctor = doctorMap.get(doctorId);
    events.push({
      id: `record-${record.recordId}`,
      loai: 'PHIEU_KHAM',
      type: 'EXAMINATION',
      nguon: 'MEDICAL_RECORD',
      thoiGian: occurredAt,
      occurredAt,
      maHSBA: record.recordId,
      recordId: record.recordId,
      data: {
        maPK: record.examinationId || record.recordId,
        examinationId: record.examinationId || record.recordId,
        maBS: doctorId,
        doctorId,
        tenBacSi: doctor?.fullName || doctor?.name || doctorId || 'Chưa cập nhật',
        trieuChung: record.symptoms || '',
        symptoms: record.symptoms || '',
        chuanDoan: record.diagnosis || '',
        diagnosis: record.diagnosis || '',
        dieuTri: record.treatment || '',
        treatment: record.treatment || '',
        loiDan: record.advice || record.note || record.notes || '',
        advice: record.advice || record.note || record.notes || '',
        sinhHieu: record.vitals || {},
        vitals: record.vitals || {},
        trangThai: normalizeStatus(record.status || 'COMPLETED'),
        status: normalizeStatus(record.status || 'COMPLETED'),
      },
    });
  }

  for (const examination of examinations) {
    const occurredAt = eventDateValue(examination, [
      'examinedAt',
      'createdAt',
      'updatedAt',
    ]);
    const doctorId = examination.doctorId || examination.actorId || null;
    const doctor = doctorMap.get(doctorId);
    events.push({
      id: `examination-${examination.examinationId}`,
      loai: 'PHIEU_KHAM',
      type: 'EXAMINATION',
      nguon: 'EXAMINATION',
      thoiGian: occurredAt,
      occurredAt,
      maHSBA: examination.recordId || records[0]?.recordId || null,
      recordId: examination.recordId || records[0]?.recordId || null,
      data: {
        ...toLegacyExamination(examination),
        tenBacSi: doctor?.fullName || doctor?.name || doctorId || 'Chưa cập nhật',
      },
    });
  }

  for (const prescription of prescriptions) {
    const occurredAt = eventDateValue(prescription, [
      'prescribedAt',
      'createdAt',
      'updatedAt',
    ]);
    const doctorId = prescription.doctorId || prescription.createdBy || null;
    const doctor = doctorMap.get(doctorId);
    const medicineItems = buildPrescriptionItems(
      prescription,
      prescriptionItems,
      medicineMap,
    );
    events.push({
      id: `prescription-${prescription.prescriptionId}`,
      loai: 'DON_THUOC',
      type: 'PRESCRIPTION',
      nguon: 'PRESCRIPTION',
      thoiGian: occurredAt,
      occurredAt,
      maHSBA: prescription.recordId || records[0]?.recordId || null,
      recordId: prescription.recordId || records[0]?.recordId || null,
      data: {
        ...toLegacyPrescription({ ...prescription, medicineItems }),
        tenBacSi: doctor?.fullName || doctor?.name || doctorId || 'Chưa cập nhật',
        chiTiet: medicineItems,
        medicineItems,
      },
    });
  }

  for (const result of labResults) {
    const occurredAt = eventDateValue(result, [
      'performedAt',
      'createdAt',
      'updatedAt',
    ]);
    const staff = staffMap.get(result.staffId);
    const mapped = toLegacyLabResult(result);
    events.push({
      id: `lab-result-${result.labResultId}`,
      loai: 'XET_NGHIEM',
      type: 'LAB_RESULT',
      nguon: 'LAB_RESULT',
      thoiGian: occurredAt,
      occurredAt,
      maHSBA: result.recordId || records[0]?.recordId || null,
      recordId: result.recordId || records[0]?.recordId || null,
      data: {
        ...mapped,
        tenNhanSu:
          result.staffName || staff?.fullName || staff?.name || result.staffId || '',
      },
    });
  }

  for (const appointment of appointments) {
    const occurredAt = appointment.appointmentDate
      ? `${appointment.appointmentDate}T${appointment.appointmentTime || '00:00'}:00+07:00`
      : eventDateValue(appointment, ['scheduledAt', 'createdAt', 'updatedAt']);
    const doctor = doctorMap.get(appointment.doctorId);
    events.push({
      id: `appointment-${appointment.appointmentId}`,
      loai: 'LICH_KHAM',
      type: 'APPOINTMENT',
      nguon: 'APPOINTMENT',
      thoiGian: occurredAt,
      occurredAt,
      maHSBA: canonicalRecordId || null,
      recordId: canonicalRecordId || null,
      data: {
        ...toLegacyAppointment(appointment),
        tenBacSi:
          doctor?.fullName || doctor?.name || appointment.doctorId || 'Chưa cập nhật',
      },
    });
  }

  events.sort((left, right) =>
    String(right.occurredAt || '').localeCompare(String(left.occurredAt || '')),
  );

  const allDates = [
    patient.createdAt,
    ...records.map((item) => eventDateValue(item, ['createdAt', 'encounterAt'])),
    ...events.map((item) => item.occurredAt),
  ];
  const firstRecord = canonicalRecord || records[0] || null;
  const recordId = canonicalRecordId || firstRecord?.recordId || `HSBA-${patientId}`;
  const diagnoses = [
    ...records.map((item) => item.diagnosis),
    ...examinations.map((item) => item.diagnosis),
  ].filter(Boolean);
  const uniqueDiagnoses = [...new Set(diagnoses.map((item) => String(item).trim()))];
  const visitDates = new Set(
    events
      .filter((item) => ['PHIEU_KHAM', 'LICH_KHAM'].includes(item.loai))
      .map((item) => datePart(item.occurredAt))
      .filter(Boolean),
  );

  return success({
    hoSo: {
      maHSBA: recordId,
      maHSBAHienThi: patient.citizenId || recordId,
      displayRecordId: patient.citizenId || recordId,
      recordId,
      medicalRecordId: recordId,
      recordCode: patient.citizenId || recordId,
      citizenId: patient.citizenId || firstRecord?.citizenId || null,
      cccd: patient.citizenId || firstRecord?.citizenId || null,
      maBN: patientId,
      patientId,
      ngayLap: earliestDate(allDates),
      createdAt: earliestDate(allDates),
      lichSuBenh:
        records.find((item) => item.medicalHistory)?.medicalHistory ||
        uniqueDiagnoses.join('; '),
      trangThai: 'ACTIVE',
      status: 'ACTIVE',
      benhNhan: toLegacyPatient(patient),
      legacyRecordIds: records.map((item) => item.recordId),
    },
    thongKe: {
      soDotKham: visitDates.size,
      soPhieuKham: events.filter((item) => item.loai === 'PHIEU_KHAM').length,
      soDonThuoc: prescriptions.length,
      soXetNghiem: labResults.length,
      soLichKham: appointments.length,
      tongSuKien: events.length,
    },
    suKien: events,
  });
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
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN']);
  const patientId = routeParameter(event, 'patientId');
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
  // Public homepage and public news routes.
  'GET /api/public/khoa': adminFeatures.listPublicDepartments,
  'GET /api/public/bacsi': adminFeatures.listPublicDoctors,
  'GET /api/public/tintuc': adminFeatures.listPublicNews,
  'GET /api/public/tintuc/{newsId}': adminFeatures.getPublicNews,

  // Doctor and staff management.
  'GET /api/bacsi': adminFeatures.listDoctors,
  'POST /api/bacsi': adminFeatures.createDoctor,
  'GET /api/bacsi/{doctorId}': adminFeatures.getDoctor,
  'PUT /api/bacsi/{doctorId}': adminFeatures.updateDoctor,
  'DELETE /api/bacsi/{doctorId}': adminFeatures.deleteDoctor,
  'GET /api/bacsi/maTK/{maTK}': legacyDoctorByAccount,
  'GET /api/bacsi/tk/{maTK}': legacyDoctorByAccount,

  'GET /api/nhansu': adminFeatures.listStaff,
  'POST /api/nhansu': adminFeatures.createStaff,
  'GET /api/nhansu/{staffId}': adminFeatures.getStaff,
  'PUT /api/nhansu/{staffId}': adminFeatures.updateStaff,
  'DELETE /api/nhansu/{staffId}': adminFeatures.deleteStaff,
  'GET /api/nhansu/maTK/{maTK}': legacyStaffByAccount,

  // Laboratory test type and test catalog.
  'GET /api/loaixetnghiem': adminFeatures.listLabTestTypes,
  'POST /api/loaixetnghiem': adminFeatures.createLabTestType,
  'GET /api/loaixetnghiem/{typeId}': adminFeatures.getLabTestType,
  'PUT /api/loaixetnghiem/{typeId}': adminFeatures.updateLabTestType,
  'DELETE /api/loaixetnghiem/{typeId}': adminFeatures.deleteLabTestType,

  'GET /api/xetnghiem': adminFeatures.listLabTests,
  'POST /api/xetnghiem': adminFeatures.createLabTest,
  'GET /api/xetnghiem/{testId}': adminFeatures.getLabTest,
  'PUT /api/xetnghiem/{testId}': adminFeatures.updateLabTest,
  'DELETE /api/xetnghiem/{testId}': adminFeatures.deleteLabTest,

  // Feedback management.
  'GET /api/phanhoi': adminFeatures.listFeedback,
  'POST /api/phanhoi': adminFeatures.createFeedback,
  'GET /api/phanhoi/stats': adminFeatures.feedbackStats,
  'GET /api/phanhoi/benhnhan/{patientId}': adminFeatures.listFeedbackByPatient,
  'GET /api/phanhoi/{feedbackId}': adminFeatures.getFeedback,
  'PUT /api/phanhoi/{feedbackId}': adminFeatures.updateFeedback,
  'DELETE /api/phanhoi/{feedbackId}': adminFeatures.deleteFeedback,

  // News management.
  'GET /api/tintuc': adminFeatures.listNews,
  'POST /api/tintuc': adminFeatures.createNews,
  'GET /api/tintuc/{newsId}': adminFeatures.getNews,
  'PUT /api/tintuc/{newsId}': adminFeatures.updateNews,
  'DELETE /api/tintuc/{newsId}': adminFeatures.deleteNews,

  // Existing compatibility and medical routes.
  'GET /api/benhnhan': adminCatalog.listPatients,
  'POST /api/benhnhan': adminCatalog.createPatient,
  'GET /api/benhnhan/{patientId}': adminCatalog.getPatient,
  'PUT /api/benhnhan/{patientId}': adminCatalog.updatePatient,
  'DELETE /api/benhnhan/{patientId}': adminCatalog.deletePatient,
  'GET /api/benhnhan/findByMaTK/{maTK}': legacyPatientByAccount,
  'GET /api/khoa': legacyListDepartments,
  'GET /api/phongkham': legacyListRooms,
  'GET /api/lichkham': legacyListAppointments,
  'GET /api/lichkham/benhnhan/{patientId}': legacyPatientAppointments,
  'GET /api/lichkham/bacsi/{doctorId}': legacyDoctorAppointments,
  'GET /api/hsba': adminCatalog.listMedicalRecords,
  'POST /api/hsba': adminCatalog.createMedicalRecord,
  'GET /api/hsba/{recordId}': adminCatalog.getMedicalRecord,
  'PUT /api/hsba/{recordId}': adminCatalog.updateMedicalRecord,
  'DELETE /api/hsba/{recordId}': adminCatalog.deleteMedicalRecord,
  'GET /api/hsba/benhnhan/{patientId}': adminCatalog.listMedicalRecordsByPatient,
  'GET /api/hsba/benhnhan/{patientId}/tong-hop': getPatientMedicalTimeline,
  'GET /api/phieukham': legacyListExaminations,
  'GET /api/phieukham/nurse/queue': legacyListExaminations,
  'GET /api/donthuoc': legacyListPrescriptions,
  'GET /api/thuoc': adminCatalog.listMedicines,
  'POST /api/thuoc': adminCatalog.createMedicine,
  'GET /api/thuoc/{medicineId}': adminCatalog.getMedicine,
  'PUT /api/thuoc/{medicineId}': adminCatalog.updateMedicine,
  'DELETE /api/thuoc/{medicineId}': adminCatalog.deleteMedicine,
  'GET /api/thuoc/donvitinh': adminCatalog.listMedicineUnits,
  'POST /api/thuoc/donvitinh': adminCatalog.createMedicineUnit,
  'GET /api/thuoc/donvitinh/{unitId}': adminCatalog.getMedicineUnit,
  'PUT /api/thuoc/donvitinh/{unitId}': adminCatalog.updateMedicineUnit,
  'DELETE /api/thuoc/donvitinh/{unitId}': adminCatalog.deleteMedicineUnit,
  'GET /api/thuoc/nhomthuoc': adminCatalog.listMedicineGroups,
  'POST /api/thuoc/nhomthuoc': adminCatalog.createMedicineGroup,
  'GET /api/thuoc/nhomthuoc/{groupId}': adminCatalog.getMedicineGroup,
  'PUT /api/thuoc/nhomthuoc/{groupId}': adminCatalog.updateMedicineGroup,
  'DELETE /api/thuoc/nhomthuoc/{groupId}': adminCatalog.deleteMedicineGroup,
  'GET /api/lichlamviec': legacyListSchedules,
  'GET /api/lichlamviec/bacsi/{doctorId}': legacyDoctorSchedules,
  'GET /api/lichlamviec/nhansu/{staffId}': legacyStaffSchedules,
  'GET /api/catruc': legacyListShifts,
  'GET /api/hoadon': adminCatalog.listInvoices,
  'GET /api/hoadon/thongke': adminCatalog.invoiceStatistics,
  'GET /api/yeucauxetnghiem': labWorkflow.listLabRequests,
  'POST /api/yeucauxetnghiem': labWorkflow.createLabRequest,
  'GET /api/yeucauxetnghiem/{requestId}': labWorkflow.getLabRequest,
  'PUT /api/yeucauxetnghiem/{requestId}': labWorkflow.updateLabRequest,
  'DELETE /api/yeucauxetnghiem/{requestId}': labWorkflow.deleteLabRequest,
  'GET /api/phieuxetnghiem': labWorkflow.listLabResults,
  'POST /api/phieuxetnghiem': labWorkflow.createLabResult,
  'GET /api/phieuxetnghiem/{labResultId}': labWorkflow.getLabResult,
  'PUT /api/phieuxetnghiem/{labResultId}': labWorkflow.updateLabResult,
  'DELETE /api/phieuxetnghiem/{labResultId}': labWorkflow.deleteLabResult,
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
