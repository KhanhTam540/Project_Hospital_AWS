'use strict';

const { randomUUID } = require('crypto');
const {
  DeleteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
  TransactWriteCommand,
} = require('@aws-sdk/lib-dynamodb');

const { requireGroups } = require('../shared/auth');
const {
  ApiError,
  parseJsonBody,
  routeParameter,
  success,
} = require('../shared/http');
const {
  directKey,
  getDocumentClient,
  getTableName,
  normalizeId,
  nowIso,
} = require('../shared/dynamodb');

function requiredIdentifier(value, fieldName = 'id') {
  const identifier = String(value ?? '').trim();
  if (!identifier) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${fieldName} is required`);
  }
  if (!/^[A-Za-z0-9_-]+$/.test(identifier)) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      `${fieldName} contains unsupported characters`,
    );
  }
  return identifier;
}

function sameIdentifier(left, right) {
  return String(left || '').trim().toUpperCase() ===
    String(right || '').trim().toUpperCase();
}

function normalizeLabStatus(value, fallback = 'REQUESTED') {
  const status = String(value || fallback).trim().toUpperCase();
  const aliases = {
    CHO_TIEP_NHAN: 'REQUESTED',
    DA_TIEP_NHAN: 'ACCEPTED',
    DA_LAY_MAU: 'SAMPLE_COLLECTED',
    DA_HOAN_THANH: 'COMPLETED',
    DA_DUYET: 'APPROVED',
    DA_HUY: 'CANCELLED',
    NHAP: 'DRAFT',
  };
  return aliases[status] || status;
}

function requestDirectKey(requestId) {
  return directKey('LAB_REQUEST', requestId);
}

function resultDirectKey(resultId) {
  return directKey('LAB_RESULT', resultId);
}

function toLegacyRequest(item = {}) {
  return {
    ...item,
    maYeuCau: item.labRequestId,
    maBN: item.patientId,
    maHSBA: item.medicalRecordId,
    maXN: item.labTestId,
    maNS: item.assignedStaffId || null,
    ngayYeuCau: item.requestedAt,
    trangThai: item.status,
    ghiChu: item.note || '',
  };
}

function toLegacyResult(item = {}) {
  return {
    ...item,
    maPhieuXN: item.labResultId,
    maYeuCau: item.labRequestId,
    maBN: item.patientId,
    maHSBA: item.medicalRecordId,
    maXN: item.labTestId,
    maNS: item.performedBy || null,
    ngayThucHien: item.performedAt,
    ketQua: item.resultText,
    ghiChu: item.note || '',
    hinhAnh: item.documentId || null,
    trangThai: item.status,
  };
}

async function getDirect(entity, id) {
  const key = directKey(entity, id);
  const response = await getDocumentClient().send(
    new GetCommand({
      TableName: getTableName(),
      Key: key,
    }),
  );
  if (response.Item) return response.Item;

  // Catalog entities created by the existing admin module use sk = META.
  const legacyResponse = await getDocumentClient().send(
    new GetCommand({
      TableName: getTableName(),
      Key: { pk: key.pk, sk: 'META' },
    }),
  );
  if (legacyResponse.Item) return legacyResponse.Item;

  // The existing admin medical-record module stores records below PATIENT#...
  // and therefore has no direct RECORD#... item.
  if (String(entity).toUpperCase() === 'RECORD') {
    const scan = await getDocumentClient().send(
      new ScanCommand({
        TableName: getTableName(),
        FilterExpression: 'entityType = :type AND recordId = :id',
        ExpressionAttributeValues: {
          ':type': 'MEDICAL_RECORD',
          ':id': requiredIdentifier(id, 'recordId'),
        },
        Limit: 1,
      }),
    );
    return scan.Items?.[0] || null;
  }

  return null;
}

async function requireRecord(recordId, patientId) {
  const record = await getDirect('RECORD', recordId);
  if (!record) {
    throw new ApiError(404, 'MEDICAL_RECORD_NOT_FOUND', 'Medical record not found');
  }
  if (patientId && !sameIdentifier(record.patientId, patientId)) {
    throw new ApiError(
      409,
      'MEDICAL_RECORD_PATIENT_MISMATCH',
      'Medical record does not belong to the selected patient',
    );
  }
  return record;
}

async function requireLabTest(testId) {
  const test = await getDirect('LAB_TEST', testId);
  if (!test) {
    throw new ApiError(404, 'LAB_TEST_NOT_FOUND', 'Laboratory test not found');
  }
  return test;
}

async function scanEntity(entityType) {
  const response = await getDocumentClient().send(
    new ScanCommand({
      TableName: getTableName(),
      FilterExpression: 'entityType = :entityType AND sk = :metadata',
      ExpressionAttributeValues: {
        ':entityType': entityType,
        ':metadata': 'METADATA',
      },
    }),
  );
  return response.Items || [];
}

async function putWithRecordProjection(item, { conditionNew = false } = {}) {
  const projection = {
    ...item,
    pk: `RECORD#${item.medicalRecordId}`,
    sk: item.recordSk,
  };
  await getDocumentClient().send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: getTableName(),
            Item: item,
            ...(conditionNew
              ? { ConditionExpression: 'attribute_not_exists(pk)' }
              : {}),
          },
        },
        {
          Put: {
            TableName: getTableName(),
            Item: projection,
          },
        },
      ],
    }),
  );
}

