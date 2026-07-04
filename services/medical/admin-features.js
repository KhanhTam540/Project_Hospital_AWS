'use strict';

const { randomUUID } = require('node:crypto');
const {
  DeleteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const {
  ApiError,
  parseJsonBody,
  routeParameter,
  success,
} = require('../shared/http');
const {
  getCurrentUser,
  hasGroup,
  requireAuthenticated,
  requireGroups,
} = require('../shared/auth');
const {
  numberInRange,
  optionalString,
  requiredString,
} = require('../shared/validation');
const { documentClient } = require('../shared/dynamodb');

function getTableName() {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) throw new Error('Missing TABLE_NAME environment variable');
  return tableName;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeCode(value, fieldName = 'id') {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${fieldName} là bắt buộc`);
  }
  if (!/^[A-Z0-9_-]+$/.test(normalized)) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      `${fieldName} chỉ được chứa chữ cái, chữ số, dấu gạch dưới hoặc gạch ngang`,
    );
  }
  return normalized;
}

function generatedId(prefix) {
  return `${prefix}${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

async function scanAll(params = {}) {
  const items = [];
  let exclusiveStartKey;

  do {
    const response = await documentClient.send(
      new ScanCommand({
        TableName: getTableName(),
        ...params,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );
    items.push(...(response.Items || []));
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
}

async function scanEntityTypes(entityTypes = []) {
  const allowed = new Set(entityTypes);
  const items = await scanAll({
    FilterExpression: 'attribute_exists(#entityType)',
    ExpressionAttributeNames: { '#entityType': 'entityType' },
  });
  return items.filter((item) => allowed.has(item.entityType));
}

async function getItem(pk, sk) {
  const response = await documentClient.send(
    new GetCommand({
      TableName: getTableName(),
      Key: { pk, sk },
      ConsistentRead: true,
    }),
  );
  return response.Item || null;
}

async function putItem(item, { createOnly = false } = {}) {
  await documentClient.send(
    new PutCommand({
      TableName: getTableName(),
      Item: item,
      ...(createOnly
        ? {
            ConditionExpression:
              'attribute_not_exists(pk) AND attribute_not_exists(sk)',
          }
        : {}),
    }),
  );
  return item;
}

async function deleteItem(item) {
  await documentClient.send(
    new DeleteCommand({
      TableName: getTableName(),
      Key: { pk: item.pk, sk: item.sk },
      ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)',
    }),
  );
}

async function findByField(entityTypes, fieldName, value) {
  const types = Array.isArray(entityTypes) ? entityTypes : [entityTypes];
  const items = await scanEntityTypes(types);
  return (
    items.find((item) => String(item[fieldName] || '') === String(value)) || null
  );
}

async function requireEntity(entityTypes, fieldName, value, code, message) {
  const item = await findByField(entityTypes, fieldName, value);
  if (!item) throw new ApiError(404, code, message);
  return item;
}

function mapDepartment(item = {}) {
  return {
    maKhoa: item.departmentId,
    tenKhoa: item.departmentName,
    moTa: item.description || '',
    hinhAnh: item.imageUrl || '',
    trangThai: item.status === 'INACTIVE' ? 0 : 1,
  };
}

function mapDoctor(item = {}, departmentMap = new Map()) {
  const department = departmentMap.get(item.departmentId);
  return {
    maBS: item.doctorId || item.staffId,
    maTK: item.accountUserId || null,
    maKhoa: item.departmentId || null,
    hoTen: item.fullName || '',
    chuyenMon: item.specialty || '',
    trinhDo: item.degree || '',
    chucVu: item.position || '',
    capBac: item.rank || '',
    hinhAnh: item.imageUrl || '',
    trangThai: item.status === 'INACTIVE' ? 0 : 1,
    Khoa: department ? mapDepartment(department) : null,
  };
}

function mapStaff(item = {}, departmentMap = new Map()) {
  const department = departmentMap.get(item.departmentId);
  return {
    maNS: item.staffId,
    maTK: item.accountUserId || null,
    maKhoa: item.departmentId || null,
    hoTen: item.fullName || '',
    loaiNS: item.staffType || '',
    capBac: item.rank || '',
    chuyenMon: item.specialty || '',
    trangThai: item.status === 'INACTIVE' ? 0 : 1,
    Khoa: department ? mapDepartment(department) : null,
  };
}

function mapLabTestType(item = {}) {
  return {
    maLoaiXN: item.testTypeId,
    tenLoai: item.name,
    moTa: item.description || '',
    trangThai: item.status === 'INACTIVE' ? 0 : 1,
  };
}

function mapLabTest(item = {}, typeMap = new Map()) {
  const type = typeMap.get(item.testTypeId);
  return {
    maXN: item.testId,
    maLoaiXN: item.testTypeId,
    tenXN: item.name,
    moTa: item.description || '',
    chiPhi: Number(item.price || 0),
    thoiGianTraKetQua: item.resultTime || '',
    donVi: item.unit || 'Lần',
    trangThai: item.status === 'INACTIVE' ? 0 : 1,
    LoaiXetNghiem: type ? mapLabTestType(type) : null,
  };
}

function mapFeedback(item = {}, patientMap = new Map()) {
  const patient = patientMap.get(item.patientId);
  return {
    maPH: item.feedbackId,
    maBN: item.patientId || null,
    tieuDe: item.title || '',
    noiDung: item.content || '',
    loai: item.feedbackType || 'PHAN_HOI',
    trangThai: item.status || 'CHO_XU_LY',
    phanHoi: item.reply || '',
    ngayGui: item.createdAt,
    ngayPhanHoi: item.repliedAt || null,
    BenhNhan: patient
      ? {
          maBN: patient.patientId,
          hoTen: patient.fullName || '',
          email: patient.email || '',
        }
      : null,
  };
}

function mapNews(item = {}) {
  return {
    maTin: item.newsId,
    tieuDe: item.title,
    tomTat: item.summary || '',
    noiDung: item.content || '',
    loai: item.category || 'TIN_TUC',
    hinhAnh: item.imageUrl || '',
    trangThai: item.status || 'AN',
    ngayDang: item.publishedAt || item.createdAt,
    luotXem: Number(item.viewCount || 0),
  };
}

async function departmentMap() {
  const departments = await scanEntityTypes(['DEPARTMENT']);
  return new Map(departments.map((item) => [item.departmentId, item]));
}

async function listPublicDepartments() {
  const items = await scanEntityTypes(['DEPARTMENT']);
  return success(
    items
      .filter((item) => item.status !== 'INACTIVE')
      .map(mapDepartment)
      .sort((a, b) => a.tenKhoa.localeCompare(b.tenKhoa, 'vi')),
  );
}

async function listPublicDoctors(event) {
  const query = event.queryStringParameters || {};
  const limit = Math.min(Math.max(Number(query.limit) || 8, 1), 50);
  const [items, departments] = await Promise.all([
    scanEntityTypes(['DOCTOR']),
    departmentMap(),
  ]);

  return success(
    items
      .filter((item) => item.status !== 'INACTIVE')
      .map((item) => mapDoctor(item, departments))
      .sort((a, b) => a.hoTen.localeCompare(b.hoTen, 'vi'))
      .slice(0, limit),
  );
}

async function listPublicNews(event) {
  const query = event.queryStringParameters || {};
  const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 50);
  const items = await scanEntityTypes(['NEWS']);

  return success(
    items
      .filter((item) => ['HIEN_THI', 'PUBLISHED'].includes(item.status))
      .sort((a, b) =>
        String(b.publishedAt || b.createdAt).localeCompare(
          String(a.publishedAt || a.createdAt),
        ),
      )
      .slice(0, limit)
      .map(mapNews),
  );
}

async function getPublicNews(event) {
  const newsId = normalizeCode(routeParameter(event, 'newsId'), 'maTin');
  const item = await requireEntity(
    'NEWS',
    'newsId',
    newsId,
    'NEWS_NOT_FOUND',
    'Không tìm thấy tin tức',
  );

  if (!['HIEN_THI', 'PUBLISHED'].includes(item.status)) {
    throw new ApiError(404, 'NEWS_NOT_FOUND', 'Không tìm thấy tin tức');
  }

  const response = await documentClient.send(
    new UpdateCommand({
      TableName: getTableName(),
      Key: { pk: item.pk, sk: item.sk },
      UpdateExpression: 'SET updatedAt = :updatedAt ADD viewCount :one',
      ExpressionAttributeValues: {
        ':one': 1,
        ':updatedAt': nowIso(),
      },
      ReturnValues: 'ALL_NEW',
    }),
  );

  return success(mapNews(response.Attributes || item));
}

async function listDoctors(event) {
  requireAuthenticated(event);
  const [items, departments] = await Promise.all([
    scanEntityTypes(['DOCTOR']),
    departmentMap(),
  ]);
  return success(items.map((item) => mapDoctor(item, departments)));
}

async function getDoctor(event) {
  requireAuthenticated(event);
  const doctorId = normalizeCode(routeParameter(event, 'doctorId'), 'maBS');
  const item = await requireEntity(
    'DOCTOR',
    'doctorId',
    doctorId,
    'DOCTOR_NOT_FOUND',
    'Không tìm thấy bác sĩ',
  );
  return success(mapDoctor(item, await departmentMap()));
}

async function createDoctor(event) {
  requireGroups(event, ['ADMIN']);
  const body = parseJsonBody(event);
  const doctorId = body.maBS
    ? normalizeCode(body.maBS, 'maBS')
    : generatedId('BS');
  const departmentId = normalizeCode(body.maKhoa, 'maKhoa');
  await requireEntity(
    'DEPARTMENT',
    'departmentId',
    departmentId,
    'DEPARTMENT_NOT_FOUND',
    'Không tìm thấy khoa',
  );
  const now = nowIso();
  const item = {
    pk: `STAFF#${doctorId}`,
    sk: 'PROFILE',
    entityType: 'DOCTOR',
    staffId: doctorId,
    doctorId,
    accountUserId: optionalString(body.maTK, 'maTK', { maxLength: 128 }),
    departmentId,
    fullName: requiredString(body.hoTen, 'hoTen', { maxLength: 150 }),
    specialty: optionalString(body.chuyenMon, 'chuyenMon', { maxLength: 150 }),
    degree: optionalString(body.trinhDo, 'trinhDo', { maxLength: 100 }),
    position: optionalString(body.chucVu, 'chucVu', { maxLength: 100 }),
    rank: optionalString(body.capBac, 'capBac', { maxLength: 100 }),
    imageUrl: optionalString(body.hinhAnh, 'hinhAnh', { maxLength: 1000 }),
    role: 'BACSI',
    status: 'ACTIVE',
    dataSource: 'CORE_API',
    createdAt: now,
    updatedAt: now,
  };
  await putItem(item, { createOnly: true });
  return success(mapDoctor(item, await departmentMap()), 201);
}

async function updateDoctor(event) {
  requireGroups(event, ['ADMIN']);
  const doctorId = normalizeCode(routeParameter(event, 'doctorId'), 'maBS');
  const existing = await requireEntity(
    'DOCTOR',
    'doctorId',
    doctorId,
    'DOCTOR_NOT_FOUND',
    'Không tìm thấy bác sĩ',
  );
  const body = parseJsonBody(event);
  const departmentId = normalizeCode(
    body.maKhoa || existing.departmentId,
    'maKhoa',
  );
  await requireEntity(
    'DEPARTMENT',
    'departmentId',
    departmentId,
    'DEPARTMENT_NOT_FOUND',
    'Không tìm thấy khoa',
  );

  const updated = {
    ...existing,
    departmentId,
    fullName: requiredString(body.hoTen || existing.fullName, 'hoTen', {
      maxLength: 150,
    }),
    specialty:
      optionalString(body.chuyenMon, 'chuyenMon', { maxLength: 150 }) ??
      existing.specialty,
    degree:
      optionalString(body.trinhDo, 'trinhDo', { maxLength: 100 }) ??
      existing.degree,
    position:
      optionalString(body.chucVu, 'chucVu', { maxLength: 100 }) ??
      existing.position,
    rank:
      optionalString(body.capBac, 'capBac', { maxLength: 100 }) ??
      existing.rank,
    imageUrl:
      optionalString(body.hinhAnh, 'hinhAnh', { maxLength: 1000 }) ??
      existing.imageUrl,
    status: Number(body.trangThai ?? 1) === 0 ? 'INACTIVE' : 'ACTIVE',
    updatedAt: nowIso(),
  };
  await putItem(updated);
  return success(mapDoctor(updated, await departmentMap()));
}

async function unlinkUserProfile({ accountUserId, doctorId, staffId }) {
  if (!accountUserId) return;
  const user = await findByField('USER', 'userId', accountUserId);
  if (!user) return;

  const removeExpressions = [];
  const names = {};
  if (doctorId && user.doctorId === doctorId) {
    names['#doctorId'] = 'doctorId';
    removeExpressions.push('#doctorId');
  }
  if (staffId && user.staffId === staffId) {
    names['#staffId'] = 'staffId';
    removeExpressions.push('#staffId');
  }
  if (removeExpressions.length === 0) return;

  await documentClient.send(
    new UpdateCommand({
      TableName: getTableName(),
      Key: { pk: user.pk, sk: user.sk },
      UpdateExpression: `SET updatedAt = :updatedAt REMOVE ${removeExpressions.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: { ':updatedAt': nowIso() },
    }),
  );
}

async function findPersonnelReferences(id, type) {
  const items = await scanAll();
  const referenceTypes = new Set([
    'WORK_SCHEDULE',
    'APPOINTMENT',
    'MEDICAL_RECORD',
    'EXAMINATION',
    'PRESCRIPTION',
    'LAB_REQUEST',
    'LAB_RESULT',
  ]);

  return items.filter((item) => {
    if (!referenceTypes.has(item.entityType)) return false;
    if (type === 'DOCTOR') {
      return [item.doctorId, item.staffId, item.createdByDoctorId].includes(id);
    }
    return [item.staffId, item.nurseId, item.technicianId, item.createdByStaffId].includes(id);
  });
}

async function deleteDoctor(event) {
  requireGroups(event, ['ADMIN']);
  const doctorId = normalizeCode(routeParameter(event, 'doctorId'), 'maBS');
  const existing = await requireEntity(
    'DOCTOR',
    'doctorId',
    doctorId,
    'DOCTOR_NOT_FOUND',
    'Không tìm thấy bác sĩ',
  );
  const references = await findPersonnelReferences(doctorId, 'DOCTOR');
  if (references.length > 0) {
    throw new ApiError(
      409,
      'DOCTOR_IN_USE',
      `Không thể xóa bác sĩ vì đang có ${references.length} dữ liệu lịch hoặc hồ sơ liên quan`,
    );
  }
  await deleteItem(existing);
  await unlinkUserProfile({
    accountUserId: existing.accountUserId,
    doctorId,
  });
  return success({ maBS: doctorId, deleted: true });
}

async function listStaff(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const [items, departments] = await Promise.all([
    scanEntityTypes(['STAFF']),
    departmentMap(),
  ]);
  return success(items.map((item) => mapStaff(item, departments)));
}

async function getStaff(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const staffId = normalizeCode(routeParameter(event, 'staffId'), 'maNS');
  const item = await requireEntity(
    'STAFF',
    'staffId',
    staffId,
    'STAFF_NOT_FOUND',
    'Không tìm thấy nhân sự',
  );
  return success(mapStaff(item, await departmentMap()));
}

async function createStaff(event) {
  requireGroups(event, ['ADMIN']);
  const body = parseJsonBody(event);
  const staffId = body.maNS
    ? normalizeCode(body.maNS, 'maNS')
    : generatedId('NS');
  const departmentId = normalizeCode(body.maKhoa, 'maKhoa');
  await requireEntity(
    'DEPARTMENT',
    'departmentId',
    departmentId,
    'DEPARTMENT_NOT_FOUND',
    'Không tìm thấy khoa',
  );
  const now = nowIso();
  const item = {
    pk: `STAFF#${staffId}`,
    sk: 'PROFILE',
    entityType: 'STAFF',
    staffId,
    accountUserId: optionalString(body.maTK, 'maTK', { maxLength: 128 }),
    departmentId,
    fullName: requiredString(body.hoTen, 'hoTen', { maxLength: 150 }),
    staffType: requiredString(body.loaiNS, 'loaiNS', { maxLength: 30 }).toUpperCase(),
    rank: optionalString(body.capBac, 'capBac', { maxLength: 100 }),
    specialty: optionalString(body.chuyenMon, 'chuyenMon', { maxLength: 150 }),
    role: 'NHANSU',
    status: 'ACTIVE',
    dataSource: 'CORE_API',
    createdAt: now,
    updatedAt: now,
  };
  await putItem(item, { createOnly: true });
  return success(mapStaff(item, await departmentMap()), 201);
}

async function updateStaff(event) {
  requireGroups(event, ['ADMIN']);
  const staffId = normalizeCode(routeParameter(event, 'staffId'), 'maNS');
  const existing = await requireEntity(
    'STAFF',
    'staffId',
    staffId,
    'STAFF_NOT_FOUND',
    'Không tìm thấy nhân sự',
  );
  const body = parseJsonBody(event);
  const departmentId = normalizeCode(
    body.maKhoa || existing.departmentId,
    'maKhoa',
  );
  await requireEntity(
    'DEPARTMENT',
    'departmentId',
    departmentId,
    'DEPARTMENT_NOT_FOUND',
    'Không tìm thấy khoa',
  );
  const updated = {
    ...existing,
    departmentId,
    fullName: requiredString(body.hoTen || existing.fullName, 'hoTen', {
      maxLength: 150,
    }),
    staffType: requiredString(
      body.loaiNS || existing.staffType,
      'loaiNS',
      { maxLength: 30 },
    ).toUpperCase(),
    rank:
      optionalString(body.capBac, 'capBac', { maxLength: 100 }) ??
      existing.rank,
    specialty:
      optionalString(body.chuyenMon, 'chuyenMon', { maxLength: 150 }) ??
      existing.specialty,
    status: Number(body.trangThai ?? 1) === 0 ? 'INACTIVE' : 'ACTIVE',
    updatedAt: nowIso(),
  };
  await putItem(updated);
  return success(mapStaff(updated, await departmentMap()));
}

async function deleteStaff(event) {
  requireGroups(event, ['ADMIN']);
  const staffId = normalizeCode(routeParameter(event, 'staffId'), 'maNS');
  const existing = await requireEntity(
    'STAFF',
    'staffId',
    staffId,
    'STAFF_NOT_FOUND',
    'Không tìm thấy nhân sự',
  );
  const references = await findPersonnelReferences(staffId, 'STAFF');
  if (references.length > 0) {
    throw new ApiError(
      409,
      'STAFF_IN_USE',
      `Không thể xóa nhân sự vì đang có ${references.length} dữ liệu lịch hoặc hồ sơ liên quan`,
    );
  }
  await deleteItem(existing);
  await unlinkUserProfile({
    accountUserId: existing.accountUserId,
    staffId,
  });
  return success({ maNS: staffId, deleted: true });
}

async function listLabTestTypes(event) {
  requireAuthenticated(event);
  const items = await scanEntityTypes(['LAB_TEST_TYPE']);
  return success(
    items
      .map(mapLabTestType)
      .sort((a, b) => a.tenLoai.localeCompare(b.tenLoai, 'vi')),
  );
}

async function getLabTestType(event) {
  requireAuthenticated(event);
  const typeId = normalizeCode(routeParameter(event, 'typeId'), 'maLoaiXN');
  const item = await requireEntity(
    'LAB_TEST_TYPE',
    'testTypeId',
    typeId,
    'LAB_TEST_TYPE_NOT_FOUND',
    'Không tìm thấy loại xét nghiệm',
  );
  return success(mapLabTestType(item));
}

async function createLabTestType(event) {
  requireGroups(event, ['ADMIN']);
  const body = parseJsonBody(event);
  const typeId = body.maLoaiXN
    ? normalizeCode(body.maLoaiXN, 'maLoaiXN')
    : generatedId('LXN');
  const now = nowIso();
  const item = {
    pk: `LAB_TEST_TYPE#${typeId}`,
    sk: 'META',
    entityType: 'LAB_TEST_TYPE',
    testTypeId: typeId,
    name: requiredString(body.tenLoai, 'tenLoai', { maxLength: 150 }),
    description: optionalString(body.moTa, 'moTa', { maxLength: 500 }),
    status: Number(body.trangThai ?? 1) === 0 ? 'INACTIVE' : 'ACTIVE',
    dataSource: 'CORE_API',
    createdAt: now,
    updatedAt: now,
  };
  await putItem(item, { createOnly: true });
  return success(mapLabTestType(item), 201);
}

async function updateLabTestType(event) {
  requireGroups(event, ['ADMIN']);
  const typeId = normalizeCode(routeParameter(event, 'typeId'), 'maLoaiXN');
  const existing = await requireEntity(
    'LAB_TEST_TYPE',
    'testTypeId',
    typeId,
    'LAB_TEST_TYPE_NOT_FOUND',
    'Không tìm thấy loại xét nghiệm',
  );
  const body = parseJsonBody(event);
  const updated = {
    ...existing,
    name: requiredString(body.tenLoai || existing.name, 'tenLoai', {
      maxLength: 150,
    }),
    description:
      optionalString(body.moTa, 'moTa', { maxLength: 500 }) ??
      existing.description,
    status: Number(body.trangThai ?? 1) === 0 ? 'INACTIVE' : 'ACTIVE',
    updatedAt: nowIso(),
  };
  await putItem(updated);
  return success(mapLabTestType(updated));
}

async function deleteLabTestType(event) {
  requireGroups(event, ['ADMIN']);
  const typeId = normalizeCode(routeParameter(event, 'typeId'), 'maLoaiXN');
  const existing = await requireEntity(
    'LAB_TEST_TYPE',
    'testTypeId',
    typeId,
    'LAB_TEST_TYPE_NOT_FOUND',
    'Không tìm thấy loại xét nghiệm',
  );
  const tests = await scanEntityTypes(['LAB_TEST']);
  if (tests.some((item) => item.testTypeId === typeId)) {
    throw new ApiError(
      409,
      'LAB_TEST_TYPE_IN_USE',
      'Không thể xóa loại xét nghiệm đang có xét nghiệm sử dụng',
    );
  }
  await deleteItem(existing);
  return success({ maLoaiXN: typeId, deleted: true });
}

async function listLabTests(event) {
  requireAuthenticated(event);
  const [items, types] = await Promise.all([
    scanEntityTypes(['LAB_TEST']),
    scanEntityTypes(['LAB_TEST_TYPE']),
  ]);
  const typeMap = new Map(types.map((item) => [item.testTypeId, item]));
  return success(items.map((item) => mapLabTest(item, typeMap)));
}

async function getLabTest(event) {
  requireAuthenticated(event);
  const testId = normalizeCode(routeParameter(event, 'testId'), 'maXN');
  const item = await requireEntity(
    'LAB_TEST',
    'testId',
    testId,
    'LAB_TEST_NOT_FOUND',
    'Không tìm thấy xét nghiệm',
  );
  const types = await scanEntityTypes(['LAB_TEST_TYPE']);
  return success(
    mapLabTest(item, new Map(types.map((type) => [type.testTypeId, type]))),
  );
}

async function createLabTest(event) {
  requireGroups(event, ['ADMIN']);
  const body = parseJsonBody(event);
  const testId = body.maXN
    ? normalizeCode(body.maXN, 'maXN')
    : generatedId('XN');
  const typeId = normalizeCode(body.maLoaiXN, 'maLoaiXN');
  const type = await requireEntity(
    'LAB_TEST_TYPE',
    'testTypeId',
    typeId,
    'LAB_TEST_TYPE_NOT_FOUND',
    'Không tìm thấy loại xét nghiệm',
  );
  const now = nowIso();
  const item = {
    pk: `LAB_TEST#${testId}`,
    sk: 'META',
    entityType: 'LAB_TEST',
    testId,
    testTypeId: typeId,
    name: requiredString(body.tenXN, 'tenXN', { maxLength: 150 }),
    description: optionalString(body.moTa, 'moTa', { maxLength: 500 }),
    price: numberInRange(body.chiPhi, 'chiPhi', {
      min: 0,
      max: 1_000_000_000,
      required: true,
    }),
    resultTime: optionalString(body.thoiGianTraKetQua, 'thoiGianTraKetQua', {
      maxLength: 100,
    }),
    unit: optionalString(body.donVi, 'donVi', { maxLength: 50 }) || 'Lần',
    status: Number(body.trangThai ?? 1) === 0 ? 'INACTIVE' : 'ACTIVE',
    dataSource: 'CORE_API',
    createdAt: now,
    updatedAt: now,
  };
  await putItem(item, { createOnly: true });
  return success(mapLabTest(item, new Map([[typeId, type]])), 201);
}

async function updateLabTest(event) {
  requireGroups(event, ['ADMIN']);
  const testId = normalizeCode(routeParameter(event, 'testId'), 'maXN');
  const existing = await requireEntity(
    'LAB_TEST',
    'testId',
    testId,
    'LAB_TEST_NOT_FOUND',
    'Không tìm thấy xét nghiệm',
  );
  const body = parseJsonBody(event);
  const typeId = normalizeCode(
    body.maLoaiXN || existing.testTypeId,
    'maLoaiXN',
  );
  const type = await requireEntity(
    'LAB_TEST_TYPE',
    'testTypeId',
    typeId,
    'LAB_TEST_TYPE_NOT_FOUND',
    'Không tìm thấy loại xét nghiệm',
  );
  const updated = {
    ...existing,
    testTypeId: typeId,
    name: requiredString(body.tenXN || existing.name, 'tenXN', {
      maxLength: 150,
    }),
    description:
      optionalString(body.moTa, 'moTa', { maxLength: 500 }) ??
      existing.description,
    price:
      body.chiPhi === undefined
        ? existing.price
        : numberInRange(body.chiPhi, 'chiPhi', {
            min: 0,
            max: 1_000_000_000,
            required: true,
          }),
    resultTime:
      optionalString(body.thoiGianTraKetQua, 'thoiGianTraKetQua', {
        maxLength: 100,
      }) ?? existing.resultTime,
    unit:
      optionalString(body.donVi, 'donVi', { maxLength: 50 }) ?? existing.unit,
    status: Number(body.trangThai ?? 1) === 0 ? 'INACTIVE' : 'ACTIVE',
    updatedAt: nowIso(),
  };
  await putItem(updated);
  return success(mapLabTest(updated, new Map([[typeId, type]])));
}

async function deleteLabTest(event) {
  requireGroups(event, ['ADMIN']);
  const testId = normalizeCode(routeParameter(event, 'testId'), 'maXN');
  const existing = await requireEntity(
    'LAB_TEST',
    'testId',
    testId,
    'LAB_TEST_NOT_FOUND',
    'Không tìm thấy xét nghiệm',
  );
  const related = await scanEntityTypes([
    'LAB_REQUEST',
    'LAB_REQUEST_ITEM',
    'LAB_RESULT',
  ]);
  if (related.some((item) => item.testId === testId)) {
    throw new ApiError(
      409,
      'LAB_TEST_IN_USE',
      'Không thể xóa xét nghiệm đang được sử dụng trong yêu cầu hoặc kết quả',
    );
  }
  await deleteItem(existing);
  return success({ maXN: testId, deleted: true });
}

async function findCurrentPatientId(event) {
  const current = getCurrentUser(event);
  const users = await scanEntityTypes(['USER']);
  const email = String(current.email || '').trim().toLowerCase();
  const appUser = users.find(
    (item) =>
      item.cognitoSub === current.sub ||
      item.cognitoUsername === current.username ||
      (email && String(item.email || '').trim().toLowerCase() === email),
  );
  return appUser?.patientId || null;
}

async function assertPatientOwnership(event, patientId) {
  const current = getCurrentUser(event);
  if (!hasGroup(current, 'BENHNHAN')) return;
  const currentPatientId = await findCurrentPatientId(event);
  if (!currentPatientId || currentPatientId !== patientId) {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Bạn chỉ được truy cập phản hồi của chính mình',
    );
  }
}

async function feedbackPatientMap() {
  const patients = await scanEntityTypes(['PATIENT']);
  return new Map(patients.map((item) => [item.patientId, item]));
}

async function createFeedback(event) {
  requireGroups(event, ['ADMIN', 'NHANSU', 'BENHNHAN']);
  const body = parseJsonBody(event);
  const patientId = normalizeCode(body.maBN, 'maBN');
  await assertPatientOwnership(event, patientId);
  await requireEntity(
    'PATIENT',
    'patientId',
    patientId,
    'PATIENT_NOT_FOUND',
    'Không tìm thấy bệnh nhân',
  );
  const feedbackId = generatedId('PH');
  const now = nowIso();
  const item = {
    pk: `FEEDBACK#${feedbackId}`,
    sk: 'META',
    entityType: 'FEEDBACK',
    feedbackId,
    patientId,
    title:
      optionalString(body.tieuDe, 'tieuDe', { maxLength: 200 }) ||
      'Phản hồi từ bệnh nhân',
    content: requiredString(body.noiDung, 'noiDung', { maxLength: 5000 }),
    feedbackType:
      optionalString(body.loai, 'loai', { maxLength: 30 }) || 'PHAN_HOI',
    status: 'CHO_XU_LY',
    reply: '',
    repliedAt: null,
    createdAt: now,
    updatedAt: now,
    dataSource: 'CORE_API',
  };
  await putItem(item, { createOnly: true });
  return success(mapFeedback(item, await feedbackPatientMap()), 201);
}

async function listFeedback(event) {
  requireGroups(event, ['ADMIN']);
  const query = event.queryStringParameters || {};
  const items = await scanEntityTypes(['FEEDBACK']);
  const patientMap = await feedbackPatientMap();
  return success(
    items
      .filter((item) => !query.trangThai || item.status === query.trangThai)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map((item) => mapFeedback(item, patientMap)),
  );
}

async function listFeedbackByPatient(event) {
  requireGroups(event, ['ADMIN', 'NHANSU', 'BENHNHAN']);
  const patientId = normalizeCode(routeParameter(event, 'patientId'), 'maBN');
  await assertPatientOwnership(event, patientId);
  const items = await scanEntityTypes(['FEEDBACK']);
  const patientMap = await feedbackPatientMap();
  return success(
    items
      .filter((item) => item.patientId === patientId)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map((item) => mapFeedback(item, patientMap)),
  );
}

async function getFeedback(event) {
  requireGroups(event, ['ADMIN', 'NHANSU', 'BENHNHAN']);
  const feedbackId = normalizeCode(routeParameter(event, 'feedbackId'), 'maPH');
  const item = await requireEntity(
    'FEEDBACK',
    'feedbackId',
    feedbackId,
    'FEEDBACK_NOT_FOUND',
    'Không tìm thấy phản hồi',
  );
  await assertPatientOwnership(event, item.patientId);
  return success(mapFeedback(item, await feedbackPatientMap()));
}

async function updateFeedback(event) {
  requireGroups(event, ['ADMIN']);
  const feedbackId = normalizeCode(routeParameter(event, 'feedbackId'), 'maPH');
  const existing = await requireEntity(
    'FEEDBACK',
    'feedbackId',
    feedbackId,
    'FEEDBACK_NOT_FOUND',
    'Không tìm thấy phản hồi',
  );
  const body = parseJsonBody(event);
  const status = String(body.trangThai || existing.status)
    .trim()
    .toUpperCase();
  if (!['CHO_XU_LY', 'DANG_XU_LY', 'DA_XU_LY'].includes(status)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Trạng thái phản hồi không hợp lệ');
  }
  const reply =
    optionalString(body.phanHoi, 'phanHoi', { maxLength: 5000 }) ??
    existing.reply;
  const updated = {
    ...existing,
    reply,
    status,
    repliedAt: reply ? nowIso() : existing.repliedAt,
    updatedAt: nowIso(),
  };
  await putItem(updated);
  return success(mapFeedback(updated, await feedbackPatientMap()));
}

async function deleteFeedback(event) {
  requireGroups(event, ['ADMIN']);
  const feedbackId = normalizeCode(routeParameter(event, 'feedbackId'), 'maPH');
  const existing = await requireEntity(
    'FEEDBACK',
    'feedbackId',
    feedbackId,
    'FEEDBACK_NOT_FOUND',
    'Không tìm thấy phản hồi',
  );
  await deleteItem(existing);
  return success({ maPH: feedbackId, deleted: true });
}

async function feedbackStats(event) {
  requireGroups(event, ['ADMIN']);
  const items = await scanEntityTypes(['FEEDBACK']);
  return success({
    total: items.length,
    choXuLy: items.filter((item) => item.status === 'CHO_XU_LY').length,
    dangXuLy: items.filter((item) => item.status === 'DANG_XU_LY').length,
    daXuLy: items.filter((item) => item.status === 'DA_XU_LY').length,
  });
}

async function listNews(event) {
  requireGroups(event, ['ADMIN']);
  const query = event.queryStringParameters || {};
  const keyword = String(query.search || '').trim().toLowerCase();
  const items = await scanEntityTypes(['NEWS']);
  return success(
    items
      .filter((item) => !query.trangThai || item.status === query.trangThai)
      .filter((item) => !query.loai || item.category === query.loai)
      .filter(
        (item) =>
          !keyword ||
          String(item.title || '').toLowerCase().includes(keyword) ||
          String(item.summary || '').toLowerCase().includes(keyword),
      )
      .sort((a, b) =>
        String(b.publishedAt || b.createdAt).localeCompare(
          String(a.publishedAt || a.createdAt),
        ),
      )
      .map(mapNews),
  );
}

async function getNews(event) {
  requireGroups(event, ['ADMIN']);
  const newsId = normalizeCode(routeParameter(event, 'newsId'), 'maTin');
  const item = await requireEntity(
    'NEWS',
    'newsId',
    newsId,
    'NEWS_NOT_FOUND',
    'Không tìm thấy tin tức',
  );
  return success(mapNews(item));
}

function normalizeNewsStatus(value) {
  const status = String(value || 'HIEN_THI').trim().toUpperCase();
  const aliases = {
    PUBLISHED: 'HIEN_THI',
    HIDDEN: 'AN',
    DRAFT: 'AN',
  };
  const normalized = aliases[status] || status;
  if (!['HIEN_THI', 'AN'].includes(normalized)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Trạng thái tin tức không hợp lệ');
  }
  return normalized;
}

async function createNews(event) {
  const actor = requireGroups(event, ['ADMIN']);
  const body = parseJsonBody(event);
  const newsId = body.maTin
    ? normalizeCode(body.maTin, 'maTin')
    : generatedId('TIN');
  const status = normalizeNewsStatus(body.trangThai);
  const now = nowIso();
  const item = {
    pk: `NEWS#${newsId}`,
    sk: 'META',
    entityType: 'NEWS',
    newsId,
    title: requiredString(body.tieuDe, 'tieuDe', { maxLength: 300 }),
    summary: optionalString(body.tomTat, 'tomTat', { maxLength: 1000 }),
    content: requiredString(body.noiDung, 'noiDung', { maxLength: 100000 }),
    category: optionalString(body.loai, 'loai', { maxLength: 50 }) || 'TIN_TUC',
    imageUrl: optionalString(body.hinhAnh, 'hinhAnh', { maxLength: 1000 }),
    status,
    viewCount: 0,
    publishedAt: status === 'HIEN_THI' ? now : null,
    createdBy: actor.sub,
    createdAt: now,
    updatedAt: now,
    dataSource: 'CORE_API',
  };
  await putItem(item, { createOnly: true });
  return success(mapNews(item), 201);
}

async function updateNews(event) {
  requireGroups(event, ['ADMIN']);
  const newsId = normalizeCode(routeParameter(event, 'newsId'), 'maTin');
  const existing = await requireEntity(
    'NEWS',
    'newsId',
    newsId,
    'NEWS_NOT_FOUND',
    'Không tìm thấy tin tức',
  );
  const body = parseJsonBody(event);
  const status = normalizeNewsStatus(body.trangThai || existing.status);
  const updated = {
    ...existing,
    title: requiredString(body.tieuDe || existing.title, 'tieuDe', {
      maxLength: 300,
    }),
    summary:
      optionalString(body.tomTat, 'tomTat', { maxLength: 1000 }) ??
      existing.summary,
    content: requiredString(body.noiDung || existing.content, 'noiDung', {
      maxLength: 100000,
    }),
    category:
      optionalString(body.loai, 'loai', { maxLength: 50 }) ??
      existing.category,
    imageUrl:
      optionalString(body.hinhAnh, 'hinhAnh', { maxLength: 1000 }) ??
      existing.imageUrl,
    status,
    publishedAt:
      status === 'HIEN_THI'
        ? existing.publishedAt || nowIso()
        : existing.publishedAt,
    updatedAt: nowIso(),
  };
  await putItem(updated);
  return success(mapNews(updated));
}

async function deleteNews(event) {
  requireGroups(event, ['ADMIN']);
  const newsId = normalizeCode(routeParameter(event, 'newsId'), 'maTin');
  const existing = await requireEntity(
    'NEWS',
    'newsId',
    newsId,
    'NEWS_NOT_FOUND',
    'Không tìm thấy tin tức',
  );
  await deleteItem(existing);
  return success({ maTin: newsId, deleted: true });
}

module.exports = {
  createDoctor,
  createFeedback,
  createLabTest,
  createLabTestType,
  createNews,
  createStaff,
  deleteDoctor,
  deleteFeedback,
  deleteLabTest,
  deleteLabTestType,
  deleteNews,
  deleteStaff,
  feedbackStats,
  getDoctor,
  getFeedback,
  getLabTest,
  getLabTestType,
  getNews,
  getPublicNews,
  getStaff,
  listDoctors,
  listFeedback,
  listFeedbackByPatient,
  listLabTests,
  listLabTestTypes,
  listNews,
  listPublicDepartments,
  listPublicDoctors,
  listPublicNews,
  listStaff,
  mapDepartment,
  mapDoctor,
  mapFeedback,
  mapLabTest,
  mapLabTestType,
  mapNews,
  mapStaff,
  updateDoctor,
  updateFeedback,
  updateLabTest,
  updateLabTestType,
  updateNews,
  updateStaff,
};
