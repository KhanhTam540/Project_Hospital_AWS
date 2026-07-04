'use strict';

const { randomUUID } = require('node:crypto');
const {
  ValidationError,
  dateOnly,
  optionalString,
  requireEmail,
  requireOneOf,
  requiredString,
} = require('../shared/validation');

const SYSTEM_ROLES = Object.freeze([
  'ADMIN',
  'BACSI',
  'NHANSU',
  'BENHNHAN',
]);

const STAFF_TYPES = Object.freeze([
  'YT',
  'TN',
  'XN',
  'HC',
  'KT',
]);

const APPOINTMENT_STATUSES = Object.freeze([
  'CHO_THANH_TOAN',
  'DA_THANH_TOAN',
  'DA_KHAM',
  'DA_HUY',
]);

const ACTIVE_STATUSES = Object.freeze(['ACTIVE', 'INACTIVE']);

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeCode(value, fieldName = 'id') {
  const code = normalizeText(value).toUpperCase();
  if (!code) {
    throw new ValidationError(`${fieldName} là trường bắt buộc`);
  }
  if (!/^[A-Z0-9_-]+$/.test(code)) {
    throw new ValidationError(
      `${fieldName} chỉ được chứa chữ cái, chữ số, dấu gạch dưới và gạch ngang`,
    );
  }
  return code;
}

function slugifyVietnamese(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .toUpperCase();
}

function createId(prefix) {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
  return `${prefix}${suffix}`;
}

function createDepartmentId(name) {
  const slug = slugifyVietnamese(name).slice(0, 30) || createId('KHOA_');
  return slug.startsWith('KHOA_') ? slug : `KHOA_${slug}`;
}

function createDateTime(date, time) {
  const normalizedDate = dateOnly(date, 'ngayKham');
  const normalizedTime = requiredString(time, 'gioKham', { maxLength: 5 });

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(normalizedTime)) {
    throw new ValidationError('gioKham phải theo định dạng HH:mm');
  }

  return `${normalizedDate}T${normalizedTime}:00+07:00`;
}

function ensureFutureDateTime(dateTime, { allowPast = false } = {}) {
  const parsed = new Date(dateTime);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError('Ngày giờ không hợp lệ');
  }
  if (!allowPast && parsed.getTime() < Date.now() - 60_000) {
    throw new ValidationError('Không thể chọn ngày giờ trong quá khứ');
  }
  return dateTime;
}

function timeToMinutes(value) {
  const text = requiredString(value, 'time', { maxLength: 5 });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) {
    throw new ValidationError('Giờ phải theo định dạng HH:mm');
  }
  const [hours, minutes] = text.split(':').map(Number);
  return hours * 60 + minutes;
}

function isTimeWithinShift(time, shift) {
  if (!shift) return false;
  const value = timeToMinutes(time);
  const start = timeToMinutes(
    shift.startTime || shift.thoiGianBatDau,
  );
  const end = timeToMinutes(
    shift.endTime || shift.thoiGianKetThuc,
  );
  return value >= start && value < end;
}

function normalizeAccountPayload(body = {}, { isCreate = true } = {}) {
  const username = requiredString(
    body.tenDangNhap || body.username,
    'tenDangNhap',
    { minLength: 4, maxLength: 128 },
  );
  const email = requireEmail(body.email, 'email');
  const role = requireOneOf(
    body.maNhom || body.vaiTro || body.role,
    'maNhom',
    SYSTEM_ROLES,
  );
  const password = isCreate
    ? requiredString(
        body.matKhau || body.temporaryPassword || body.password,
        'matKhau',
        { minLength: 10, maxLength: 99 },
      )
    : null;

  if (
    isCreate &&
    !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(password)
  ) {
    throw new ValidationError(
      'Mật khẩu phải có chữ hoa, chữ thường, chữ số và ký tự đặc biệt',
    );
  }

  const departmentId = body.maKhoa
    ? normalizeCode(body.maKhoa, 'maKhoa')
    : null;

  if (['BACSI', 'NHANSU'].includes(role) && !departmentId) {
    throw new ValidationError('maKhoa là bắt buộc với bác sĩ và nhân sự');
  }

  const staffType = role === 'NHANSU'
    ? requireOneOf(body.loaiNS, 'loaiNS', STAFF_TYPES)
    : null;

  return {
    username,
    email,
    role,
    password,
    fullName: optionalString(body.hoTen || body.fullName, 'hoTen', {
      maxLength: 150,
    }),
    departmentId,
    staffType,
    rank: optionalString(body.capBac, 'capBac', { maxLength: 100 }),
    specialty: optionalString(body.chuyenMon, 'chuyenMon', {
      maxLength: 150,
    }),
    degree: optionalString(body.trinhDo, 'trinhDo', { maxLength: 100 }),
    position: optionalString(body.chucVu, 'chucVu', { maxLength: 100 }),
    birthDate: body.ngaySinh ? dateOnly(body.ngaySinh, 'ngaySinh') : null,
    gender: optionalString(body.gioiTinh, 'gioiTinh', { maxLength: 20 }),
    address: optionalString(body.diaChi, 'diaChi', { maxLength: 300 }),
    phoneNumber: optionalString(body.soDienThoai, 'soDienThoai', {
      maxLength: 20,
    }),
    healthInsurance: optionalString(body.bhyt, 'bhyt', { maxLength: 50 }),
  };
}

