'use strict';

const { randomUUID } = require('node:crypto');
const {
  DeleteCommand,
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

function generatedId(prefix) {
  return `${prefix}${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
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

function toNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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


function sameIdentifier(left, right) {
  return String(left || '').trim().toUpperCase() ===
    String(right || '').trim().toUpperCase();
}

function uniqueByIdentifier(items = [], fieldName) {
  const result = new Map();

  for (const item of items) {
    const rawId = item?.[fieldName];
    const key = String(rawId || '').trim().toUpperCase();
    if (!key) continue;

    const current = result.get(key);
    if (!current) {
      result.set(key, item);
      continue;
    }

    // Ưu tiên bản ghi nằm dưới PATIENT# vì đây là projection có quan hệ
    // bệnh nhân rõ ràng; nếu không thì giữ bản có nhiều dữ liệu hơn.
    const currentPatientProjection = String(current.pk || '').startsWith('PATIENT#');
    const nextPatientProjection = String(item.pk || '').startsWith('PATIENT#');
    const currentScore = Object.values(current).filter((value) => value != null && value !== '').length;
    const nextScore = Object.values(item).filter((value) => value != null && value !== '').length;

    if (
      (!currentPatientProjection && nextPatientProjection) ||
      (currentPatientProjection === nextPatientProjection && nextScore > currentScore)
    ) {
      result.set(key, item);
    }
  }

  return [...result.values()];
}

async function scanMedicalRecords() {
  return uniqueByIdentifier(
    await scanEntityTypes(['MEDICAL_RECORD', 'RECORD']),
    'recordId',
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

function mapGender(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'NAM' || normalized === 'MALE') return 'Nam';
  if (normalized === 'NU' || normalized === 'NỮ' || normalized === 'FEMALE') {
    return 'Nữ';
  }
  return value || 'Khác';
}

function normalizeGender(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'NAM' || normalized === 'MALE') return 'NAM';
  if (normalized === 'NỮ' || normalized === 'NU' || normalized === 'FEMALE') {
    return 'NU';
  }
  return normalized || 'KHAC';
}

function mapPatient(item = {}) {
  return {
    maBN: item.patientId,
    maTK: item.accountUserId || null,
    hoTen: item.fullName || '',
    ngaySinh: item.birthDate || '',
    gioiTinh: mapGender(item.gender),
    diaChi: item.address || '',
    soDienThoai: item.phoneNumber || '',
    email: item.email || '',
    bhyt: item.healthInsurance || item.healthInsuranceNumber || '',
    trangThai: item.status === 'INACTIVE' ? 0 : 1,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

function mapMedicalRecord(item = {}, patientMap = new Map()) {
  const patient = patientMap.get(item.patientId);
  const recordId = item.recordId || item.medicalRecordId || null;
  const patientId = item.patientId || item.maBN || null;
  const diagnosis = item.diagnosis || item.chuanDoan || '';
  const notes = item.notes || item.note || item.ghiChu || '';
  const createdAt = item.createdAt || item.encounterAt || item.visitDate || null;

  return {
    maHSBA: recordId,
    recordId,
    medicalRecordId: recordId,
    maBN: patientId,
    patientId,
    maBS: item.doctorId || item.createdBy || null,
    doctorId: item.doctorId || item.createdBy || null,
    ngayLap: createdAt,
    createdAt,
    dotKhamBenh: item.encounterAt || item.visitDate || createdAt,
    lichSuBenh: item.medicalHistory || diagnosis,
    medicalHistory: item.medicalHistory || diagnosis,
    chuanDoan: diagnosis,
    diagnosis,
    ghiChu: notes,
    note: notes,
    trangThai: item.status || 'OPEN',
    status: item.status || 'OPEN',
    BenhNhan: patient ? mapPatient(patient) : null,
    patient: patient ? mapPatient(patient) : null,
  };
}

function mapMedicalRecordCover(patient = {}, record = null) {
  const patientId = patient.patientId;
  const createdAt =
    record?.createdAt ||
    patient.createdAt ||
    null;
  const updatedAt =
    record?.updatedAt ||
    record?.createdAt ||
    patient.updatedAt ||
    patient.createdAt ||
    null;

  return {
    maHSBA: record?.recordId || `HSBA-${patientId}`,
    recordId: record?.recordId || `HSBA-${patientId}`,
    maBN: patientId,
    patientId,
    ngayLap: createdAt,
    createdAt,
    ngayCapNhat: updatedAt,
    updatedAt,
    trangThai: record?.status || 'OPEN',
    status: record?.status || 'OPEN',
    coHoSoLuuTru: Boolean(record),
    hasStoredRecord: Boolean(record),
    chiTietDuocBaoVe: true,
    detailsProtected: true,
    BenhNhan: mapPatient(patient),
  };
}

function pickCanonicalMedicalRecord(records = []) {
  return [...records].sort((left, right) => {
    const leftDate = String(left.createdAt || left.encounterAt || '');
    const rightDate = String(right.createdAt || right.encounterAt || '');
    return leftDate.localeCompare(rightDate);
  })[0] || null;
}

function mapMedicineGroup(item = {}) {
  return {
    maNhom: item.groupId,
    tenNhom: item.groupName || '',
    moTa: item.description || '',
    trangThai: item.status === 'INACTIVE' ? 0 : 1,
  };
}

function mapMedicineUnit(item = {}) {
  return {
    maDVT: item.unitId,
    tenDVT: item.unitName || '',
    moTa: item.description || '',
    trangThai: item.status === 'INACTIVE' ? 0 : 1,
  };
}

function mapMedicine(item = {}, groupMap = new Map(), unitMap = new Map()) {
  const group = groupMap.get(item.groupId);
  const unit = unitMap.get(item.unitId);
  return {
    maThuoc: item.medicineId,
    tenThuoc: item.medicineName || '',
    tenHoatChat: item.activeIngredient || '',
    hamLuong: item.strength || '',
    soDangKy: item.registrationNumber || '',
    nuocSanXuat: item.country || '',
    hangSanXuat: item.manufacturer || '',
    giaNhap: toNumber(item.purchasePrice),
    giaBanLe: toNumber(item.retailPrice),
    giaBanBuon: toNumber(item.wholesalePrice),
    tonKhoToiThieu: toNumber(item.minimumStock),
    tonKhoHienTai: toNumber(item.currentStock),
    hanSuDung: item.expiryDate || '',
    maNhom: item.groupId || '',
    maDVT: item.unitId || item.unit || '',
    trangThai: item.status === 'INACTIVE' ? 0 : 1,
    NhomThuoc: group ? mapMedicineGroup(group) : null,
    DonViTinh: unit
      ? mapMedicineUnit(unit)
      : item.unit
        ? { maDVT: item.unit, tenDVT: item.unit }
        : null,
  };
}

function mapInvoice(item = {}) {
  return {
    maHD: item.invoiceId,
    maBN: item.patientId || null,
    maNS: item.staffId || null,
    ngayLap: item.createdAt || item.invoiceDate || null,
    tongTien: toNumber(item.totalAmount || item.total),
    trangThai: item.status || 'CHUA_THANH_TOAN',
    phuongThuc: item.paymentMethod || null,
  };
}

async function patientMap() {
  const patients = await scanEntityTypes(['PATIENT']);
  return new Map(patients.map((item) => [item.patientId, item]));
}

async function medicineRelations() {
  const [groups, units] = await Promise.all([
    scanEntityTypes(['MEDICINE_GROUP']),
    scanEntityTypes(['MEDICINE_UNIT']),
  ]);
  return {
    groupMap: new Map(groups.map((item) => [item.groupId, item])),
    unitMap: new Map(units.map((item) => [item.unitId, item])),
  };
}

async function listPatients(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const items = await scanEntityTypes(['PATIENT']);
  return success(
    items
      .map(mapPatient)
      .sort((a, b) => a.hoTen.localeCompare(b.hoTen, 'vi')),
  );
}

async function getPatient(event) {
  requireAuthenticated(event);
  const patientId = normalizeCode(routeParameter(event, 'patientId'), 'maBN');
  const item = await requireEntity(
    'PATIENT',
    'patientId',
    patientId,
    'PATIENT_NOT_FOUND',
    'Không tìm thấy bệnh nhân',
  );
  return success(mapPatient(item));
}

async function createPatient(event) {
  requireGroups(event, ['ADMIN']);
  const body = parseJsonBody(event);
  const patientId = body.maBN
    ? normalizeCode(body.maBN, 'maBN')
    : generatedId('BN');
  const now = nowIso();
  const item = {
    pk: `PATIENT#${patientId}`,
    sk: 'PROFILE',
    entityType: 'PATIENT',
    patientId,
    accountUserId: optionalString(body.maTK, 'maTK', { maxLength: 128 }),
    fullName: requiredString(body.hoTen, 'hoTen', { maxLength: 150 }),
    birthDate: optionalString(body.ngaySinh, 'ngaySinh', { maxLength: 10 }),
    gender: normalizeGender(body.gioiTinh),
    address: optionalString(body.diaChi, 'diaChi', { maxLength: 500 }),
    phoneNumber: optionalString(body.soDienThoai, 'soDienThoai', {
      maxLength: 20,
    }),
    email: optionalString(body.email, 'email', { maxLength: 254 }),
    healthInsurance: optionalString(body.bhyt, 'bhyt', { maxLength: 50 }),
    status: Number(body.trangThai ?? 1) === 0 ? 'INACTIVE' : 'ACTIVE',
    dataSource: 'ADMIN_WEB',
    createdAt: now,
    updatedAt: now,
  };
  await putItem(item, { createOnly: true });
  return success(mapPatient(item), 201);
}

