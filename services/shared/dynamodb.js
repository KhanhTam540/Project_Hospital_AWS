'use strict';

let documentClient;

/**
 * Khởi tạo DynamoDB Document Client khi thực sự cần sử dụng.
 * Cách này giúp unit test các hàm tạo key không cần AWS credentials.
 */
function getDocumentClient() {
  if (!documentClient) {
    const {
      DynamoDBClient,
    } = require('@aws-sdk/client-dynamodb');

    const {
      DynamoDBDocumentClient,
    } = require('@aws-sdk/lib-dynamodb');

    documentClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({}),
      {
        marshallOptions: {
          removeUndefinedValues: true,
          convertClassInstanceToMap: true,
        },
      },
    );
  }

  return documentClient;
}

/**
 * Lấy tên bảng DynamoDB từ Lambda environment variable.
 */
function getTableName() {
  const tableName = process.env.TABLE_NAME;

  if (!tableName) {
    throw new Error(
      'Missing TABLE_NAME environment variable',
    );
  }

  return tableName;
}

/**
 * Chuẩn hóa mã ID dùng trong DynamoDB key.
 */
function normalizeId(value, fieldName = 'id') {
  const id = String(value || '')
    .trim()
    .toUpperCase();

  if (!id) {
    throw new Error(`${fieldName} is required`);
  }

  if (!/^[A-Z0-9_-]+$/.test(id)) {
    throw new Error(
      `${fieldName} contains unsupported characters`,
    );
  }

  return id;
}

/*
 * =========================================================
 * KEY BUILDERS CỦA DỰ ÁN CŨ
 * Giữ lại để các test và các module hiện có tiếp tục hoạt động.
 * =========================================================
 */

function userKey(userId) {
  return {
    pk: `USER#${normalizeId(userId, 'userId')}`,
    sk: 'PROFILE',
  };
}

function departmentKey(departmentId) {
  return {
    pk: `DEPARTMENT#${normalizeId(
      departmentId,
      'departmentId',
    )}`,
    sk: 'META',
  };
}

function roomKey(departmentId, roomId) {
  return {
    pk: `DEPARTMENT#${normalizeId(
      departmentId,
      'departmentId',
    )}`,

    sk: `ROOM#${normalizeId(
      roomId,
      'roomId',
    )}`,
  };
}

function staffKey(staffId) {
  return {
    pk: `STAFF#${normalizeId(
      staffId,
      'staffId',
    )}`,
    sk: 'PROFILE',
  };
}

function doctorKey(doctorId) {
  return staffKey(doctorId);
}

function patientKey(patientId) {
  return {
    pk: `PATIENT#${normalizeId(
      patientId,
      'patientId',
    )}`,
    sk: 'PROFILE',
  };
}

function workScheduleKey(
  staffId,
  workDate,
  shiftId,
) {
  return {
    pk: `STAFF#${normalizeId(
      staffId,
      'staffId',
    )}`,

    sk:
      `SCHEDULE#${String(workDate).trim()}` +
      `#${normalizeId(shiftId, 'shiftId')}`,
  };
}

function appointmentKey(
  patientId,
  appointmentDateTime,
  appointmentId,
) {
  return {
    pk: `PATIENT#${normalizeId(
      patientId,
      'patientId',
    )}`,

    sk:
      `APPOINTMENT#${String(
        appointmentDateTime,
      ).trim()}` +
      `#${normalizeId(
        appointmentId,
        'appointmentId',
      )}`,
  };
}

function medicalRecordKey(
  patientId,
  recordId,
) {
  return {
    pk: `PATIENT#${normalizeId(
      patientId,
      'patientId',
    )}`,

    sk: `MEDICAL_RECORD#${normalizeId(
      recordId,
      'recordId',
    )}`,
  };
}

function prescriptionKey(
  recordId,
  prescriptionId,
) {
  return {
    pk: `MEDICAL_RECORD#${normalizeId(
      recordId,
      'recordId',
    )}`,

    sk: `PRESCRIPTION#${normalizeId(
      prescriptionId,
      'prescriptionId',
    )}`,
  };
}

function prescriptionItemKey(
  recordId,
  prescriptionId,
  medicineId,
) {
  return {
    pk: `MEDICAL_RECORD#${normalizeId(
      recordId,
      'recordId',
    )}`,

    sk:
      `PRESCRIPTION#${normalizeId(
        prescriptionId,
        'prescriptionId',
      )}` +
      `#MEDICINE#${normalizeId(
        medicineId,
        'medicineId',
      )}`,
  };
}

function medicineKey(medicineId) {
  return {
    pk: `MEDICINE#${normalizeId(
      medicineId,
      'medicineId',
    )}`,
    sk: 'META',
  };
}

/*
 * =========================================================
 * KEY BUILDERS MỚI CỦA MEDICAL WEEK 1
 * Được Medical Lambda mới sử dụng.
 * =========================================================
 */

function patientPk(patientId) {
  return `PATIENT#${normalizeId(
    patientId,
    'patientId',
  )}`;
}

function patientProfileKey(patientId) {
  return {
    pk: patientPk(patientId),
    sk: 'PROFILE',
  };
}

/**
 * Khóa trực tiếp dùng để tìm entity theo ID.
 *
 * Ví dụ:
 * directKey('DOCUMENT', 'DOC001')
 * → { pk: 'DOCUMENT#DOC001', sk: 'METADATA' }
 */
function directKey(entity, id) {
  const normalizedEntity = normalizeId(
    entity,
    'entity',
  );

  const normalizedId = normalizeId(
    id,
    'id',
  );

  return {
    pk: `${normalizedEntity}#${normalizedId}`,
    sk: 'METADATA',
  };
}

/**
 * Tạo sort key theo thời gian.
 *
 * Ví dụ:
 * RECORD#2026-06-25T08:00:00.000Z#HS001
 */
function chronologicalSk(
  prefix,
  createdAt,
  id,
) {
  const normalizedPrefix = normalizeId(
    prefix,
    'prefix',
  );

  const dateTime = String(createdAt || '')
    .trim();

  if (!dateTime) {
    throw new Error(
      'createdAt is required',
    );
  }

  return (
    `${normalizedPrefix}#${dateTime}` +
    `#${normalizeId(id, 'id')}`
  );
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = {
  /*
   * Getter giúp Medical Lambda vẫn có thể dùng:
   * const { documentClient } = require('../shared/dynamodb');
   */
  get documentClient() {
    return getDocumentClient();
  },

  getDocumentClient,
  getTableName,
  normalizeId,
  nowIso,

  // Các hàm cũ.
  userKey,
  departmentKey,
  roomKey,
  staffKey,
  doctorKey,
  patientKey,
  workScheduleKey,
  appointmentKey,
  medicalRecordKey,
  prescriptionKey,
  prescriptionItemKey,
  medicineKey,

  // Các hàm mới của Medical Week 1.
  patientPk,
  patientProfileKey,
  directKey,
  chronologicalSk,
};