function normalizeDepartmentPayload(body = {}, id) {
  const departmentName = requiredString(
    body.tenKhoa || body.departmentName,
    'tenKhoa',
    { maxLength: 150 },
  );

  return {
    departmentId: id
      ? normalizeCode(id, 'maKhoa')
      : normalizeCode(
          body.maKhoa || createDepartmentId(departmentName),
          'maKhoa',
        ),
    departmentName,
    description: optionalString(body.moTa || body.description, 'moTa', {
      maxLength: 500,
    }),
    status: body.trangThai === 0
      ? 'INACTIVE'
      : requireOneOf(
          body.status || 'ACTIVE',
          'status',
          ACTIVE_STATUSES,
        ),
  };
}

function normalizeRoomPayload(body = {}, id) {
  const roomId = id
    ? normalizeCode(id, 'maPhong')
    : normalizeCode(
        body.maPhong || body.roomId || createId('PHONG_'),
        'maPhong',
      );

  return {
    roomId,
    departmentId: normalizeCode(
      body.maKhoa || body.departmentId,
      'maKhoa',
    ),
    roomName: requiredString(
      body.tenPhong || body.roomName,
      'tenPhong',
      { maxLength: 150 },
    ),
    description: optionalString(body.moTa || body.description, 'moTa', {
      maxLength: 500,
    }),
    status: body.trangThai === 0
      ? 'INACTIVE'
      : requireOneOf(body.status || 'ACTIVE', 'status', ACTIVE_STATUSES),
  };
}

function normalizeExternalClinicPayload(body = {}, id) {
  return {
    clinicId: id
      ? normalizeCode(id, 'maPKN')
      : normalizeCode(body.maPKN || createId('PKN_'), 'maPKN'),
    clinicName: requiredString(body.tenPKN, 'tenPKN', { maxLength: 150 }),
    address: optionalString(body.diaChi, 'diaChi', { maxLength: 300 }),
    phoneNumber: optionalString(body.soDienThoai, 'soDienThoai', {
      maxLength: 20,
    }),
    email: body.email ? requireEmail(body.email, 'email') : null,
    note: optionalString(body.ghiChu, 'ghiChu', { maxLength: 500 }),
    status: Number(body.trangThai ?? 1) === 1 ? 'ACTIVE' : 'INACTIVE',
  };
}

function normalizeDoctorPayload(body = {}, id) {
  return {
    doctorId: id
      ? normalizeCode(id, 'maBS')
      : normalizeCode(body.maBS || body.doctorId || createId('BS'), 'maBS'),
    accountUserId: optionalString(body.maTK || body.accountUserId, 'maTK', {
      maxLength: 128,
    }),
    departmentId: normalizeCode(
      body.maKhoa || body.departmentId,
      'maKhoa',
    ),
    fullName: requiredString(body.hoTen || body.fullName, 'hoTen', {
      maxLength: 150,
    }),
    specialty: optionalString(body.chuyenMon || body.specialty, 'chuyenMon', {
      maxLength: 150,
    }),
    degree: optionalString(body.trinhDo || body.degree, 'trinhDo', {
      maxLength: 100,
    }),
    position: optionalString(body.chucVu || body.position, 'chucVu', {
      maxLength: 100,
    }),
    rank: optionalString(body.capBac || body.rank, 'capBac', {
      maxLength: 100,
    }),
    status: body.trangThai === 0
      ? 'INACTIVE'
      : requireOneOf(body.status || 'ACTIVE', 'status', ACTIVE_STATUSES),
  };
}

function normalizeStaffPayload(body = {}, id) {
  return {
    staffId: id
      ? normalizeCode(id, 'maNS')
      : normalizeCode(body.maNS || body.staffId || createId('NS'), 'maNS'),
    accountUserId: optionalString(body.maTK || body.accountUserId, 'maTK', {
      maxLength: 128,
    }),
    departmentId: normalizeCode(
      body.maKhoa || body.departmentId,
      'maKhoa',
    ),
    fullName: requiredString(body.hoTen || body.fullName, 'hoTen', {
      maxLength: 150,
    }),
    staffType: requireOneOf(
      body.loaiNS || body.staffType,
      'loaiNS',
      STAFF_TYPES,
    ),
    specialty: optionalString(body.chuyenMon || body.specialty, 'chuyenMon', {
      maxLength: 150,
    }),
    rank: optionalString(body.capBac || body.rank, 'capBac', {
      maxLength: 100,
    }),
    status: body.trangThai === 0
      ? 'INACTIVE'
      : requireOneOf(body.status || 'ACTIVE', 'status', ACTIVE_STATUSES),
  };
}