async function updatePatient(event) {
  requireGroups(event, ['ADMIN']);
  const patientId = normalizeCode(routeParameter(event, 'patientId'), 'maBN');
  const existing = await requireEntity(
    'PATIENT',
    'patientId',
    patientId,
    'PATIENT_NOT_FOUND',
    'Không tìm thấy bệnh nhân',
  );
  const body = parseJsonBody(event);
  const updated = {
    ...existing,
    fullName: requiredString(body.hoTen || existing.fullName, 'hoTen', {
      maxLength: 150,
    }),
    birthDate:
      optionalString(body.ngaySinh, 'ngaySinh', { maxLength: 10 }) ??
      existing.birthDate,
    gender: body.gioiTinh ? normalizeGender(body.gioiTinh) : existing.gender,
    address:
      optionalString(body.diaChi, 'diaChi', { maxLength: 500 }) ??
      existing.address,
    phoneNumber:
      optionalString(body.soDienThoai, 'soDienThoai', { maxLength: 20 }) ??
      existing.phoneNumber,
    email:
      optionalString(body.email, 'email', { maxLength: 254 }) ?? existing.email,
    healthInsurance:
      optionalString(body.bhyt, 'bhyt', { maxLength: 50 }) ??
      existing.healthInsurance,
    status: Number(body.trangThai ?? 1) === 0 ? 'INACTIVE' : 'ACTIVE',
    updatedAt: nowIso(),
  };
  await putItem(updated);
  return success(mapPatient(updated));
}