async function createLabRequest(event) {
  const actor = requireGroups(event, ['BACSI']);
  const body = parseJsonBody(event);
  // Giữ nguyên chữ hoa/thường của UUID được lưu trong field. directKey()
  // vẫn tự chuẩn hóa phần key DynamoDB, còn so sánh quan hệ dùng sameIdentifier().
  const patientId = requiredIdentifier(body.patientId || body.maBN, 'patientId');
  const medicalRecordId = requiredIdentifier(
    body.medicalRecordId || body.recordId || body.maHSBA,
    'medicalRecordId',
  );
  const labTestId = requiredIdentifier(
    body.labTestId || body.testId || body.maXN,
    'labTestId',
  );
  await requireRecord(medicalRecordId, patientId);
  await requireLabTest(labTestId);

  const labRequestId = normalizeId(
    body.labRequestId || body.maYeuCau || `YCXN${randomUUID().replace(/-/g, '').slice(0, 12)}`,
    'labRequestId',
  );
  const timestamp = nowIso();
  const item = {
    ...requestDirectKey(labRequestId),
    entityType: 'LAB_REQUEST',
    labRequestId,
    patientId,
    medicalRecordId,
    recordId: medicalRecordId,
    labTestId,
    requestedBy: actor.sub,
    requestedAt: timestamp,
    assignedStaffId: body.assignedStaffId || body.maNS || null,
    priority: String(body.priority || body.mucDo || 'NORMAL').trim().toUpperCase(),
    status: 'REQUESTED',
    note: String(body.note || body.ghiChu || '').trim() || null,
    recordSk: `LAB_REQUEST#${timestamp}#${labRequestId}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };
  await putWithRecordProjection(item, { conditionNew: true });
  return success(toLegacyRequest(item), 201);
}

async function listLabRequests(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const query = event.queryStringParameters || {};
  let items = await scanEntity('LAB_REQUEST');
  const patientId = query.patientId || query.maBN;
  const medicalRecordId = query.medicalRecordId || query.maHSBA;
  const status = query.status || query.trangThai;
  if (patientId) {
    const normalized = requiredIdentifier(patientId, 'patientId');
    items = items.filter((item) => sameIdentifier(item.patientId, normalized));
  }
  if (medicalRecordId) {
    const normalized = requiredIdentifier(medicalRecordId, 'medicalRecordId');
    items = items.filter((item) =>
      sameIdentifier(item.medicalRecordId || item.recordId, normalized),
    );
  }
  if (status) {
    const normalized = normalizeLabStatus(status);
    items = items.filter((item) => item.status === normalized);
  }
  items.sort((a, b) => String(b.requestedAt).localeCompare(String(a.requestedAt)));
  return success(items.map(toLegacyRequest));
}

async function getLabRequest(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const requestId = normalizeId(routeParameter(event, 'requestId'), 'requestId');
  const item = await getDirect('LAB_REQUEST', requestId);
  if (!item) {
    throw new ApiError(404, 'LAB_REQUEST_NOT_FOUND', 'Laboratory request not found');
  }
  return success(toLegacyRequest(item));
}

const REQUEST_TRANSITIONS = Object.freeze({
  REQUESTED: new Set(['ACCEPTED', 'CANCELLED']),
  ACCEPTED: new Set(['SAMPLE_COLLECTED', 'CANCELLED']),
  SAMPLE_COLLECTED: new Set(['COMPLETED', 'CANCELLED']),
  COMPLETED: new Set([]),
  CANCELLED: new Set([]),
});

async function updateLabRequest(event) {
  const actor = requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const requestId = normalizeId(routeParameter(event, 'requestId'), 'requestId');
  const current = await getDirect('LAB_REQUEST', requestId);
  if (!current) {
    throw new ApiError(404, 'LAB_REQUEST_NOT_FOUND', 'Laboratory request not found');
  }
  const body = parseJsonBody(event);
  const nextStatus = normalizeLabStatus(body.status || body.trangThai, current.status);
  if (
    nextStatus !== current.status &&
    !REQUEST_TRANSITIONS[current.status]?.has(nextStatus) &&
    !actor.groups.includes('ADMIN')
  ) {
    throw new ApiError(
      409,
      'INVALID_LAB_REQUEST_TRANSITION',
      `Cannot move laboratory request from ${current.status} to ${nextStatus}`,
    );
  }
  const next = {
    ...current,
    assignedStaffId:
      body.assignedStaffId !== undefined || body.maNS !== undefined
        ? body.assignedStaffId || body.maNS || null
        : current.assignedStaffId,
    note:
      body.note !== undefined || body.ghiChu !== undefined
        ? String(body.note || body.ghiChu || '').trim() || null
        : current.note,
    status: nextStatus,
    updatedBy: actor.sub,
    updatedAt: nowIso(),
    version: Number(current.version || 1) + 1,
  };
  await putWithRecordProjection(next);
  return success(toLegacyRequest(next));
}

async function deleteLabRequest(event) {
  requireGroups(event, ['ADMIN', 'BACSI']);
  const requestId = normalizeId(routeParameter(event, 'requestId'), 'requestId');
  const current = await getDirect('LAB_REQUEST', requestId);
  if (!current) {
    throw new ApiError(404, 'LAB_REQUEST_NOT_FOUND', 'Laboratory request not found');
  }
  if (current.status === 'COMPLETED') {
    throw new ApiError(409, 'LAB_REQUEST_COMPLETED', 'A completed laboratory request cannot be deleted');
  }
  await getDocumentClient().send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Delete: {
            TableName: getTableName(),
            Key: requestDirectKey(requestId),
          },
        },
        {
          Delete: {
            TableName: getTableName(),
            Key: { pk: `RECORD#${current.medicalRecordId}`, sk: current.recordSk },
          },
        },
      ],
    }),
  );
  return success({ labRequestId: requestId, deleted: true });
}