function normalizeShiftPayload(body = {}, id) {
  const startTime = requiredString(
    body.thoiGianBatDau || body.startTime,
    'thoiGianBatDau',
    { maxLength: 5 },
  );
  const endTime = requiredString(
    body.thoiGianKetThuc || body.endTime,
    'thoiGianKetThuc',
    { maxLength: 5 },
  );

  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    throw new ValidationError('Thời gian kết thúc phải sau thời gian bắt đầu');
  }

  return {
    shiftId: id
      ? normalizeCode(id, 'maCa')
      : normalizeCode(body.maCa || body.shiftId || createId('CA_'), 'maCa'),
    shiftName: requiredString(body.tenCa || body.shiftName, 'tenCa', {
      maxLength: 100,
    }),
    startTime,
    endTime,
    status: body.trangThai === 0
      ? 'INACTIVE'
      : requireOneOf(body.status || 'ACTIVE', 'status', ACTIVE_STATUSES),
  };
}

function normalizeSchedulePayload(body = {}, id) {
  const staffId = normalizeCode(
    body.maBS || body.maNS || body.staffId,
    'maBS/maNS',
  );
  const shiftId = normalizeCode(body.maCa || body.shiftId, 'maCa');
  const workDate = dateOnly(body.ngayLamViec || body.workDate, 'ngayLamViec');

  return {
    scheduleId: id
      ? normalizeCode(id, 'maLichLV')
      : normalizeCode(body.maLichLV || body.scheduleId || createId('LLV'), 'maLichLV'),
    staffId,
    doctorId: body.maBS ? staffId : null,
    ownerType: body.maBS ? 'DOCTOR' : 'STAFF',
    shiftId,
    workDate,
    assignedByStaffId: body.maNS
      ? normalizeCode(body.maNS, 'maNS')
      : null,
    createForWeek: Boolean(body.createForWeek),
    status: requireOneOf(body.status || 'ACTIVE', 'status', ACTIVE_STATUSES),
  };
}


function normalizeAppointmentStatus(value) {
  const normalized = String(value || 'CHO_THANH_TOAN').trim().toUpperCase();
  const aliases = {
    PENDING: 'CHO_THANH_TOAN',
    CONFIRMED: 'DA_THANH_TOAN',
    COMPLETED: 'DA_KHAM',
    CANCELLED: 'DA_HUY',
    CANCELED: 'DA_HUY',
  };
  return aliases[normalized] || normalized;
}

function normalizeAppointmentPayload(body = {}, id) {
  const patientId = normalizeCode(body.maBN || body.patientId, 'maBN');
  const doctorId = body.maBS || body.doctorId
    ? normalizeCode(body.maBS || body.doctorId, 'maBS')
    : null;
  const appointmentDate = dateOnly(
    body.ngayKham || body.appointmentDate,
    'ngayKham',
  );
  const appointmentTime = requiredString(
    body.gioKham || body.appointmentTime,
    'gioKham',
    { maxLength: 5 },
  );
  const appointmentDateTime = ensureFutureDateTime(
    createDateTime(appointmentDate, appointmentTime),
    { allowPast: Boolean(body.allowPast) },
  );

  return {
    appointmentId: id
      ? normalizeCode(id, 'maLich')
      : normalizeCode(body.maLich || body.appointmentId || createId('LH'), 'maLich'),
    patientId,
    doctorId,
    departmentId: body.maKhoa || body.tenKhoa || body.departmentId
      ? normalizeCode(
          body.maKhoa || body.tenKhoa || body.departmentId,
          'maKhoa',
        )
      : null,
    appointmentDate,
    appointmentTime,
    appointmentDateTime,
    room: optionalString(body.phong || body.room, 'phong', { maxLength: 100 }),
    note: optionalString(body.ghiChu || body.note, 'ghiChu', { maxLength: 500 }),
    status: requireOneOf(
      normalizeAppointmentStatus(
        body.trangThai || body.status || 'CHO_THANH_TOAN',
      ),
      'trangThai',
      APPOINTMENT_STATUSES,
    ),
  };
}

function mapDepartment(item = {}) {
  return {
    maKhoa: item.departmentId,
    tenKhoa: item.departmentName,
    moTa: item.description || '',
    trangThai: item.status === 'INACTIVE' ? 0 : 1,
    departmentId: item.departmentId,
    departmentName: item.departmentName,
    description: item.description || '',
    status: item.status || 'ACTIVE',
  };
}