async function deletePatient(event) {
  requireGroups(event, ['ADMIN']);
  const patientId = normalizeCode(routeParameter(event, 'patientId'), 'maBN');
  const existing = await requireEntity(
    'PATIENT',
    'patientId',
    patientId,
    'PATIENT_NOT_FOUND',
    'Không tìm thấy bệnh nhân',
  );
  const related = await scanAll();
  const blockingTypes = new Set([
    'APPOINTMENT',
    'MEDICAL_RECORD',
    'EXAMINATION',
    'PRESCRIPTION',
    'LAB_REQUEST',
    'LAB_RESULT',
    'INVOICE',
    'FEEDBACK',
  ]);
  const references = related.filter(
    (item) => blockingTypes.has(item.entityType) && item.patientId === patientId,
  );
  if (references.length > 0) {
    throw new ApiError(
      409,
      'PATIENT_IN_USE',
      `Không thể xóa bệnh nhân vì đang có ${references.length} dữ liệu liên quan`,
    );
  }
  await deleteItem(existing);

  if (existing.accountUserId) {
    const user = await findByField('USER', 'userId', existing.accountUserId);
    if (user?.patientId === patientId) {
      await documentClient.send(
        new UpdateCommand({
          TableName: getTableName(),
          Key: { pk: user.pk, sk: user.sk },
          UpdateExpression: 'SET updatedAt = :updatedAt REMOVE patientId',
          ExpressionAttributeValues: { ':updatedAt': nowIso() },
        }),
      );
    }
  }

  return success({ maBN: patientId, deleted: true });
}

