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
const { hasGroup, requireGroups } = require('../shared/auth');
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
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const patientId = routeParameter(event, 'patientId');
  return success(await ensurePatient(patientId));
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
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const patientId = routeParameter(event, 'patientId');
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
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const patientId = routeParameter(event, 'patientId');
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

const routeHandlers = Object.freeze({
  'POST /api/patients': createPatient,
  'GET /api/patients/{patientId}': readPatient,
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