function mapRoom(item = {}) {
  return {
    maPhong: item.roomId,
    tenPhong: item.roomName,
    maKhoa: item.departmentId,
    moTa: item.description || '',
    trangThai: item.status === 'INACTIVE' ? 0 : 1,
    roomId: item.roomId,
    roomName: item.roomName,
    departmentId: item.departmentId,
    status: item.status || 'ACTIVE',
  };
}

function mapExternalClinic(item = {}) {
  return {
    maPKN: item.clinicId,
    tenPKN: item.clinicName,
    diaChi: item.address || '',
    soDienThoai: item.phoneNumber || '',
    email: item.email || '',
    ghiChu: item.note || '',
    trangThai: item.status === 'INACTIVE' ? 0 : 1,
  };
}

function mapDoctor(item = {}) {
  return {
    maBS: item.doctorId || item.staffId,
    maTK: item.accountUserId || null,
    maKhoa: item.departmentId || null,
    hoTen: item.fullName || '',
    chuyenMon: item.specialty || '',
    trinhDo: item.degree || '',
    chucVu: item.position || '',
    capBac: item.rank || '',
    trangThai: item.status === 'INACTIVE' ? 0 : 1,
    status: item.status || 'ACTIVE',
  };
}

function mapStaff(item = {}) {
  return {
    maNS: item.staffId,
    maTK: item.accountUserId || null,
    maKhoa: item.departmentId || null,
    hoTen: item.fullName || '',
    loaiNS: item.staffType || '',
    chuyenMon: item.specialty || '',
    capBac: item.rank || '',
    trangThai: item.status === 'INACTIVE' ? 0 : 1,
    status: item.status || 'ACTIVE',
  };
}

function mapShift(item = {}) {
  return {
    maCa: item.shiftId,
    tenCa: item.shiftName,
    thoiGianBatDau: item.startTime,
    thoiGianKetThuc: item.endTime,
    trangThai: item.status === 'INACTIVE' ? 0 : 1,
  };
}

function mapSchedule(item = {}, relations = {}) {
  const doctor = relations.doctors?.get(item.doctorId || item.staffId);
  const staff = relations.staff?.get(item.staffId);
  const shift = relations.shifts?.get(item.shiftId);

  return {
    maLichLV: item.scheduleId,
    maBS: item.doctorId || (item.ownerType === 'DOCTOR' ? item.staffId : null),
    maNS: item.assignedByStaffId || (item.ownerType === 'STAFF' ? item.staffId : null),
    maCa: item.shiftId,
    ngayLamViec: item.workDate,
    trangThai: item.status || 'ACTIVE',
    BacSi: doctor ? mapDoctor(doctor) : null,
    NhanSu: staff ? mapStaff(staff) : null,
    CaKham: shift ? mapShift(shift) : null,
  };
}

function mapAppointment(item = {}, relations = {}) {
  const doctor = relations.doctors?.get(item.doctorId);
  const patient = relations.patients?.get(item.patientId);

  return {
    maLich: item.appointmentId,
    maBN: item.patientId,
    maBS: item.doctorId || null,
    maKhoa: item.departmentId || null,
    ngayKham: item.appointmentDate,
    gioKham: item.appointmentTime,
    phong: item.room || '',
    ghiChu: item.note || '',
    trangThai: item.status || 'CHO_THANH_TOAN',
    hoTenBN: patient?.fullName || '',
    hoTenBS: doctor?.fullName || '',
    BenhNhan: patient
      ? {
          maBN: patient.patientId,
          hoTen: patient.fullName || '',
        }
      : null,
    BacSi: doctor ? mapDoctor(doctor) : null,
  };
}

module.exports = {
  ACTIVE_STATUSES,
  APPOINTMENT_STATUSES,
  STAFF_TYPES,
  SYSTEM_ROLES,
  createDateTime,
  createDepartmentId,
  createId,
  ensureFutureDateTime,
  isTimeWithinShift,
  mapAppointment,
  mapDepartment,
  mapDoctor,
  mapExternalClinic,
  mapRoom,
  mapSchedule,
  mapShift,
  mapStaff,
  normalizeAccountPayload,
  normalizeAppointmentPayload,
  normalizeAppointmentStatus,
  normalizeCode,
  normalizeDepartmentPayload,
  normalizeDoctorPayload,
  normalizeEmail,
  normalizeExternalClinicPayload,
  normalizeRoomPayload,
  normalizeSchedulePayload,
  normalizeShiftPayload,
  normalizeStaffPayload,
  normalizeText,
  slugifyVietnamese,
  timeToMinutes,
};