async function listMedicalRecords(event) {
  const actor = requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const [items, patients] = await Promise.all([
    scanMedicalRecords(),
    scanEntityTypes(['PATIENT']),
  ]);

  if (hasGroup(actor, 'ADMIN')) {
    const recordsByPatient = new Map();

    for (const record of items) {
      if (!record.patientId) continue;
      const current = recordsByPatient.get(record.patientId) || [];
      current.push(record);
      recordsByPatient.set(record.patientId, current);
    }

    return success(
      patients
        .map((patient) =>
          mapMedicalRecordCover(
            patient,
            pickCanonicalMedicalRecord(
              recordsByPatient.get(patient.patientId) || [],
            ),
          ),
        )
        .sort((left, right) =>
          String(left.BenhNhan?.hoTen || '').localeCompare(
            String(right.BenhNhan?.hoTen || ''),
            'vi',
          ),
        ),
    );
  }

  const patientsById = new Map(
    patients.map((patient) => [patient.patientId, patient]),
  );

  return success(
    items
      .map((item) => mapMedicalRecord(item, patientsById))
      .sort((a, b) =>
        String(b.ngayLap || '').localeCompare(String(a.ngayLap || '')),
      ),
  );
}

async function listMedicalRecordsByPatient(event) {
  requireGroups(event, ['BACSI', 'NHANSU']);
  const patientId = normalizeCode(routeParameter(event, 'patientId'), 'maBN');
  const items = await scanMedicalRecords();
  const patients = await patientMap();
  return success(
    items
      .filter((item) => sameIdentifier(item.patientId, patientId))
      .map((item) => mapMedicalRecord(item, patients)),
  );
}

async function getMedicalRecord(event) {
  requireGroups(event, ['BACSI', 'NHANSU']);
  const recordId = normalizeCode(routeParameter(event, 'recordId'), 'maHSBA');
  const item = await requireEntity(
    ['MEDICAL_RECORD', 'RECORD'],
    'recordId',
    recordId,
    'MEDICAL_RECORD_NOT_FOUND',
    'Không tìm thấy hồ sơ bệnh án',
  );
  return success(mapMedicalRecord(item, await patientMap()));
}

async function createMedicalRecord(event) {
  requireGroups(event, ['BACSI', 'NHANSU']);
  const body = parseJsonBody(event);
  const patientId = normalizeCode(body.maBN, 'maBN');
  await requireEntity(
    'PATIENT',
    'patientId',
    patientId,
    'PATIENT_NOT_FOUND',
    'Không tìm thấy bệnh nhân',
  );

  const existingRecords = (await scanMedicalRecords())
    .filter((item) => sameIdentifier(item.patientId, patientId));
  if (existingRecords.length > 0) {
    throw new ApiError(
      409,
      'MEDICAL_RECORD_ALREADY_EXISTS',
      'Mỗi bệnh nhân chỉ được có một hồ sơ bệnh án. Hãy cập nhật hồ sơ hiện có thay vì tạo mới.',
    );
  }

  const recordId = body.maHSBA
    ? normalizeCode(body.maHSBA, 'maHSBA')
    : generatedId('HS');
  const now = nowIso();
  const item = {
    pk: `PATIENT#${patientId}`,
    sk: `MEDICAL_RECORD#${recordId}`,
    entityType: 'MEDICAL_RECORD',
    recordId,
    patientId,
    doctorId: body.maBS ? normalizeCode(body.maBS, 'maBS') : null,
    encounterAt:
      optionalString(body.dotKhamBenh, 'dotKhamBenh', { maxLength: 40 }) || now,
    medicalHistory: optionalString(body.lichSuBenh, 'lichSuBenh', {
      maxLength: 5000,
    }),
    diagnosis: optionalString(body.chuanDoan, 'chuanDoan', {
      maxLength: 2000,
    }),
    notes: optionalString(body.ghiChu, 'ghiChu', { maxLength: 5000 }),
    status: String(body.trangThai || 'OPEN').trim().toUpperCase(),
    dataSource: 'ADMIN_WEB',
    createdAt: now,
    updatedAt: now,
  };
  await putItem(item, { createOnly: true });
  return success(mapMedicalRecord(item, await patientMap()), 201);
}

