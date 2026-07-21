'use strict';

const DATA_SOURCE = 'P2TB_DATASET_V2';
const VIETNAM_OFFSET = '+07:00';

function pad(value) {
  return String(value).padStart(2, '0');
}

function vietnamNowParts(baseDate = new Date()) {
  const shifted = new Date(baseDate.getTime() + 7 * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

function dateOnly(offsetDays = 0, baseDate = new Date()) {
  const parts = vietnamNowParts(baseDate);
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + offsetDays));
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

function vietnamDateTime(offsetDays, time = '08:00', baseDate = new Date()) {
  return `${dateOnly(offsetDays, baseDate)}T${time}:00${VIETNAM_OFFSET}`;
}

function isoUtc(offsetDays = 0, time = '01:00', baseDate = new Date()) {
  const date = dateOnly(offsetDays, baseDate);
  return new Date(`${date}T${time}:00${VIETNAM_OFFSET}`).toISOString();
}

function normalizeIdentity(identity) {
  if (!identity || !identity.email || !identity.sub) {
    throw new Error('Each identity must contain email and sub');
  }
  return {
    ...identity,
    email: String(identity.email).trim().toLowerCase(),
    sub: String(identity.sub).trim(),
  };
}

function directKey(entity, id) {
  return { pk: `${entity}#${id}`, sk: 'METADATA' };
}

function recordProjectionSk(createdAt, recordId) {
  return `RECORD#${createdAt}#${recordId}`;
}

function projection(entity, id, patientId, prefix, createdAt, payload) {
  const patientSk = `${prefix}#${createdAt}#${id}`;
  const direct = {
    ...payload,
    ...directKey(entity, id),
    patientSk,
  };
  const patient = {
    ...direct,
    pk: `PATIENT#${patientId}`,
    sk: patientSk,
  };
  return [direct, patient];
}

function appointmentItems({
  appointmentId,
  patientId,
  doctorId,
  departmentId,
  roomId,
  dateOffset,
  time,
  status,
  reason,
  createdAt,
  baseDate,
}) {
  const appointmentDate = dateOnly(dateOffset, baseDate);
  const appointmentDateTime = vietnamDateTime(dateOffset, time, baseDate);
  const common = {
    appointmentId,
    patientId,
    doctorId,
    departmentId,
    roomId,
    room: roomId,
    appointmentDate,
    appointmentTime: time,
    appointmentDateTime,
    reason,
    note: reason,
    status,
    dataSource: DATA_SOURCE,
    createdAt,
    updatedAt: createdAt,
  };

  const canonical = {
    pk: `APPOINTMENT#${appointmentId}`,
    sk: 'META',
    gsi1pk: `DOCTOR#${doctorId}`,
    gsi1sk: `APPOINTMENT#${appointmentDateTime}#${appointmentId}`,
    entityType: 'APPOINTMENT',
    ...common,
  };

  const patientRef = {
    ...canonical,
    pk: `PATIENT#${patientId}`,
    sk: `APPOINTMENT#${appointmentDateTime}#${appointmentId}`,
    entityType: 'APPOINTMENT_REF',
  };
  const doctorRef = {
    ...canonical,
    pk: `STAFF#${doctorId}`,
    sk: `APPOINTMENT#${appointmentDateTime}#${appointmentId}`,
    entityType: 'APPOINTMENT_REF',
  };
  const doctorSlot = {
    pk: `DOCTOR_SLOT#${doctorId}`,
    sk: appointmentDateTime,
    entityType: 'APPOINTMENT_SLOT',
    appointmentId,
    doctorId,
    dataSource: DATA_SOURCE,
    createdAt,
    updatedAt: createdAt,
  };
  const patientSlot = {
    pk: `PATIENT_SLOT#${patientId}`,
    sk: appointmentDateTime,
    entityType: 'APPOINTMENT_SLOT',
    appointmentId,
    patientId,
    dataSource: DATA_SOURCE,
    createdAt,
    updatedAt: createdAt,
  };
  return [canonical, patientRef, doctorRef, doctorSlot, patientSlot];
}

function buildDataset({ identities, baseDate = new Date() }) {
  const identityMap = new Map(
    identities.map((identity) => {
      const normalized = normalizeIdentity(identity);
      return [normalized.key, normalized];
    }),
  );

  const requireIdentity = (key) => {
    const identity = identityMap.get(key);
    if (!identity) throw new Error(`Missing identity ${key}`);
    return identity;
  };

  const now = new Date().toISOString();
  const createdPast = isoUtc(-30, '01:00', baseDate);
  const items = [];

  const departments = [
    ['KHOA_NOI', 'Khoa Nội', 'Khám và điều trị bệnh lý nội khoa'],
    ['KHOA_NGOAI', 'Khoa Ngoại', 'Khám và điều trị ngoại khoa'],
    ['KHOA_NHI', 'Khoa Nhi', 'Khám và điều trị cho trẻ em'],
    ['KHOA_XN', 'Khoa Xét nghiệm', 'Thực hiện xét nghiệm cận lâm sàng'],
  ];
  for (const [departmentId, departmentName, description] of departments) {
    items.push({
      pk: `DEPARTMENT#${departmentId}`,
      sk: 'META',
      entityType: 'DEPARTMENT',
      departmentId,
      departmentName,
      description,
      status: 'ACTIVE',
      dataSource: DATA_SOURCE,
      createdAt: createdPast,
      updatedAt: now,
    });
  }

  const rooms = [
    ['KHOA_NOI', 'PK_NOI_01', 'Phòng khám Nội 01'],
    ['KHOA_NOI', 'PK_NOI_02', 'Phòng khám Nội 02'],
    ['KHOA_NGOAI', 'PK_NGOAI_01', 'Phòng khám Ngoại 01'],
    ['KHOA_NGOAI', 'PK_NGOAI_02', 'Phòng khám Ngoại 02'],
    ['KHOA_NHI', 'PK_NHI_01', 'Phòng khám Nhi 01'],
    ['KHOA_XN', 'XN_01', 'Phòng xét nghiệm 01'],
    ['KHOA_XN', 'XN_02', 'Phòng xét nghiệm 02'],
  ];
  for (const [departmentId, roomId, roomName] of rooms) {
    items.push({
      pk: `DEPARTMENT#${departmentId}`,
      sk: `ROOM#${roomId}`,
      entityType: 'ROOM',
      roomId,
      departmentId,
      roomName,
      status: 'ACTIVE',
      dataSource: DATA_SOURCE,
      createdAt: createdPast,
      updatedAt: now,
    });
  }

  const shifts = [
    ['CA_SANG', 'Ca sáng', '07:00', '12:00'],
    ['CA_CHIEU', 'Ca chiều', '13:00', '18:00'],
    ['CA_TOI', 'Ca tối', '18:00', '21:00'],
  ];
  for (const [shiftId, shiftName, startTime, endTime] of shifts) {
    items.push({
      pk: `SHIFT#${shiftId}`,
      sk: 'META',
      entityType: 'SHIFT',
      shiftId,
      shiftName,
      startTime,
      endTime,
      status: 'ACTIVE',
      dataSource: DATA_SOURCE,
      createdAt: createdPast,
      updatedAt: now,
    });
  }

  const accounts = [
    {
      key: 'admin',
      role: 'ADMIN',
      fullName: 'Quản trị viên Dataset',
    },
    {
      key: 'doctor1',
      role: 'BACSI',
      fullName: 'BS. Nguyễn Minh An',
      doctorId: 'BS001',
      departmentId: 'KHOA_NOI',
      specialty: 'Nội tổng quát',
      degree: 'Bác sĩ chuyên khoa I',
    },
    {
      key: 'doctor2',
      role: 'BACSI',
      fullName: 'BS. Trần Thu Bình',
      doctorId: 'BS002',
      departmentId: 'KHOA_NGOAI',
      specialty: 'Ngoại tổng quát',
      degree: 'Thạc sĩ Y khoa',
    },
    {
      key: 'doctor3',
      role: 'BACSI',
      fullName: 'BS. Lê Hoàng Chi',
      doctorId: 'BS003',
      departmentId: 'KHOA_NHI',
      specialty: 'Nhi khoa',
      degree: 'Bác sĩ chuyên khoa I',
    },
    {
      key: 'staffReception',
      role: 'NHANSU',
      fullName: 'Nguyễn Thị Tiếp Nhận',
      staffId: 'NS001',
      staffType: 'TN',
      departmentId: 'KHOA_NOI',
    },
    {
      key: 'staffNurse',
      role: 'NHANSU',
      fullName: 'Trần Minh Điều Dưỡng',
      staffId: 'NS002',
      staffType: 'YT',
      departmentId: 'KHOA_NOI',
    },
    {
      key: 'staffLab',
      role: 'NHANSU',
      fullName: 'Phạm Thị Xét Nghiệm',
      staffId: 'NS003',
      staffType: 'XN',
      departmentId: 'KHOA_XN',
    },
  ];

  for (const account of accounts) {
    const identity = requireIdentity(account.key);
    const user = {
      pk: `USER#${identity.sub}`,
      sk: 'PROFILE',
      entityType: 'USER',
      userId: identity.sub,
      cognitoSub: identity.sub,
      cognitoUsername: identity.email,
      email: identity.email,
      fullName: account.fullName,
      role: account.role,
      doctorId: account.doctorId || null,
      staffId: account.staffId || null,
      departmentId: account.departmentId || null,
      staffType: account.staffType || null,
      status: 'ACTIVE',
      emailVerified: true,
      dataSource: DATA_SOURCE,
      createdAt: createdPast,
      updatedAt: now,
    };
    items.push(user);

    if (account.doctorId) {
      items.push({
        pk: `STAFF#${account.doctorId}`,
        sk: 'PROFILE',
        entityType: 'DOCTOR',
        staffId: account.doctorId,
        doctorId: account.doctorId,
        accountUserId: identity.sub,
        cognitoSub: identity.sub,
        cognitoUsername: identity.email,
        email: identity.email,
        fullName: account.fullName,
        role: 'BACSI',
        departmentId: account.departmentId,
        specialty: account.specialty,
        degree: account.degree,
        position: 'Bác sĩ điều trị',
        status: 'ACTIVE',
        dataSource: DATA_SOURCE,
        createdAt: createdPast,
        updatedAt: now,
      });
    }

    if (account.staffId) {
      items.push({
        pk: `STAFF#${account.staffId}`,
        sk: 'PROFILE',
        entityType: 'STAFF',
        staffId: account.staffId,
        accountUserId: identity.sub,
        cognitoSub: identity.sub,
        cognitoUsername: identity.email,
        email: identity.email,
        fullName: account.fullName,
        role: 'NHANSU',
        staffType: account.staffType,
        departmentId: account.departmentId,
        status: 'ACTIVE',
        dataSource: DATA_SOURCE,
        createdAt: createdPast,
        updatedAt: now,
      });
    }
  }

  const patients = [
    {
      key: 'patient1',
      patientId: 'BN001',
      citizenId: '079203000001',
      fullName: 'Nguyễn Văn An',
      birthDate: '1990-03-15',
      gender: 'NAM',
      phoneNumber: '0901000001',
      address: 'Quận 1, Thành phố Hồ Chí Minh',
      healthInsurance: 'DN401000001001',
    },
    {
      key: 'patient2',
      patientId: 'BN002',
      citizenId: '079203000002',
      fullName: 'Trần Thị Bình',
      birthDate: '1988-07-22',
      gender: 'NU',
      phoneNumber: '0901000002',
      address: 'Quận 3, Thành phố Hồ Chí Minh',
      healthInsurance: 'DN401000001002',
    },
    {
      key: 'patient3',
      patientId: 'BN003',
      citizenId: '079203000003',
      fullName: 'Lê Minh Châu',
      birthDate: '2016-11-09',
      gender: 'NU',
      phoneNumber: '0901000003',
      address: 'Thành phố Thủ Đức, Thành phố Hồ Chí Minh',
      healthInsurance: 'TE401000001003',
    },
    {
      key: 'patient4',
      patientId: 'BN004',
      citizenId: '079203000004',
      fullName: 'Phạm Quốc Dũng',
      birthDate: '1979-01-30',
      gender: 'NAM',
      phoneNumber: '0901000004',
      address: 'Quận Bình Thạnh, Thành phố Hồ Chí Minh',
      healthInsurance: 'DN401000001004',
    },
    {
      key: 'patient5',
      patientId: 'BN005',
      citizenId: '079203000005',
      fullName: 'Võ Ngọc Em',
      birthDate: '1995-05-18',
      gender: 'NU',
      phoneNumber: '0901000005',
      address: 'Quận Tân Bình, Thành phố Hồ Chí Minh',
      healthInsurance: 'DN401000001005',
    },
  ];

  for (const patient of patients) {
    const identity = requireIdentity(patient.key);
    const patientCreatedAt = isoUtc(-20, '02:00', baseDate);
    const recordCreatedAt = isoUtc(-19, '02:30', baseDate);
    const patientSk = recordProjectionSk(recordCreatedAt, patient.citizenId);

    items.push({
      pk: `USER#${identity.sub}`,
      sk: 'PROFILE',
      entityType: 'USER',
      userId: identity.sub,
      cognitoSub: identity.sub,
      cognitoUsername: identity.email,
      email: identity.email,
      fullName: patient.fullName,
      role: 'BENHNHAN',
      patientId: patient.patientId,
      citizenId: patient.citizenId,
      cccd: patient.citizenId,
      medicalRecordId: patient.citizenId,
      status: 'ACTIVE',
      emailVerified: true,
      dataSource: DATA_SOURCE,
      createdAt: patientCreatedAt,
      updatedAt: now,
    });

    items.push({
      pk: `PATIENT#${patient.patientId}`,
      sk: 'PROFILE',
      entityType: 'PATIENT',
      patientId: patient.patientId,
      accountUserId: identity.sub,
      cognitoSub: identity.sub,
      cognitoUsername: identity.email,
      email: identity.email,
      fullName: patient.fullName,
      birthDate: patient.birthDate,
      dateOfBirth: patient.birthDate,
      gender: patient.gender,
      phoneNumber: patient.phoneNumber,
      address: patient.address,
      healthInsurance: patient.healthInsurance,
      healthInsuranceNumber: patient.healthInsurance,
      citizenId: patient.citizenId,
      cccd: patient.citizenId,
      medicalRecordId: patient.citizenId,
      recordId: patient.citizenId,
      status: 'ACTIVE',
      dataSource: DATA_SOURCE,
      createdAt: patientCreatedAt,
      updatedAt: now,
    });

    items.push({
      pk: `UNIQUE#CCCD#${patient.citizenId}`,
      sk: 'LOCK',
      entityType: 'UNIQUE_CCCD',
      citizenId: patient.citizenId,
      userId: identity.sub,
      patientId: patient.patientId,
      dataSource: DATA_SOURCE,
      createdAt: patientCreatedAt,
      updatedAt: now,
    });

    const record = {
      entityType: 'RECORD',
      recordId: patient.citizenId,
      medicalRecordId: patient.citizenId,
      recordCode: patient.citizenId,
      citizenId: patient.citizenId,
      cccd: patient.citizenId,
      patientId: patient.patientId,
      patientName: patient.fullName,
      status: 'OPEN',
      diagnosis: '',
      medicalHistory: '',
      notes: 'Hồ sơ bệnh án khởi tạo theo CCCD',
      dataSource: DATA_SOURCE,
      createdBy: 'DATASET_V2',
      createdAt: recordCreatedAt,
      updatedAt: now,
      version: 1,
      patientSk,
    };
    items.push({ ...record, pk: `RECORD#${patient.citizenId}`, sk: 'METADATA' });
    items.push({ ...record, pk: `PATIENT#${patient.patientId}`, sk: patientSk });
  }

  const medicineGroups = [
    ['NT001', 'Giảm đau - hạ sốt', 'Thuốc giảm đau và hạ sốt thông dụng'],
    ['NT002', 'Kháng sinh', 'Thuốc kháng sinh theo chỉ định bác sĩ'],
    ['NT003', 'Tiêu hóa', 'Thuốc hỗ trợ và điều trị đường tiêu hóa'],
  ];
  for (const [groupId, groupName, description] of medicineGroups) {
    items.push({
      pk: `MEDICINE_GROUP#${groupId}`,
      sk: 'META',
      entityType: 'MEDICINE_GROUP',
      groupId,
      groupName,
      description,
      status: 'ACTIVE',
      dataSource: DATA_SOURCE,
      createdAt: createdPast,
      updatedAt: now,
    });
  }

  const medicineUnits = [
    ['DVT001', 'Viên'],
    ['DVT002', 'Gói'],
    ['DVT003', 'Chai'],
  ];
  for (const [unitId, unitName] of medicineUnits) {
    items.push({
      pk: `MEDICINE_UNIT#${unitId}`,
      sk: 'META',
      entityType: 'MEDICINE_UNIT',
      unitId,
      unitName,
      description: `Đơn vị ${unitName.toLowerCase()}`,
      status: 'ACTIVE',
      dataSource: DATA_SOURCE,
      createdAt: createdPast,
      updatedAt: now,
    });
  }

  const medicines = [
    ['TH001', 'Paracetamol 500mg', 'Paracetamol', '500mg', 'NT001', 'DVT001', 600, 1200, 1500, 500],
    ['TH002', 'Ibuprofen 400mg', 'Ibuprofen', '400mg', 'NT001', 'DVT001', 900, 1800, 2200, 320],
    ['TH003', 'Amoxicillin 500mg', 'Amoxicillin', '500mg', 'NT002', 'DVT001', 1300, 2500, 3000, 420],
    ['TH004', 'Azithromycin 500mg', 'Azithromycin', '500mg', 'NT002', 'DVT001', 8000, 15000, 18000, 150],
    ['TH005', 'Omeprazole 20mg', 'Omeprazole', '20mg', 'NT003', 'DVT001', 1200, 2600, 3200, 280],
    ['TH006', 'Oresol', 'ORS', 'Gói tiêu chuẩn', 'NT003', 'DVT002', 2200, 4500, 5000, 250],
  ];
  for (const [medicineId, medicineName, activeIngredient, strength, groupId, unitId, purchasePrice, wholesalePrice, retailPrice, currentStock] of medicines) {
    items.push({
      pk: `MEDICINE#${medicineId}`,
      sk: 'META',
      entityType: 'MEDICINE',
      medicineId,
      medicineName,
      activeIngredient,
      strength,
      groupId,
      unitId,
      unit: unitId,
      purchasePrice,
      wholesalePrice,
      retailPrice,
      minimumStock: 50,
      currentStock,
      expiryDate: dateOnly(365, baseDate),
      status: 'ACTIVE',
      dataSource: DATA_SOURCE,
      createdAt: createdPast,
      updatedAt: now,
    });
  }

  const labTypes = [
    ['LXN001', 'Huyết học', 'Xét nghiệm tế bào máu'],
    ['LXN002', 'Sinh hóa', 'Xét nghiệm chỉ số sinh hóa'],
    ['LXN003', 'Vi sinh', 'Xét nghiệm vi khuẩn và virus'],
  ];
  for (const [testTypeId, name, description] of labTypes) {
    items.push({
      pk: `LAB_TEST_TYPE#${testTypeId}`,
      sk: 'META',
      entityType: 'LAB_TEST_TYPE',
      testTypeId,
      name,
      description,
      status: 'ACTIVE',
      dataSource: DATA_SOURCE,
      createdAt: createdPast,
      updatedAt: now,
    });
  }

  const labTests = [
    ['XN001', 'LXN001', 'Công thức máu toàn phần', 150000, '2 giờ'],
    ['XN002', 'LXN002', 'Đường huyết lúc đói', 80000, '1 giờ'],
    ['XN003', 'LXN002', 'Chức năng gan', 220000, '4 giờ'],
    ['XN004', 'LXN002', 'Chức năng thận', 200000, '4 giờ'],
    ['XN005', 'LXN003', 'Test nhanh cúm A/B', 180000, '1 giờ'],
  ];
  for (const [testId, testTypeId, name, price, resultTime] of labTests) {
    items.push({
      pk: `LAB_TEST#${testId}`,
      sk: 'META',
      entityType: 'LAB_TEST',
      testId,
      testTypeId,
      name,
      description: name,
      price,
      resultTime,
      unit: 'Lần',
      status: 'ACTIVE',
      dataSource: DATA_SOURCE,
      createdAt: createdPast,
      updatedAt: now,
    });
  }

  const scheduleOwners = [
    ['BS001', 'BS001', 'DOCTOR', 'KHOA_NOI', 'CA_SANG'],
    ['BS002', 'BS002', 'DOCTOR', 'KHOA_NGOAI', 'CA_CHIEU'],
    ['BS003', 'BS003', 'DOCTOR', 'KHOA_NHI', 'CA_SANG'],
    ['NS001', null, 'STAFF', 'KHOA_NOI', 'CA_SANG'],
    ['NS002', null, 'STAFF', 'KHOA_NOI', 'CA_SANG'],
    ['NS003', null, 'STAFF', 'KHOA_XN', 'CA_SANG'],
  ];
  let scheduleCounter = 1;
  for (let offset = -2; offset <= 10; offset += 1) {
    const workDate = dateOnly(offset, baseDate);
    for (const [staffId, doctorId, ownerType, departmentId, shiftId] of scheduleOwners) {
      const scheduleId = `LLV${String(scheduleCounter).padStart(3, '0')}`;
      scheduleCounter += 1;
      items.push({
        pk: `STAFF#${staffId}`,
        sk: `SCHEDULE#${workDate}#${shiftId}`,
        gsi1pk: `STAFF#${staffId}`,
        gsi1sk: `SCHEDULE#${workDate}#${shiftId}#0`,
        entityType: 'WORK_SCHEDULE',
        scheduleId,
        staffId,
        doctorId,
        ownerType,
        departmentId,
        shiftId,
        workDate,
        status: 'ACTIVE',
        dataSource: DATA_SOURCE,
        createdAt: createdPast,
        updatedAt: now,
      });
    }
  }

  const appointmentCreated = isoUtc(-10, '03:00', baseDate);
  items.push(
    ...appointmentItems({
      appointmentId: 'LH001',
      patientId: 'BN001',
      doctorId: 'BS001',
      departmentId: 'KHOA_NOI',
      roomId: 'PK_NOI_01',
      dateOffset: -1,
      time: '08:00',
      status: 'DA_KHAM',
      reason: 'Sốt và đau họng',
      createdAt: appointmentCreated,
      baseDate,
    }),
    ...appointmentItems({
      appointmentId: 'LH002',
      patientId: 'BN002',
      doctorId: 'BS002',
      departmentId: 'KHOA_NGOAI',
      roomId: 'PK_NGOAI_01',
      dateOffset: -1,
      time: '14:00',
      status: 'DA_KHAM',
      reason: 'Đau vùng thượng vị',
      createdAt: appointmentCreated,
      baseDate,
    }),
    ...appointmentItems({
      appointmentId: 'LH003',
      patientId: 'BN003',
      doctorId: 'BS003',
      departmentId: 'KHOA_NHI',
      roomId: 'PK_NHI_01',
      dateOffset: 1,
      time: '08:00',
      status: 'DA_THANH_TOAN',
      reason: 'Khám ho kéo dài',
      createdAt: appointmentCreated,
      baseDate,
    }),
    ...appointmentItems({
      appointmentId: 'LH004',
      patientId: 'BN004',
      doctorId: 'BS001',
      departmentId: 'KHOA_NOI',
      roomId: 'PK_NOI_01',
      dateOffset: 1,
      time: '08:30',
      status: 'DA_THANH_TOAN',
      reason: 'Tái khám tăng huyết áp',
      createdAt: appointmentCreated,
      baseDate,
    }),
    ...appointmentItems({
      appointmentId: 'LH005',
      patientId: 'BN005',
      doctorId: 'BS002',
      departmentId: 'KHOA_NGOAI',
      roomId: 'PK_NGOAI_01',
      dateOffset: 2,
      time: '14:30',
      status: 'CHO_THANH_TOAN',
      reason: 'Đau khớp gối',
      createdAt: appointmentCreated,
      baseDate,
    }),
  );

  const exam1At = isoUtc(-1, '02:00', baseDate);
  const exam1Payload = {
    entityType: 'EXAMINATION',
    examinationId: 'EX001',
    patientId: 'BN001',
    medicalRecordId: '079203000001',
    recordId: '079203000001',
    actorId: requireIdentity('doctor1').sub,
    actorGroups: ['BACSI'],
    doctorId: 'BS001',
    vitals: { temperature: 38.2, bloodPressure: '120/80', heartRate: 88, weight: 62 },
    symptoms: 'Sốt, đau họng, ho nhẹ',
    diagnosis: 'Viêm họng cấp',
    treatment: 'Điều trị triệu chứng và theo dõi',
    advice: 'Uống nhiều nước, nghỉ ngơi và tái khám khi sốt kéo dài',
    status: 'COMPLETED',
    createdBy: requireIdentity('doctor1').sub,
    dataSource: DATA_SOURCE,
    createdAt: exam1At,
    updatedAt: exam1At,
    version: 1,
  };
  items.push(...projection('EXAMINATION', 'EX001', 'BN001', 'EXAM', exam1At, exam1Payload));

  const exam2At = isoUtc(-1, '08:00', baseDate);
  const exam2Payload = {
    entityType: 'EXAMINATION',
    examinationId: 'EX002',
    patientId: 'BN002',
    medicalRecordId: '079203000002',
    recordId: '079203000002',
    actorId: requireIdentity('doctor2').sub,
    actorGroups: ['BACSI'],
    doctorId: 'BS002',
    vitals: { temperature: 36.8, bloodPressure: '118/76', heartRate: 76, weight: 54 },
    symptoms: 'Đau thượng vị sau ăn',
    diagnosis: 'Viêm dạ dày',
    treatment: 'Thuốc giảm tiết acid và điều chỉnh chế độ ăn',
    advice: 'Hạn chế thức ăn cay, cà phê và tái khám sau 14 ngày',
    status: 'COMPLETED',
    createdBy: requireIdentity('doctor2').sub,
    dataSource: DATA_SOURCE,
    createdAt: exam2At,
    updatedAt: exam2At,
    version: 1,
  };
  items.push(...projection('EXAMINATION', 'EX002', 'BN002', 'EXAM', exam2At, exam2Payload));

  const prescription1At = isoUtc(-1, '02:20', baseDate);
  const prescription1 = {
    entityType: 'PRESCRIPTION',
    prescriptionId: 'DT001',
    patientId: 'BN001',
    doctorId: 'BS001',
    recordId: '079203000001',
    medicalRecordId: '079203000001',
    examinationId: 'EX001',
    medicineItems: [
      { medicineId: 'TH001', quantity: 10, dosage: 'Uống 1 viên khi sốt, tối đa 3 viên/ngày' },
      { medicineId: 'TH003', quantity: 14, dosage: 'Uống 1 viên mỗi 12 giờ sau ăn' },
    ],
    generalInstructions: 'Dùng thuốc đúng liều và tái khám nếu không giảm sau 3 ngày',
    status: 'ACTIVE',
    createdBy: requireIdentity('doctor1').sub,
    dataSource: DATA_SOURCE,
    createdAt: prescription1At,
    updatedAt: prescription1At,
    version: 1,
  };
  items.push(...projection('PRESCRIPTION', 'DT001', 'BN001', 'PRESCRIPTION', prescription1At, prescription1));

  const prescription2At = isoUtc(-1, '08:20', baseDate);
  const prescription2 = {
    entityType: 'PRESCRIPTION',
    prescriptionId: 'DT002',
    patientId: 'BN002',
    doctorId: 'BS002',
    recordId: '079203000002',
    medicalRecordId: '079203000002',
    examinationId: 'EX002',
    medicineItems: [
      { medicineId: 'TH005', quantity: 14, dosage: 'Uống 1 viên trước ăn sáng 30 phút' },
    ],
    generalInstructions: 'Ăn đúng giờ và hạn chế thức ăn kích thích',
    status: 'ACTIVE',
    createdBy: requireIdentity('doctor2').sub,
    dataSource: DATA_SOURCE,
    createdAt: prescription2At,
    updatedAt: prescription2At,
    version: 1,
  };
  items.push(...projection('PRESCRIPTION', 'DT002', 'BN002', 'PRESCRIPTION', prescription2At, prescription2));

  const request1At = isoUtc(-1, '02:10', baseDate);
  const request1 = {
    ...directKey('LAB_REQUEST', 'YCXN001'),
    entityType: 'LAB_REQUEST',
    labRequestId: 'YCXN001',
    patientId: 'BN001',
    medicalRecordId: '079203000001',
    recordId: '079203000001',
    labTestId: 'XN001',
    requestedBy: requireIdentity('doctor1').sub,
    requestedAt: request1At,
    assignedStaffId: 'NS003',
    priority: 'NORMAL',
    status: 'COMPLETED',
    note: 'Kiểm tra tình trạng nhiễm trùng',
    recordSk: `LAB_REQUEST#${request1At}#YCXN001`,
    dataSource: DATA_SOURCE,
    createdAt: request1At,
    updatedAt: request1At,
    version: 2,
  };
  items.push(request1, { ...request1, pk: 'RECORD#079203000001', sk: request1.recordSk });

  const result1At = isoUtc(-1, '04:00', baseDate);
  const result1 = {
    ...directKey('LAB_RESULT', 'PXN001'),
    entityType: 'LAB_RESULT',
    labResultId: 'PXN001',
    labRequestId: 'YCXN001',
    patientId: 'BN001',
    medicalRecordId: '079203000001',
    recordId: '079203000001',
    labTestId: 'XN001',
    resultText: 'Bạch cầu 11.2 G/L, CRP tăng nhẹ',
    referenceRange: 'Bạch cầu 4.0 - 10.0 G/L',
    unit: 'G/L',
    note: 'Phù hợp tình trạng viêm cấp',
    status: 'APPROVED',
    performedBy: requireIdentity('staffLab').sub,
    performedAt: result1At,
    approvedBy: requireIdentity('doctor1').sub,
    approvedAt: result1At,
    recordSk: `LAB_RESULT#${result1At}#PXN001`,
    dataSource: DATA_SOURCE,
    createdAt: result1At,
    updatedAt: result1At,
    version: 1,
  };
  items.push(result1, { ...result1, pk: 'RECORD#079203000001', sk: result1.recordSk });

  const request2At = isoUtc(0, '01:30', baseDate);
  const request2 = {
    ...directKey('LAB_REQUEST', 'YCXN002'),
    entityType: 'LAB_REQUEST',
    labRequestId: 'YCXN002',
    patientId: 'BN002',
    medicalRecordId: '079203000002',
    recordId: '079203000002',
    labTestId: 'XN003',
    requestedBy: requireIdentity('doctor2').sub,
    requestedAt: request2At,
    assignedStaffId: 'NS003',
    priority: 'NORMAL',
    status: 'REQUESTED',
    note: 'Kiểm tra chức năng gan trước điều trị',
    recordSk: `LAB_REQUEST#${request2At}#YCXN002`,
    dataSource: DATA_SOURCE,
    createdAt: request2At,
    updatedAt: request2At,
    version: 1,
  };
  items.push(request2, { ...request2, pk: 'RECORD#079203000002', sk: request2.recordSk });

  const invoiceAt = isoUtc(-1, '05:00', baseDate);
  const invoice = {
    ...directKey('INVOICE', 'HD001'),
    entityType: 'INVOICE',
    invoiceId: 'HD001',
    patientId: 'BN001',
    medicalRecordId: '079203000001',
    recordId: '079203000001',
    patientSk: `INVOICE#${invoiceAt}#HD001`,
    recordSk: `INVOICE#${invoiceAt}#HD001`,
    items: [
      { itemId: 'ITEM001', serviceId: 'KHAM_NOI', serviceName: 'Khám Nội', serviceType: 'MEDICAL', quantity: 1, unitPrice: 200000, lineTotal: 200000 },
      { itemId: 'ITEM002', serviceId: 'XN001', serviceName: 'Công thức máu toàn phần', serviceType: 'LAB', quantity: 1, unitPrice: 150000, lineTotal: 150000 },
    ],
    totalAmount: 350000,
    currency: 'VND',
    status: 'PAID',
    paymentProvider: 'CASH',
    description: 'Hóa đơn khám và xét nghiệm',
    dataSource: DATA_SOURCE,
    createdBy: requireIdentity('staffReception').sub,
    createdAt: invoiceAt,
    updatedAt: invoiceAt,
    version: 2,
  };
  items.push(
    invoice,
    { ...invoice, pk: 'PATIENT#BN001', sk: invoice.patientSk },
    { ...invoice, pk: 'RECORD#079203000001', sk: invoice.recordSk },
  );

  const paymentAt = isoUtc(-1, '05:05', baseDate);
  const payment = {
    ...directKey('PAYMENT', 'CASH-HD001'),
    entityType: 'PAYMENT',
    paymentId: 'CASH-HD001',
    invoiceId: 'HD001',
    patientId: 'BN001',
    medicalRecordId: '079203000001',
    provider: 'CASH',
    providerTransactionId: 'CASH-HD001',
    requestId: 'DATASET-V2',
    amount: 350000,
    currency: 'VND',
    status: 'SUCCESS',
    dataSource: DATA_SOURCE,
    createdAt: paymentAt,
    paidAt: paymentAt,
    expiresAt: Math.floor(new Date(paymentAt).getTime() / 1000) + 365 * 24 * 60 * 60,
  };
  items.push(payment, { ...payment, pk: 'INVOICE#HD001', sk: `PAYMENT#${paymentAt}#CASH-HD001` });

  const news = [
    ['TT001', 'Hướng dẫn đặt lịch khám trực tuyến', 'Hướng dẫn bệnh nhân đặt lịch khám và theo dõi trạng thái lịch hẹn.'],
    ['TT002', 'Khuyến cáo phòng bệnh theo mùa', 'Các biện pháp vệ sinh và chăm sóc sức khỏe trong thời điểm giao mùa.'],
    ['TT003', 'Triển khai tra cứu hồ sơ bằng CCCD', 'Bệnh nhân sử dụng CCCD làm mã hồ sơ bệnh án và bác sĩ tra cứu chính xác bằng 12 số CCCD.'],
  ];
  for (const [newsId, title, summary] of news) {
    items.push({
      pk: `NEWS#${newsId}`,
      sk: 'META',
      entityType: 'NEWS',
      newsId,
      title,
      summary,
      content: summary,
      category: 'THONG_BAO',
      imageUrl: '',
      status: 'PUBLISHED',
      publishedAt: isoUtc(-2, '01:00', baseDate),
      viewCount: 0,
      dataSource: DATA_SOURCE,
      createdAt: isoUtc(-2, '01:00', baseDate),
      updatedAt: now,
    });
  }

  items.push(
    {
      pk: 'FEEDBACK#PH001',
      sk: 'META',
      entityType: 'FEEDBACK',
      feedbackId: 'PH001',
      patientId: 'BN003',
      title: 'Góp ý về lịch khám',
      content: 'Mong bệnh viện hiển thị rõ bác sĩ và phòng khám sau khi đặt lịch.',
      feedbackType: 'GOI_Y',
      status: 'CHO_XU_LY',
      reply: '',
      dataSource: DATA_SOURCE,
      createdAt: isoUtc(-1, '06:00', baseDate),
      updatedAt: isoUtc(-1, '06:00', baseDate),
    },
    {
      pk: 'FEEDBACK#PH002',
      sk: 'META',
      entityType: 'FEEDBACK',
      feedbackId: 'PH002',
      patientId: 'BN001',
      title: 'Phản hồi dịch vụ',
      content: 'Quy trình khám và xét nghiệm thuận tiện.',
      feedbackType: 'PHAN_HOI',
      status: 'DA_XU_LY',
      reply: 'Cảm ơn bệnh nhân đã gửi phản hồi.',
      repliedAt: isoUtc(0, '01:00', baseDate),
      dataSource: DATA_SOURCE,
      createdAt: isoUtc(-1, '06:30', baseDate),
      updatedAt: isoUtc(0, '01:00', baseDate),
    },
  );

  items.push({
    pk: 'EXTERNAL_CLINIC#PKN001',
    sk: 'META',
    entityType: 'EXTERNAL_CLINIC',
    clinicId: 'PKN001',
    clinicName: 'Phòng khám liên kết Dataset V2',
    address: 'Thành phố Hồ Chí Minh',
    phoneNumber: '02873000001',
    email: 'clinic.dataset@example.com',
    note: 'Dữ liệu minh họa cho hệ thống hiện tại',
    status: 'ACTIVE',
    dataSource: DATA_SOURCE,
    createdAt: createdPast,
    updatedAt: now,
  });

  return {
    dataSource: DATA_SOURCE,
    generatedAt: now,
    baseDate: dateOnly(0, baseDate),
    items,
    patients,
    demoAccountKeys: identities.map((identity) => identity.key),
  };
}

module.exports = {
  DATA_SOURCE,
  buildDataset,
  dateOnly,
  vietnamDateTime,
};