async function createLabResult(event) {
  const actor = requireGroups(event, ['BACSI', 'NHANSU']);
  const body = parseJsonBody(event);
  const labRequestId = normalizeId(body.labRequestId || body.maYeuCau, 'labRequestId');
  const request = await getDirect('LAB_REQUEST', labRequestId);
  if (!request) {
    throw new ApiError(404, 'LAB_REQUEST_NOT_FOUND', 'Laboratory request not found');
  }
  const resultText = String(body.resultText || body.ketQua || '').trim();
  if (!resultText) {
    throw new ApiError(400, 'LAB_RESULT_REQUIRED', 'Laboratory result is required');
  }
  const requestedStatus = normalizeLabStatus(body.status || body.trangThai, 'DRAFT');
  if (requestedStatus === 'APPROVED' && !actor.groups.includes('BACSI')) {
    throw new ApiError(403, 'LAB_APPROVAL_REQUIRES_DOCTOR', 'Only a doctor can approve a laboratory result');
  }
  const labResultId = normalizeId(
    body.labResultId || body.maPhieuXN || `PXN${randomUUID().replace(/-/g, '').slice(0, 12)}`,
    'labResultId',
  );
  const timestamp = nowIso();
  const item = {
    ...resultDirectKey(labResultId),
    entityType: 'LAB_RESULT',
    labResultId,
    labRequestId,
    patientId: request.patientId,
    medicalRecordId: request.medicalRecordId,
    recordId: request.medicalRecordId,
    labTestId: request.labTestId,
    resultText,
    referenceRange: String(body.referenceRange || body.khoangThamChieu || '').trim() || null,
    unit: String(body.unit || body.donVi || '').trim() || null,
    note: String(body.note || body.ghiChu || '').trim() || null,
    documentId: body.documentId || body.hinhAnh || null,
    status: requestedStatus,
    performedBy: actor.sub,
    performedAt: body.performedAt || body.ngayThucHien || timestamp,
    approvedBy: requestedStatus === 'APPROVED' ? actor.sub : null,
    approvedAt: requestedStatus === 'APPROVED' ? timestamp : null,
    recordSk: `LAB_RESULT#${timestamp}#${labResultId}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };
  await putWithRecordProjection(item, { conditionNew: true });

  const nextRequest = {
    ...request,
    status: 'COMPLETED',
    labResultId,
    completedAt: timestamp,
    updatedAt: timestamp,
    version: Number(request.version || 1) + 1,
  };
  await putWithRecordProjection(nextRequest);
  return success(toLegacyResult(item), 201);
}

async function listLabResults(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const query = event.queryStringParameters || {};
  let items = await scanEntity('LAB_RESULT');
  const patientId = query.patientId || query.maBN;
  const medicalRecordId = query.medicalRecordId || query.maHSBA;
  if (patientId) {
    const normalized = requiredIdentifier(patientId, 'patientId');
    items = items.filter((item) => sameIdentifier(item.patientId, normalized));
  }
  if (medicalRecordId) {
    const normalized = requiredIdentifier(medicalRecordId, 'medicalRecordId');
    items = items.filter((item) =>
      sameIdentifier(item.medicalRecordId || item.recordId, normalized),
    );
  }
  items.sort((a, b) => String(b.performedAt).localeCompare(String(a.performedAt)));
  return success(items.map(toLegacyResult));
}

async function getLabResult(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const resultId = normalizeId(routeParameter(event, 'labResultId'), 'labResultId');
  const item = await getDirect('LAB_RESULT', resultId);
  if (!item) {
    throw new ApiError(404, 'LAB_RESULT_NOT_FOUND', 'Laboratory result not found');
  }
  return success(toLegacyResult(item));
}

async function updateLabResult(event) {
  const actor = requireGroups(event, ['BACSI', 'NHANSU']);
  const resultId = normalizeId(routeParameter(event, 'labResultId'), 'labResultId');
  const current = await getDirect('LAB_RESULT', resultId);
  if (!current) {
    throw new ApiError(404, 'LAB_RESULT_NOT_FOUND', 'Laboratory result not found');
  }
  const body = parseJsonBody(event);
  const nextStatus = normalizeLabStatus(body.status || body.trangThai, current.status);
  if (nextStatus === 'APPROVED' && !actor.groups.includes('BACSI')) {
    throw new ApiError(403, 'LAB_APPROVAL_REQUIRES_DOCTOR', 'Only a doctor can approve a laboratory result');
  }
  if (current.status === 'APPROVED' && !actor.groups.includes('BACSI')) {
    throw new ApiError(403, 'APPROVED_RESULT_LOCKED', 'An approved result can only be changed by a doctor');
  }
  const next = {
    ...current,
    resultText:
      body.resultText !== undefined || body.ketQua !== undefined
        ? String(body.resultText || body.ketQua || '').trim()
        : current.resultText,
    referenceRange:
      body.referenceRange !== undefined || body.khoangThamChieu !== undefined
        ? String(body.referenceRange || body.khoangThamChieu || '').trim() || null
        : current.referenceRange,
    unit:
      body.unit !== undefined || body.donVi !== undefined
        ? String(body.unit || body.donVi || '').trim() || null
        : current.unit,
    note:
      body.note !== undefined || body.ghiChu !== undefined
        ? String(body.note || body.ghiChu || '').trim() || null
        : current.note,
    documentId:
      body.documentId !== undefined || body.hinhAnh !== undefined
        ? body.documentId || body.hinhAnh || null
        : current.documentId,
    status: nextStatus,
    approvedBy: nextStatus === 'APPROVED' ? actor.sub : current.approvedBy,
    approvedAt: nextStatus === 'APPROVED' ? nowIso() : current.approvedAt,
    updatedBy: actor.sub,
    updatedAt: nowIso(),
    version: Number(current.version || 1) + 1,
  };
  if (!next.resultText) {
    throw new ApiError(400, 'LAB_RESULT_REQUIRED', 'Laboratory result is required');
  }
  await putWithRecordProjection(next);
  return success(toLegacyResult(next));
}

async function deleteLabResult(event) {
  requireGroups(event, ['ADMIN']);
  const resultId = normalizeId(routeParameter(event, 'labResultId'), 'labResultId');
  const current = await getDirect('LAB_RESULT', resultId);
  if (!current) {
    throw new ApiError(404, 'LAB_RESULT_NOT_FOUND', 'Laboratory result not found');
  }
  await getDocumentClient().send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Delete: {
            TableName: getTableName(),
            Key: resultDirectKey(resultId),
          },
        },
        {
          Delete: {
            TableName: getTableName(),
            Key: { pk: `RECORD#${current.medicalRecordId}`, sk: current.recordSk },
          },
        },
      ],
    }),
  );
  return success({ labResultId: resultId, deleted: true });
}

module.exports = {
  createLabRequest,
  createLabResult,
  deleteLabRequest,
  deleteLabResult,
  getLabRequest,
  getLabResult,
  listLabRequests,
  listLabResults,
  normalizeLabStatus,
  toLegacyRequest,
  toLegacyResult,
  updateLabRequest,
  updateLabResult,
};