async function updateMedicalRecord(event) {
  requireGroups(event, ['BACSI', 'NHANSU']);
  const recordId = normalizeCode(routeParameter(event, 'recordId'), 'maHSBA');
  const existing = await requireEntity(
    'MEDICAL_RECORD',
    'recordId',
    recordId,
    'MEDICAL_RECORD_NOT_FOUND',
    'Không tìm thấy hồ sơ bệnh án',
  );
  const body = parseJsonBody(event);
  const patientId = body.maBN
    ? normalizeCode(body.maBN, 'maBN')
    : existing.patientId;
  await requireEntity(
    'PATIENT',
    'patientId',
    patientId,
    'PATIENT_NOT_FOUND',
    'Không tìm thấy bệnh nhân',
  );

  const updated = {
    ...existing,
    pk: `PATIENT#${patientId}`,
    patientId,
    doctorId: body.maBS
      ? normalizeCode(body.maBS, 'maBS')
      : existing.doctorId,
    encounterAt:
      optionalString(body.dotKhamBenh, 'dotKhamBenh', { maxLength: 40 }) ??
      existing.encounterAt,
    medicalHistory:
      optionalString(body.lichSuBenh, 'lichSuBenh', { maxLength: 5000 }) ??
      existing.medicalHistory,
    diagnosis:
      optionalString(body.chuanDoan, 'chuanDoan', { maxLength: 2000 }) ??
      existing.diagnosis,
    notes:
      optionalString(body.ghiChu, 'ghiChu', { maxLength: 5000 }) ??
      existing.notes,
    status: String(body.trangThai || existing.status || 'OPEN')
      .trim()
      .toUpperCase(),
    updatedAt: nowIso(),
  };

  if (existing.pk !== updated.pk) {
    await deleteItem(existing);
  }
  await putItem(updated);
  return success(mapMedicalRecord(updated, await patientMap()));
}

async function deleteMedicalRecord(event) {
  requireGroups(event, ['BACSI', 'NHANSU']);
  const recordId = normalizeCode(routeParameter(event, 'recordId'), 'maHSBA');
  const existing = await requireEntity(
    'MEDICAL_RECORD',
    'recordId',
    recordId,
    'MEDICAL_RECORD_NOT_FOUND',
    'Không tìm thấy hồ sơ bệnh án',
  );
  const related = await scanAll();
  const blockingTypes = new Set([
    'EXAMINATION',
    'PRESCRIPTION',
    'LAB_REQUEST',
    'LAB_RESULT',
    'MEDICAL_DOCUMENT',
  ]);
  const references = related.filter(
    (item) => blockingTypes.has(item.entityType) && item.recordId === recordId,
  );
  if (references.length > 0) {
    throw new ApiError(
      409,
      'MEDICAL_RECORD_IN_USE',
      `Không thể xóa hồ sơ vì đang có ${references.length} dữ liệu liên quan`,
    );
  }
  await deleteItem(existing);
  return success({ maHSBA: recordId, deleted: true });
}

async function listMedicineGroups(event) {
  requireAuthenticated(event);
  const items = await scanEntityTypes(['MEDICINE_GROUP']);
  return success(items.map(mapMedicineGroup));
}

async function getMedicineGroup(event) {
  requireAuthenticated(event);
  const groupId = normalizeCode(routeParameter(event, 'groupId'), 'maNhom');
  const item = await requireEntity(
    'MEDICINE_GROUP',
    'groupId',
    groupId,
    'MEDICINE_GROUP_NOT_FOUND',
    'Không tìm thấy nhóm thuốc',
  );
  return success(mapMedicineGroup(item));
}

async function createMedicineGroup(event) {
  requireGroups(event, ['ADMIN']);
  const body = parseJsonBody(event);
  const groupId = body.maNhom
    ? normalizeCode(body.maNhom, 'maNhom')
    : generatedId('NT');
  const now = nowIso();
  const item = {
    pk: `MEDICINE_GROUP#${groupId}`,
    sk: 'META',
    entityType: 'MEDICINE_GROUP',
    groupId,
    groupName: requiredString(body.tenNhom, 'tenNhom', { maxLength: 150 }),
    description: optionalString(body.moTa, 'moTa', { maxLength: 1000 }),
    status: Number(body.trangThai ?? 1) === 0 ? 'INACTIVE' : 'ACTIVE',
    dataSource: 'ADMIN_WEB',
    createdAt: now,
    updatedAt: now,
  };
  await putItem(item, { createOnly: true });
  return success(mapMedicineGroup(item), 201);
}

async function updateMedicineGroup(event) {
  requireGroups(event, ['ADMIN']);
  const groupId = normalizeCode(routeParameter(event, 'groupId'), 'maNhom');
  const existing = await requireEntity(
    'MEDICINE_GROUP',
    'groupId',
    groupId,
    'MEDICINE_GROUP_NOT_FOUND',
    'Không tìm thấy nhóm thuốc',
  );
  const body = parseJsonBody(event);
  const updated = {
    ...existing,
    groupName: requiredString(body.tenNhom || existing.groupName, 'tenNhom', {
      maxLength: 150,
    }),
    description:
      optionalString(body.moTa, 'moTa', { maxLength: 1000 }) ??
      existing.description,
    status: Number(body.trangThai ?? 1) === 0 ? 'INACTIVE' : 'ACTIVE',
    updatedAt: nowIso(),
  };
  await putItem(updated);
  return success(mapMedicineGroup(updated));
}

async function deleteMedicineGroup(event) {
  requireGroups(event, ['ADMIN']);
  const groupId = normalizeCode(routeParameter(event, 'groupId'), 'maNhom');
  const existing = await requireEntity(
    'MEDICINE_GROUP',
    'groupId',
    groupId,
    'MEDICINE_GROUP_NOT_FOUND',
    'Không tìm thấy nhóm thuốc',
  );
  const medicines = await scanEntityTypes(['MEDICINE']);
  if (medicines.some((item) => item.groupId === groupId)) {
    throw new ApiError(
      409,
      'MEDICINE_GROUP_IN_USE',
      'Không thể xóa nhóm thuốc đang có thuốc sử dụng',
    );
  }
  await deleteItem(existing);
  return success({ maNhom: groupId, deleted: true });
}

async function listMedicineUnits(event) {
  requireAuthenticated(event);
  const items = await scanEntityTypes(['MEDICINE_UNIT']);
  return success(items.map(mapMedicineUnit));
}

async function getMedicineUnit(event) {
  requireAuthenticated(event);
  const unitId = normalizeCode(routeParameter(event, 'unitId'), 'maDVT');
  const item = await requireEntity(
    'MEDICINE_UNIT',
    'unitId',
    unitId,
    'MEDICINE_UNIT_NOT_FOUND',
    'Không tìm thấy đơn vị tính',
  );
  return success(mapMedicineUnit(item));
}

async function createMedicineUnit(event) {
  requireGroups(event, ['ADMIN']);
  const body = parseJsonBody(event);
  const unitId = body.maDVT
    ? normalizeCode(body.maDVT, 'maDVT')
    : generatedId('DVT');
  const now = nowIso();
  const item = {
    pk: `MEDICINE_UNIT#${unitId}`,
    sk: 'META',
    entityType: 'MEDICINE_UNIT',
    unitId,
    unitName: requiredString(body.tenDVT, 'tenDVT', { maxLength: 100 }),
    description: optionalString(body.moTa, 'moTa', { maxLength: 1000 }),
    status: Number(body.trangThai ?? 1) === 0 ? 'INACTIVE' : 'ACTIVE',
    dataSource: 'ADMIN_WEB',
    createdAt: now,
    updatedAt: now,
  };
  await putItem(item, { createOnly: true });
  return success(mapMedicineUnit(item), 201);
}

async function updateMedicineUnit(event) {
  requireGroups(event, ['ADMIN']);
  const unitId = normalizeCode(routeParameter(event, 'unitId'), 'maDVT');
  const existing = await requireEntity(
    'MEDICINE_UNIT',
    'unitId',
    unitId,
    'MEDICINE_UNIT_NOT_FOUND',
    'Không tìm thấy đơn vị tính',
  );
  const body = parseJsonBody(event);
  const updated = {
    ...existing,
    unitName: requiredString(body.tenDVT || existing.unitName, 'tenDVT', {
      maxLength: 100,
    }),
    description:
      optionalString(body.moTa, 'moTa', { maxLength: 1000 }) ??
      existing.description,
    status: Number(body.trangThai ?? 1) === 0 ? 'INACTIVE' : 'ACTIVE',
    updatedAt: nowIso(),
  };
  await putItem(updated);
  return success(mapMedicineUnit(updated));
}

async function deleteMedicineUnit(event) {
  requireGroups(event, ['ADMIN']);
  const unitId = normalizeCode(routeParameter(event, 'unitId'), 'maDVT');
  const existing = await requireEntity(
    'MEDICINE_UNIT',
    'unitId',
    unitId,
    'MEDICINE_UNIT_NOT_FOUND',
    'Không tìm thấy đơn vị tính',
  );
  const medicines = await scanEntityTypes(['MEDICINE']);
  if (medicines.some((item) => item.unitId === unitId || item.unit === unitId)) {
    throw new ApiError(
      409,
      'MEDICINE_UNIT_IN_USE',
      'Không thể xóa đơn vị tính đang có thuốc sử dụng',
    );
  }
  await deleteItem(existing);
  return success({ maDVT: unitId, deleted: true });
}

async function listMedicines(event) {
  requireAuthenticated(event);
  const items = await scanEntityTypes(['MEDICINE']);
  const { groupMap, unitMap } = await medicineRelations();
  return success(items.map((item) => mapMedicine(item, groupMap, unitMap)));
}

async function getMedicine(event) {
  requireAuthenticated(event);
  const medicineId = normalizeCode(routeParameter(event, 'medicineId'), 'maThuoc');
  const item = await requireEntity(
    'MEDICINE',
    'medicineId',
    medicineId,
    'MEDICINE_NOT_FOUND',
    'Không tìm thấy thuốc',
  );
  const { groupMap, unitMap } = await medicineRelations();
  return success(mapMedicine(item, groupMap, unitMap));
}

async function validateMedicineRelations(groupId, unitId) {
  if (groupId) {
    await requireEntity(
      'MEDICINE_GROUP',
      'groupId',
      groupId,
      'MEDICINE_GROUP_NOT_FOUND',
      'Không tìm thấy nhóm thuốc',
    );
  }
  if (unitId) {
    await requireEntity(
      'MEDICINE_UNIT',
      'unitId',
      unitId,
      'MEDICINE_UNIT_NOT_FOUND',
      'Không tìm thấy đơn vị tính',
    );
  }
}

function medicinePayload(body, existing = {}) {
  return {
    medicineName: requiredString(body.tenThuoc || existing.medicineName, 'tenThuoc', {
      maxLength: 200,
    }),
    activeIngredient:
      optionalString(body.tenHoatChat, 'tenHoatChat', { maxLength: 200 }) ??
      existing.activeIngredient,
    strength:
      optionalString(body.hamLuong, 'hamLuong', { maxLength: 100 }) ??
      existing.strength,
    registrationNumber:
      optionalString(body.soDangKy, 'soDangKy', { maxLength: 100 }) ??
      existing.registrationNumber,
    country:
      optionalString(body.nuocSanXuat, 'nuocSanXuat', { maxLength: 100 }) ??
      existing.country,
    manufacturer:
      optionalString(body.hangSanXuat, 'hangSanXuat', { maxLength: 200 }) ??
      existing.manufacturer,
    purchasePrice:
      body.giaNhap === undefined
        ? toNumber(existing.purchasePrice)
        : numberInRange(body.giaNhap, 'giaNhap', {
            min: 0,
            max: 1_000_000_000,
            required: true,
          }),
    retailPrice:
      body.giaBanLe === undefined
        ? toNumber(existing.retailPrice)
        : numberInRange(body.giaBanLe, 'giaBanLe', {
            min: 0,
            max: 1_000_000_000,
            required: true,
          }),
    wholesalePrice:
      body.giaBanBuon === undefined
        ? toNumber(existing.wholesalePrice)
        : numberInRange(body.giaBanBuon, 'giaBanBuon', {
            min: 0,
            max: 1_000_000_000,
            required: true,
          }),
    minimumStock:
      body.tonKhoToiThieu === undefined
        ? toNumber(existing.minimumStock)
        : numberInRange(body.tonKhoToiThieu, 'tonKhoToiThieu', {
            min: 0,
            max: 10_000_000,
            required: true,
          }),
    currentStock:
      body.tonKhoHienTai === undefined
        ? toNumber(existing.currentStock)
        : numberInRange(body.tonKhoHienTai, 'tonKhoHienTai', {
            min: 0,
            max: 10_000_000,
            required: true,
          }),
    expiryDate:
      optionalString(body.hanSuDung, 'hanSuDung', { maxLength: 10 }) ??
      existing.expiryDate,
    groupId: body.maNhom
      ? normalizeCode(body.maNhom, 'maNhom')
      : existing.groupId || null,
    unitId: body.maDVT
      ? normalizeCode(body.maDVT, 'maDVT')
      : existing.unitId || null,
    status: Number(body.trangThai ?? 1) === 0 ? 'INACTIVE' : 'ACTIVE',
  };
}

async function createMedicine(event) {
  requireGroups(event, ['ADMIN']);
  const body = parseJsonBody(event);
  const medicineId = body.maThuoc
    ? normalizeCode(body.maThuoc, 'maThuoc')
    : generatedId('TH');
  const payload = medicinePayload(body);
  await validateMedicineRelations(payload.groupId, payload.unitId);
  const now = nowIso();
  const item = {
    pk: `MEDICINE#${medicineId}`,
    sk: 'META',
    entityType: 'MEDICINE',
    medicineId,
    ...payload,
    dataSource: 'ADMIN_WEB',
    createdAt: now,
    updatedAt: now,
  };
  await putItem(item, { createOnly: true });
  const { groupMap, unitMap } = await medicineRelations();
  return success(mapMedicine(item, groupMap, unitMap), 201);
}

async function updateMedicine(event) {
  requireGroups(event, ['ADMIN']);
  const medicineId = normalizeCode(routeParameter(event, 'medicineId'), 'maThuoc');
  const existing = await requireEntity(
    'MEDICINE',
    'medicineId',
    medicineId,
    'MEDICINE_NOT_FOUND',
    'Không tìm thấy thuốc',
  );
  const body = parseJsonBody(event);
  const payload = medicinePayload(body, existing);
  await validateMedicineRelations(payload.groupId, payload.unitId);
  const updated = {
    ...existing,
    ...payload,
    updatedAt: nowIso(),
  };
  await putItem(updated);
  const { groupMap, unitMap } = await medicineRelations();
  return success(mapMedicine(updated, groupMap, unitMap));
}

async function deleteMedicine(event) {
  requireGroups(event, ['ADMIN']);
  const medicineId = normalizeCode(routeParameter(event, 'medicineId'), 'maThuoc');
  const existing = await requireEntity(
    'MEDICINE',
    'medicineId',
    medicineId,
    'MEDICINE_NOT_FOUND',
    'Không tìm thấy thuốc',
  );
  const related = await scanEntityTypes(['PRESCRIPTION_ITEM']);
  if (related.some((item) => item.medicineId === medicineId)) {
    throw new ApiError(
      409,
      'MEDICINE_IN_USE',
      'Không thể xóa thuốc đang được sử dụng trong đơn thuốc',
    );
  }
  await deleteItem(existing);
  return success({ maThuoc: medicineId, deleted: true });
}

async function listInvoices(event) {
  requireGroups(event, ['ADMIN', 'NHANSU']);
  const items = await scanEntityTypes(['INVOICE']);
  return success(items.map(mapInvoice));
}

async function invoiceStatistics(event) {
  requireGroups(event, ['ADMIN']);
  const query = event.queryStringParameters || {};
  const from = query.from || query.tuNgay || null;
  const to = query.to || query.denNgay || null;
  const invoices = await scanEntityTypes(['INVOICE']);
  const filtered = invoices.filter((item) => {
    const date = String(item.createdAt || item.invoiceDate || '').slice(0, 10);
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  });
  const paidStatuses = new Set(['DA_THANH_TOAN', 'PAID', 'COMPLETED']);
  const paid = filtered.filter((item) => paidStatuses.has(item.status));
  return success({
    tuNgay: from,
    denNgay: to,
    tongSo: filtered.length,
    tongTien: filtered.reduce(
      (sum, item) => sum + toNumber(item.totalAmount || item.total),
      0,
    ),
    daThanhToan: paid.length,
    chuaThanhToan: filtered.length - paid.length,
  });
}

module.exports = {
  createMedicalRecord,
  createMedicine,
  createMedicineGroup,
  createMedicineUnit,
  createPatient,
  deleteMedicalRecord,
  deleteMedicine,
  deleteMedicineGroup,
  deleteMedicineUnit,
  deletePatient,
  getMedicalRecord,
  getMedicine,
  getMedicineGroup,
  getMedicineUnit,
  getPatient,
  invoiceStatistics,
  listInvoices,
  listMedicalRecords,
  listMedicalRecordsByPatient,
  listMedicineGroups,
  listMedicineUnits,
  listMedicines,
  listPatients,
  mapInvoice,
  mapMedicalRecord,
  mapMedicine,
  mapMedicineGroup,
  mapMedicineUnit,
  mapPatient,
  updateMedicalRecord,
  updateMedicine,
  updateMedicineGroup,
  updateMedicineUnit,
  updatePatient,
};
