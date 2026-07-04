'use strict';

const { randomUUID } = require('node:crypto');
const { getTableName } = require('../shared/dynamodb');
const {
  ApiError,
  json,
  parseJsonBody,
  queryParameter,
  routeParameter,
  success,
} = require('../shared/http');
const {
  getCurrentUser,
  requireAuthenticated,
  requireGroups,
} = require('../shared/auth');
const { ValidationError } = require('../shared/validation');
const cognito = require('./cognito-service');
const domain = require('./domain');
const queue = require('./queue-service');
const repo = require('./repository');

const PROJECT_NAME = 'Hospital_P2TB';

function nowIso() {
  return new Date().toISOString();
}

function addDaysDateOnly(value, days) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function primaryRole(groups = []) {
  return domain.SYSTEM_ROLES.find((role) => groups.includes(role)) || null;
}

function toFrontendAccount(cognitoUser, appUser) {
  const attributes = cognitoUser.attributes || {};
  const role = primaryRole(cognitoUser.groups || []);

  return {
    id: attributes.sub || cognitoUser.username,
    username: cognitoUser.username,
    tenDangNhap: cognitoUser.username,
    email: attributes.email || appUser?.email || null,
    emailVerified: attributes.email_verified === 'true',
    phoneNumber: attributes.phone_number || appUser?.phoneNumber || null,
    enabled: cognitoUser.enabled !== false,
    confirmationStatus: cognitoUser.status || null,
    groups: cognitoUser.groups || [],
    primaryRole: role,
    maNhom: role,
    maTK: appUser?.userId || attributes.sub || cognitoUser.username,
    maBN: appUser?.patientId || null,
    maBS: appUser?.doctorId || null,
    maNS: appUser?.staffId || null,
    maKhoa: appUser?.departmentId || null,
    loaiNS: appUser?.staffType || null,
    hoTen: appUser?.fullName || attributes.name || attributes.email || cognitoUser.username,
    chuyenMon: appUser?.specialty || '',
    capBac: appUser?.rank || '',
    trinhDo: appUser?.degree || '',
    chucVu: appUser?.position || '',
    ngaySinh: appUser?.birthDate || '',
    gioiTinh: appUser?.gender || '',
    diaChi: appUser?.address || '',
    soDienThoai: appUser?.phoneNumber || attributes.phone_number || '',
    bhyt: appUser?.healthInsurance || '',
    cccd: appUser?.citizenId || '',
    createdAt: cognitoUser.createdAt || appUser?.createdAt || null,
    updatedAt: cognitoUser.updatedAt || appUser?.updatedAt || null,
  };
}

async function getAppUserForCognito(cognitoUser) {
  return repo.findApplicationUser({
    sub: cognitoUser.attributes?.sub,
    username: cognitoUser.username,
    email: cognitoUser.attributes?.email,
  });
}

async function ensureApplicationProfile(event) {
  const current = requireAuthenticated(event);

  if (!process.env.USER_POOL_ID || !process.env.TABLE_NAME) {
    return {
      current,
      appUser: {
        userId: current.sub,
        cognitoSub: current.sub,
        cognitoUsername: current.username,
        email: current.email,
        role: current.primaryRole,
        patientId: current.primaryRole === 'BENHNHAN' ? current.sub : null,
        doctorId: current.primaryRole === 'BACSI' ? current.sub : null,
        staffId: current.primaryRole === 'NHANSU' ? current.sub : null,
      },
      cognitoUser: null,
      role: current.primaryRole,
      groups: current.groups,
    };
  }

  const cognitoUser = await cognito.getUser(current.username);
  const groups = current.groups.length ? current.groups : cognitoUser.groups;
  const role = primaryRole(groups);
  const attributes = cognitoUser.attributes;
  const existing = await getAppUserForCognito(cognitoUser);
  const userId = existing?.userId || attributes.sub || current.sub;
  const timestamp = nowIso();

  const appUser = {
    pk: `USER#${userId}`,
    sk: 'PROFILE',
    entityType: 'USER',
    userId,
    cognitoSub: attributes.sub || current.sub,
    cognitoUsername: cognitoUser.username,
    email: domain.normalizeEmail(attributes.email || current.email),
    fullName: existing?.fullName || attributes.name || attributes.email || current.username,
    role,
    patientId: existing?.patientId || null,
    citizenId:
      existing?.citizenId ||
      attributes['custom:cccd'] ||
      null,
    medicalRecordId:
      existing?.medicalRecordId ||
      existing?.citizenId ||
      attributes['custom:cccd'] ||
      null,
    doctorId: existing?.doctorId || null,
    staffId: existing?.staffId || null,
    departmentId: existing?.departmentId || null,
    staffType: existing?.staffType || null,
    status: cognitoUser.enabled ? 'ACTIVE' : 'DISABLED',
    emailVerified: attributes.email_verified === 'true',
    dataSource: existing?.dataSource || 'COGNITO',
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
  };

  if (role === 'BENHNHAN' && !appUser.patientId) {
    appUser.patientId = domain.createId('BN');
  }

  const transactItems = [
    {
      Put: {
        TableName: getTableName(),
        Item: appUser,
      },
    },
  ];

  if (role === 'BENHNHAN') {
    const patient = await repo.findPatient(appUser.patientId);
    transactItems.push({
      Put: {
        TableName: getTableName(),
        Item: {
          ...(patient || {}),
          pk: `PATIENT#${appUser.patientId}`,
          sk: 'PROFILE',
          entityType: 'PATIENT',
          patientId: appUser.patientId,
          accountUserId: appUser.userId,
          cognitoSub: appUser.cognitoSub,
          cognitoUsername: appUser.cognitoUsername,
          email: patient?.email || appUser.email,
          fullName: patient?.fullName || appUser.fullName,
          phoneNumber: patient?.phoneNumber || attributes.phone_number || null,
          birthDate: patient?.birthDate || null,
          gender: patient?.gender || null,
          address: patient?.address || null,
          healthInsurance: patient?.healthInsurance || null,
          citizenId:
            patient?.citizenId ||
            appUser.citizenId ||
            attributes['custom:cccd'] ||
            null,
          medicalRecordId:
            patient?.medicalRecordId ||
            appUser.medicalRecordId ||
            appUser.citizenId ||
            null,
          recordId:
            patient?.recordId ||
            appUser.medicalRecordId ||
            appUser.citizenId ||
            null,
          status: patient?.status || 'ACTIVE',
          dataSource: patient?.dataSource || 'COGNITO',
          createdAt: patient?.createdAt || timestamp,
          updatedAt: timestamp,
        },
      },
    });
  }

  await repo.transactWrite(transactItems);

  return { current, appUser, cognitoUser, role, groups };
}

async function requirePatientOwnership(event, patientId) {
  const current = getCurrentUser(event);
  if (!current.groups.includes('BENHNHAN')) return;

  const profile = await ensureApplicationProfile(event);
  if (profile.appUser.patientId !== patientId) {
    throw new ApiError(403, 'FORBIDDEN', 'Bạn chỉ được truy cập dữ liệu của chính mình');
  }
}

async function resolveCurrentDoctorId(event) {
  const current = getCurrentUser(event);
  const profile = await ensureApplicationProfile(event);

  if (profile.appUser.doctorId) {
    return profile.appUser.doctorId;
  }

  const candidates = [
    profile.appUser.userId,
    profile.appUser.cognitoSub,
    profile.appUser.cognitoUsername,
    current.sub,
    current.username,
    current.email,
  ].filter(Boolean);

  const lookups = [
    'accountUserId',
    'cognitoSub',
    'cognitoUsername',
    'email',
  ];

  for (const field of lookups) {
    for (const candidate of candidates) {
      const doctor = await repo.findOneByField('DOCTOR', field, candidate);
      if (!doctor) continue;

      const resolvedDoctorId = doctor.doctorId || doctor.staffId;
      if (!resolvedDoctorId) continue;

      await repo.putItem({
        ...profile.appUser,
        doctorId: resolvedDoctorId,
        departmentId:
          profile.appUser.departmentId || doctor.departmentId || null,
        updatedAt: nowIso(),
      });

      return resolvedDoctorId;
    }
  }

  return null;
}

async function requireDoctorOwnership(event, doctorId) {
  const current = getCurrentUser(event);
  if (!current.groups.includes('BACSI')) return;

  const currentDoctorId = await resolveCurrentDoctorId(event);
  if (!currentDoctorId || currentDoctorId !== doctorId) {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Bác sĩ chỉ được truy cập và đăng ký lịch làm việc của chính mình',
    );
  }
}

async function handleHealth() {
  return success({
    service: 'hospital-p2tb-core-api',
    status: 'ok',
    project: PROJECT_NAME,
    timestamp: nowIso(),
  });
}

async function handleMe(event) {
  const profile = await ensureApplicationProfile(event);
  const { current, appUser, role, groups, cognitoUser } = profile;

  // Hồ sơ USER được tạo từ Cognito đôi khi chưa có doctorId dù tài khoản
  // đã được liên kết với entity DOCTOR. Tự tìm và ghi lại liên kết này để
  // mọi màn hình bác sĩ dùng cùng một mã BS, thay vì dùng Cognito sub/maTK.
  const resolvedDoctorId = groups.includes('BACSI')
    ? await resolveCurrentDoctorId(event)
    : appUser.doctorId || null;

  return success({
    sub: current.sub,
    username: cognitoUser?.username || current.username,
    email: cognitoUser?.attributes?.email || appUser.email || current.email,
    groups,
    primaryRole: role,
    maNhom: role,
    maTK: appUser.userId,
    appUserId: appUser.userId,
    maBN: appUser.patientId || null,
    patientId: appUser.patientId || null,
    maBS: resolvedDoctorId,
    doctorId: resolvedDoctorId,
    maNS: appUser.staffId || null,
    staffId: appUser.staffId || null,
    maKhoa: appUser.departmentId || null,
    loaiNS: appUser.staffType || null,
    hoTen: appUser.fullName || null,
    fullName: appUser.fullName || null,
    cccd: appUser.citizenId || null,
  });
}

async function handleAdminPing(event) {
  const actor = requireGroups(event, ['ADMIN']);
  return success({
    message: 'Admin access granted',
    actor: {
      sub: actor.sub,
      username: actor.username,
      groups: actor.groups,
    },
  });
}

async function handleListAccounts(event) {
  requireGroups(event, ['ADMIN']);
  const [cognitoUsers, profiles] = await Promise.all([
    cognito.listUsers(),
    repo.listByEntityTypes(['USER']),
  ]);

  const users = await Promise.all(
    cognitoUsers.map(async (user) => {
      const normalized = {
        username: user.Username,
        enabled: user.Enabled === true,
        status: user.UserStatus || null,
        createdAt: user.UserCreateDate?.toISOString() || null,
        updatedAt: user.UserLastModifiedDate?.toISOString() || null,
        attributes: cognito.convertAttributes(user.Attributes),
        groups: await cognito.getGroups(user.Username),
      };

      const appUser = profiles.find((item) => {
        const email = domain.normalizeEmail(normalized.attributes.email);
        return (
          item.cognitoSub === normalized.attributes.sub ||
          item.cognitoUsername === normalized.username ||
          (email && domain.normalizeEmail(item.email) === email)
        );
      });

      return toFrontendAccount(normalized, appUser);
    }),
  );

  users.sort((a, b) => String(a.email || a.username).localeCompare(String(b.email || b.username)));

  return success({
    users,
    total: users.length,
    summary: {
      admin: users.filter((item) => item.maNhom === 'ADMIN').length,
      doctor: users.filter((item) => item.maNhom === 'BACSI').length,
      staff: users.filter((item) => item.maNhom === 'NHANSU').length,
      patient: users.filter((item) => item.maNhom === 'BENHNHAN').length,
      unconfirmed: users.filter((item) => item.confirmationStatus === 'UNCONFIRMED').length,
    },
  });
}

async function handleGetAccount(event) {
  requireGroups(event, ['ADMIN']);
  const username = routeParameter(event, 'username');
  const cognitoUser = await cognito.getUser(username);
  const appUser = await getAppUserForCognito(cognitoUser);
  return success(toFrontendAccount(cognitoUser, appUser));
}

function buildProfileItemsForAccount(payload, cognitoUser) {
  const timestamp = nowIso();
  const sub = cognitoUser.attributes.sub || randomUUID();
  const userItem = {
    pk: `USER#${sub}`,
    sk: 'PROFILE',
    entityType: 'USER',
    userId: sub,
    cognitoSub: sub,
    cognitoUsername: cognitoUser.username,
    email: payload.email,
    fullName: payload.fullName || payload.email,
    role: payload.role,
    departmentId: payload.departmentId,
    staffType: payload.staffType,
    specialty: payload.specialty,
    rank: payload.rank,
    degree: payload.degree,
    position: payload.position,
    status: 'ACTIVE',
    dataSource: 'ADMIN_CREATE_USER',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const items = [userItem];

  if (payload.role === 'BACSI') {
    const doctorId = domain.createId('BS');
    userItem.doctorId = doctorId;
    items.push({
      pk: `STAFF#${doctorId}`,
      sk: 'PROFILE',
      entityType: 'DOCTOR',
      staffId: doctorId,
      doctorId,
      accountUserId: sub,
      cognitoSub: sub,
      departmentId: payload.departmentId,
      fullName: payload.fullName || payload.email,
      specialty: payload.specialty,
      degree: payload.degree,
      position: payload.position,
      rank: payload.rank,
      status: 'ACTIVE',
      dataSource: 'ADMIN_CREATE_USER',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  if (payload.role === 'NHANSU') {
    const staffId = domain.createId('NS');
    userItem.staffId = staffId;
    items.push({
      pk: `STAFF#${staffId}`,
      sk: 'PROFILE',
      entityType: 'STAFF',
      staffId,
      accountUserId: sub,
      cognitoSub: sub,
      departmentId: payload.departmentId,
      fullName: payload.fullName || payload.email,
      staffType: payload.staffType,
      specialty: payload.specialty,
      rank: payload.rank,
      status: 'ACTIVE',
      dataSource: 'ADMIN_CREATE_USER',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  if (payload.role === 'BENHNHAN') {
    const patientId = domain.createId('BN');
    userItem.patientId = patientId;
    items.push({
      pk: `PATIENT#${patientId}`,
      sk: 'PROFILE',
      entityType: 'PATIENT',
      patientId,
      accountUserId: sub,
      cognitoSub: sub,
      cognitoUsername: cognitoUser.username,
      email: payload.email,
      fullName: payload.fullName || payload.email,
      birthDate: payload.birthDate,
      gender: payload.gender,
      address: payload.address,
      phoneNumber: payload.phoneNumber,
      healthInsurance: payload.healthInsurance,
      citizenId: payload.citizenId || null,
      status: 'ACTIVE',
      dataSource: 'ADMIN_CREATE_USER',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  return items;
}

async function handleCreateAccount(event) {
  const actor = requireGroups(event, ['ADMIN']);
  const payload = domain.normalizeAccountPayload(parseJsonBody(event));

  if (payload.departmentId) {
    await repo.assertExists(
      repo.getDepartment(payload.departmentId),
      'DEPARTMENT_NOT_FOUND',
      'Không tìm thấy khoa được chọn',
    );
  }

  let createdUser;
  try {
    createdUser = await cognito.createUser(payload);
    await cognito.setPrimaryGroup(createdUser.username, payload.role);
    const fullUser = await cognito.getUser(createdUser.username);
    const items = buildProfileItemsForAccount(payload, fullUser);

    await repo.transactWrite(
      items.map((item) => ({
        Put: {
          TableName: getTableName(),
          Item: item,
          ConditionExpression:
            'attribute_not_exists(pk) AND attribute_not_exists(sk)',
        },
      })),
    );

    await queue.publishEvent(
      'USER_CREATED',
      {
        username: fullUser.username,
        email: payload.email,
        role: payload.role,
        userId: items[0].userId,
      },
      actor,
    );

    return success(toFrontendAccount(fullUser, items[0]), 201);
  } catch (error) {
    if (createdUser?.username) {
      await cognito.deleteUser(createdUser.username).catch(() => {});
    }
    throw error;
  }
}

async function handleUpdateAccount(event) {
  const actor = requireGroups(event, ['ADMIN']);
  const username = routeParameter(event, 'username');
  const body = parseJsonBody(event);
  const user = await cognito.getUser(username);
  const appUser = await getAppUserForCognito(user);
  const requestedRole = body.maNhom || body.role
    ? domain.normalizeCode(body.maNhom || body.role, 'maNhom')
    : primaryRole(user.groups);

  if (!domain.SYSTEM_ROLES.includes(requestedRole)) {
    throw new ValidationError(`Vai trò phải là một trong: ${domain.SYSTEM_ROLES.join(', ')}`);
  }

  await cognito.setPrimaryGroup(username, requestedRole);
  await cognito.updateAttributes(username, {
    email: body.email,
    fullName: body.hoTen,
    phoneNumber: body.soDienThoai,
  });

  let updatedAppUser = appUser;
  if (appUser) {
    updatedAppUser = {
      ...appUser,
      email: body.email ? domain.normalizeEmail(body.email) : appUser.email,
      fullName: body.hoTen || appUser.fullName,
      role: requestedRole,
      departmentId: body.maKhoa || appUser.departmentId,
      staffType: body.loaiNS || appUser.staffType,
      specialty: body.chuyenMon || appUser.specialty,
      rank: body.capBac || appUser.rank,
      degree: body.trinhDo || appUser.degree,
      position: body.chucVu || appUser.position,
      updatedAt: nowIso(),
    };
    await repo.putItem(updatedAppUser);
  }

  await queue.publishEvent(
    'USER_UPDATED',
    { username, role: requestedRole },
    actor,
  );

  const refreshed = await cognito.getUser(username);
  return success(toFrontendAccount(refreshed, updatedAppUser));
}

async function handleDisableAccount(event) {
  const actor = requireGroups(event, ['ADMIN']);
  const username = routeParameter(event, 'username');
  if (username === actor.username) {
    throw new ValidationError('Không thể vô hiệu hóa chính tài khoản đang đăng nhập');
  }

  await cognito.disableUser(username);
  const user = await cognito.getUser(username);
  const appUser = await getAppUserForCognito(user);
  if (appUser) {
    await repo.putItem({ ...appUser, status: 'DISABLED', updatedAt: nowIso() });
  }

  await queue.publishEvent('USER_DISABLED', { username }, actor);
  return success({ username, enabled: false, message: 'Tài khoản đã được vô hiệu hóa' });
}

async function handleEnableAccount(event) {
  const actor = requireGroups(event, ['ADMIN']);
  const username = routeParameter(event, 'username');
  await cognito.enableUser(username);
  const user = await cognito.getUser(username);
  const appUser = await getAppUserForCognito(user);
  if (appUser) {
    await repo.putItem({ ...appUser, status: 'ACTIVE', updatedAt: nowIso() });
  }
  await queue.publishEvent('USER_ENABLED', { username }, actor);
  return success({ username, enabled: true, message: 'Tài khoản đã được kích hoạt' });
}

async function handleResendInvitation(event) {
  requireGroups(event, ['ADMIN']);
  const username = routeParameter(event, 'username');
  await cognito.resendInvitation(username);
  return success({ username, message: 'Đã gửi lại email mời Cognito' });
}

async function handleListDepartments(event) {
  requireAuthenticated(event);
  const items = await repo.listDepartments();
  return success(items.map(domain.mapDepartment).sort((a, b) => a.tenKhoa.localeCompare(b.tenKhoa, 'vi')));
}

async function handleGetDepartment(event) {
  requireAuthenticated(event);
  const id = domain.normalizeCode(routeParameter(event, 'departmentId'), 'maKhoa');
  const item = await repo.assertExists(
    repo.getDepartment(id),
    'DEPARTMENT_NOT_FOUND',
    'Không tìm thấy khoa',
  );
  return success(domain.mapDepartment(item));
}

async function handleCreateDepartment(event) {
  const actor = requireGroups(event, ['ADMIN']);
  const payload = domain.normalizeDepartmentPayload(parseJsonBody(event));
  const timestamp = nowIso();
  const item = {
    pk: `DEPARTMENT#${payload.departmentId}`,
    sk: 'META',
    entityType: 'DEPARTMENT',
    ...payload,
    dataSource: 'CORE_API',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await repo.putItem(item, { createOnly: true });
  await queue.publishEvent('DEPARTMENT_CREATED', domain.mapDepartment(item), actor);
  return success(domain.mapDepartment(item), 201);
}

async function handleUpdateDepartment(event) {
  const actor = requireGroups(event, ['ADMIN']);
  const id = domain.normalizeCode(routeParameter(event, 'departmentId'), 'maKhoa');
  const existing = await repo.assertExists(
    repo.getDepartment(id),
    'DEPARTMENT_NOT_FOUND',
    'Không tìm thấy khoa',
  );
  const payload = domain.normalizeDepartmentPayload(parseJsonBody(event), id);
  const updated = { ...existing, ...payload, updatedAt: nowIso() };
  await repo.putItem(updated);
  await queue.publishEvent('DEPARTMENT_UPDATED', domain.mapDepartment(updated), actor);
  return success(domain.mapDepartment(updated));
}

async function handleDeleteDepartment(event) {
  const actor = requireGroups(event, ['ADMIN']);
  const id = domain.normalizeCode(routeParameter(event, 'departmentId'), 'maKhoa');
  await repo.assertExists(
    repo.getDepartment(id),
    'DEPARTMENT_NOT_FOUND',
    'Không tìm thấy khoa',
  );
  const [rooms, doctors, staff] = await Promise.all([
    repo.listRooms(),
    repo.listDoctors(),
    repo.listStaff(),
  ]);
  const hasReference = [...rooms, ...doctors, ...staff].some(
    (item) => item.departmentId === id && item.status !== 'INACTIVE',
  );
  if (hasReference) {
    throw new ApiError(
      409,
      'DEPARTMENT_IN_USE',
      'Không thể xóa khoa đang có phòng hoặc nhân sự hoạt động',
    );
  }
  await repo.deleteItem(`DEPARTMENT#${id}`, 'META');
  await queue.publishEvent('DEPARTMENT_DELETED', { departmentId: id }, actor);
  return success({ maKhoa: id, message: 'Đã xóa khoa' });
}

async function handleListRooms(event) {
  requireAuthenticated(event);
  const items = await repo.listRooms();
  return success(items.map(domain.mapRoom));
}

async function handleGetRoom(event) {
  requireAuthenticated(event);
  const id = domain.normalizeCode(routeParameter(event, 'roomId'), 'maPhong');
  const item = await repo.assertExists(
    repo.findRoom(id),
    'ROOM_NOT_FOUND',
    'Không tìm thấy phòng khám',
  );
  return success(domain.mapRoom(item));
}

async function handleCreateRoom(event) {
  const actor = requireGroups(event, ['ADMIN']);
  const payload = domain.normalizeRoomPayload(parseJsonBody(event));
  await repo.assertExists(
    repo.getDepartment(payload.departmentId),
    'DEPARTMENT_NOT_FOUND',
    'Không tìm thấy khoa',
  );
  const timestamp = nowIso();
  const item = {
    pk: `DEPARTMENT#${payload.departmentId}`,
    sk: `ROOM#${payload.roomId}`,
    entityType: 'ROOM',
    ...payload,
    dataSource: 'CORE_API',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await repo.putItem(item, { createOnly: true });
  await queue.publishEvent('ROOM_CREATED', domain.mapRoom(item), actor);
  return success(domain.mapRoom(item), 201);
}

async function handleUpdateRoom(event) {
  const actor = requireGroups(event, ['ADMIN']);
  const id = domain.normalizeCode(routeParameter(event, 'roomId'), 'maPhong');
  const existing = await repo.assertExists(
    repo.findRoom(id),
    'ROOM_NOT_FOUND',
    'Không tìm thấy phòng khám',
  );
  const payload = domain.normalizeRoomPayload(parseJsonBody(event), id);
  await repo.assertExists(
    repo.getDepartment(payload.departmentId),
    'DEPARTMENT_NOT_FOUND',
    'Không tìm thấy khoa',
  );
  const updated = { ...existing, ...payload, updatedAt: nowIso() };

  if (existing.pk !== `DEPARTMENT#${payload.departmentId}`) {
    updated.pk = `DEPARTMENT#${payload.departmentId}`;
    await repo.transactWrite([
      {
        Delete: {
          TableName: getTableName(),
          Key: { pk: existing.pk, sk: existing.sk },
        },
      },
      {
        Put: {
          TableName: getTableName(),
          Item: updated,
          ConditionExpression:
            'attribute_not_exists(pk) AND attribute_not_exists(sk)',
        },
      },
    ]);
  } else {
    await repo.putItem(updated);
  }

  await queue.publishEvent('ROOM_UPDATED', domain.mapRoom(updated), actor);
  return success(domain.mapRoom(updated));
}

async function handleDeleteRoom(event) {
  const actor = requireGroups(event, ['ADMIN']);
  const id = domain.normalizeCode(routeParameter(event, 'roomId'), 'maPhong');
  const item = await repo.assertExists(
    repo.findRoom(id),
    'ROOM_NOT_FOUND',
    'Không tìm thấy phòng khám',
  );
  await repo.deleteItem(item.pk, item.sk);
  await queue.publishEvent('ROOM_DELETED', { roomId: id }, actor);
  return success({ maPhong: id, message: 'Đã xóa phòng khám' });
}

async function handleListExternalClinics(event) {
  requireAuthenticated(event);
  return success((await repo.listExternalClinics()).map(domain.mapExternalClinic));
}

async function handleGetExternalClinic(event) {
  requireAuthenticated(event);
  const id = domain.normalizeCode(routeParameter(event, 'clinicId'), 'maPKN');
  const item = await repo.assertExists(
    repo.findExternalClinic(id),
    'CLINIC_NOT_FOUND',
    'Không tìm thấy phòng khám ngoài',
  );
  return success(domain.mapExternalClinic(item));
}

async function handleCreateExternalClinic(event) {
  const actor = requireGroups(event, ['ADMIN']);
  const payload = domain.normalizeExternalClinicPayload(parseJsonBody(event));
  const timestamp = nowIso();
  const item = {
    pk: `EXTERNAL_CLINIC#${payload.clinicId}`,
    sk: 'META',
    entityType: 'EXTERNAL_CLINIC',
    ...payload,
    dataSource: 'CORE_API',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await repo.putItem(item, { createOnly: true });
  await queue.publishEvent('EXTERNAL_CLINIC_CREATED', domain.mapExternalClinic(item), actor);
  return success(domain.mapExternalClinic(item), 201);
}

async function handleUpdateExternalClinic(event) {
  const actor = requireGroups(event, ['ADMIN']);
  const id = domain.normalizeCode(routeParameter(event, 'clinicId'), 'maPKN');
  const existing = await repo.assertExists(
    repo.findExternalClinic(id),
    'CLINIC_NOT_FOUND',
    'Không tìm thấy phòng khám ngoài',
  );
  const payload = domain.normalizeExternalClinicPayload(parseJsonBody(event), id);
  const updated = { ...existing, ...payload, updatedAt: nowIso() };
  await repo.putItem(updated);
  await queue.publishEvent('EXTERNAL_CLINIC_UPDATED', domain.mapExternalClinic(updated), actor);
  return success(domain.mapExternalClinic(updated));
}

async function handleDeleteExternalClinic(event) {
  const actor = requireGroups(event, ['ADMIN']);
  const id = domain.normalizeCode(routeParameter(event, 'clinicId'), 'maPKN');
  await repo.assertExists(
    repo.findExternalClinic(id),
    'CLINIC_NOT_FOUND',
    'Không tìm thấy phòng khám ngoài',
  );
  await repo.deleteItem(`EXTERNAL_CLINIC#${id}`, 'META');
  await queue.publishEvent('EXTERNAL_CLINIC_DELETED', { clinicId: id }, actor);
  return success({ maPKN: id, message: 'Đã xóa phòng khám ngoài' });
}

async function handleListDoctors(event) {
  requireAuthenticated(event);
  return success((await repo.listDoctors()).map(domain.mapDoctor));
}

async function handleGetDoctor(event) {
  requireAuthenticated(event);
  const id = domain.normalizeCode(routeParameter(event, 'doctorId'), 'maBS');
  const item = await repo.assertExists(
    repo.findDoctor(id),
    'DOCTOR_NOT_FOUND',
    'Không tìm thấy bác sĩ',
  );
  return success(domain.mapDoctor(item));
}

async function handleDoctorByAccount(event) {
  const current = requireAuthenticated(event);
  const profile = await ensureApplicationProfile(event);
  const accountId = String(routeParameter(event, 'maTK') || '').trim();

  const candidates = [
    accountId,
    profile.appUser.userId,
    profile.appUser.cognitoSub,
    profile.appUser.cognitoUsername,
    profile.appUser.email,
    current.sub,
    current.username,
    current.email,
  ].filter(Boolean);

  const fields = [
    'accountUserId',
    'cognitoSub',
    'cognitoUsername',
    'email',
    'doctorId',
    'staffId',
  ];

  let item = null;
  for (const field of fields) {
    for (const candidate of candidates) {
      item = await repo.findOneByField('DOCTOR', field, candidate);
      if (item) break;
    }
    if (item) break;
  }

  // Với tài khoản BACSI, dùng resolver JWT làm nguồn sự thật cuối cùng.
  if (!item && current.groups.includes('BACSI')) {
    const doctorId = await resolveCurrentDoctorId(event);
    if (doctorId) item = await repo.findDoctor(doctorId);
  }

  if (!item) {
    throw new ApiError(
      404,
      'DOCTOR_NOT_FOUND',
      'Không tìm thấy hồ sơ bác sĩ được liên kết với tài khoản',
    );
  }

  return success(domain.mapDoctor(item));
}

async function handleCreateDoctor(event) {
  const actor = requireGroups(event, ['ADMIN']);
  const payload = domain.normalizeDoctorPayload(parseJsonBody(event));
  await repo.assertExists(repo.getDepartment(payload.departmentId), 'DEPARTMENT_NOT_FOUND', 'Không tìm thấy khoa');
  const timestamp = nowIso();
  const item = {
    pk: `STAFF#${payload.doctorId}`,
    sk: 'PROFILE',
    entityType: 'DOCTOR',
    staffId: payload.doctorId,
    ...payload,
    dataSource: 'CORE_API',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await repo.putItem(item, { createOnly: true });
  await queue.publishEvent('DOCTOR_CREATED', domain.mapDoctor(item), actor);
  return success(domain.mapDoctor(item), 201);
}

async function handleUpdateDoctor(event) {
  const actor = requireGroups(event, ['ADMIN']);
  const id = domain.normalizeCode(routeParameter(event, 'doctorId'), 'maBS');
  const existing = await repo.assertExists(repo.findDoctor(id), 'DOCTOR_NOT_FOUND', 'Không tìm thấy bác sĩ');
  const payload = domain.normalizeDoctorPayload(parseJsonBody(event), id);
  await repo.assertExists(repo.getDepartment(payload.departmentId), 'DEPARTMENT_NOT_FOUND', 'Không tìm thấy khoa');
  const updated = { ...existing, ...payload, staffId: id, updatedAt: nowIso() };
  await repo.putItem(updated);
  await queue.publishEvent('DOCTOR_UPDATED', domain.mapDoctor(updated), actor);
  return success(domain.mapDoctor(updated));
}

async function handleDeleteDoctor(event) {
  const actor = requireGroups(event, ['ADMIN']);
  const id = domain.normalizeCode(routeParameter(event, 'doctorId'), 'maBS');
  const existing = await repo.assertExists(repo.findDoctor(id), 'DOCTOR_NOT_FOUND', 'Không tìm thấy bác sĩ');
  const updated = { ...existing, status: 'INACTIVE', updatedAt: nowIso() };
  await repo.putItem(updated);
  await queue.publishEvent('DOCTOR_DEACTIVATED', { doctorId: id }, actor);
  return success(domain.mapDoctor(updated));
}

async function handleListStaff(event) {
  requireAuthenticated(event);
  return success((await repo.listStaff()).map(domain.mapStaff));
}

async function handleGetStaff(event) {
  requireAuthenticated(event);
  const id = domain.normalizeCode(routeParameter(event, 'staffId'), 'maNS');
  const item = await repo.assertExists(repo.findStaff(id), 'STAFF_NOT_FOUND', 'Không tìm thấy nhân sự');
  return success(domain.mapStaff(item));
}

async function handleStaffByAccount(event) {
  requireAuthenticated(event);
  const accountId = routeParameter(event, 'maTK');
  const item = await repo.findOneByField('STAFF', 'accountUserId', accountId);
  if (!item) throw new ApiError(404, 'STAFF_NOT_FOUND', 'Không tìm thấy nhân sự theo tài khoản');
  return success(domain.mapStaff(item));
}

async function handleCreateStaff(event) {
  const actor = requireGroups(event, ['ADMIN']);
  const payload = domain.normalizeStaffPayload(parseJsonBody(event));
  await repo.assertExists(repo.getDepartment(payload.departmentId), 'DEPARTMENT_NOT_FOUND', 'Không tìm thấy khoa');
  const timestamp = nowIso();
  const item = {
    pk: `STAFF#${payload.staffId}`,
    sk: 'PROFILE',
    entityType: 'STAFF',
    ...payload,
    dataSource: 'CORE_API',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await repo.putItem(item, { createOnly: true });
  await queue.publishEvent('STAFF_CREATED', domain.mapStaff(item), actor);
  return success(domain.mapStaff(item), 201);
}

async function handleUpdateStaff(event) {
  const actor = requireGroups(event, ['ADMIN']);
  const id = domain.normalizeCode(routeParameter(event, 'staffId'), 'maNS');
  const existing = await repo.assertExists(repo.findStaff(id), 'STAFF_NOT_FOUND', 'Không tìm thấy nhân sự');
  const payload = domain.normalizeStaffPayload(parseJsonBody(event), id);
  await repo.assertExists(repo.getDepartment(payload.departmentId), 'DEPARTMENT_NOT_FOUND', 'Không tìm thấy khoa');
  const updated = { ...existing, ...payload, updatedAt: nowIso() };
  await repo.putItem(updated);
  await queue.publishEvent('STAFF_UPDATED', domain.mapStaff(updated), actor);
  return success(domain.mapStaff(updated));
}

async function handleDeleteStaff(event) {
  const actor = requireGroups(event, ['ADMIN']);
  const id = domain.normalizeCode(routeParameter(event, 'staffId'), 'maNS');
  const existing = await repo.assertExists(repo.findStaff(id), 'STAFF_NOT_FOUND', 'Không tìm thấy nhân sự');
  const updated = { ...existing, status: 'INACTIVE', updatedAt: nowIso() };
  await repo.putItem(updated);
  await queue.publishEvent('STAFF_DEACTIVATED', { staffId: id }, actor);
  return success(domain.mapStaff(updated));
}

async function handleListShifts(event) {
  requireAuthenticated(event);
  return success((await repo.listShifts()).map(domain.mapShift));
}

async function handleGetShift(event) {
  requireAuthenticated(event);
  const id = domain.normalizeCode(routeParameter(event, 'shiftId'), 'maCa');
  const item = await repo.assertExists(repo.findShift(id), 'SHIFT_NOT_FOUND', 'Không tìm thấy ca trực');
  return success(domain.mapShift(item));
}

async function handleCreateShift(event) {
  const actor = requireGroups(event, ['ADMIN', 'NHANSU']);
  const payload = domain.normalizeShiftPayload(parseJsonBody(event));
  const timestamp = nowIso();
  const item = {
    pk: `SHIFT#${payload.shiftId}`,
    sk: 'META',
    entityType: 'SHIFT',
    ...payload,
    dataSource: 'CORE_API',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await repo.putItem(item, { createOnly: true });
  await queue.publishEvent('SHIFT_CREATED', domain.mapShift(item), actor);
  return success(domain.mapShift(item), 201);
}

async function handleUpdateShift(event) {
  const actor = requireGroups(event, ['ADMIN', 'NHANSU']);
  const id = domain.normalizeCode(routeParameter(event, 'shiftId'), 'maCa');
  const existing = await repo.assertExists(repo.findShift(id), 'SHIFT_NOT_FOUND', 'Không tìm thấy ca trực');
  const payload = domain.normalizeShiftPayload(parseJsonBody(event), id);
  const updated = { ...existing, ...payload, updatedAt: nowIso() };
  await repo.putItem(updated);
  await queue.publishEvent('SHIFT_UPDATED', domain.mapShift(updated), actor);
  return success(domain.mapShift(updated));
}

async function handleDeleteShift(event) {
  const actor = requireGroups(event, ['ADMIN', 'NHANSU']);
  const id = domain.normalizeCode(routeParameter(event, 'shiftId'), 'maCa');
  await repo.assertExists(repo.findShift(id), 'SHIFT_NOT_FOUND', 'Không tìm thấy ca trực');
  const schedules = await repo.listSchedules();
  if (schedules.some((item) => item.shiftId === id)) {
    throw new ApiError(409, 'SHIFT_IN_USE', 'Không thể xóa ca đang được sử dụng trong lịch làm việc');
  }
  await repo.deleteItem(`SHIFT#${id}`, 'META');
  await queue.publishEvent('SHIFT_DELETED', { shiftId: id }, actor);
  return success({ maCa: id, message: 'Đã xóa ca trực' });
}

async function scheduleRelations() {
  const [doctors, staff, shifts] = await Promise.all([
    repo.listDoctors(),
    repo.listStaff(),
    repo.listShifts(),
  ]);
  return {
    doctors: new Map(doctors.map((item) => [item.doctorId || item.staffId, item])),
    staff: new Map(staff.map((item) => [item.staffId, item])),
    shifts: new Map(shifts.map((item) => [item.shiftId, item])),
  };
}

async function handleListSchedules(event) {
  requireAuthenticated(event);
  const relations = await scheduleRelations();
  return success((await repo.listSchedules()).map((item) => domain.mapSchedule(item, relations)));
}

async function handleSchedulesByDoctor(event) {
  const id = domain.normalizeCode(routeParameter(event, 'doctorId'), 'maBS');
  requireAuthenticated(event);
  await requireDoctorOwnership(event, id);
  const relations = await scheduleRelations();
  return success((await repo.listSchedulesByStaff(id)).map((item) => domain.mapSchedule(item, relations)));
}

async function handleSchedulesByStaff(event) {
  const id = domain.normalizeCode(routeParameter(event, 'staffId'), 'maNS');
  requireAuthenticated(event);
  const relations = await scheduleRelations();
  return success((await repo.listSchedulesByStaff(id)).map((item) => domain.mapSchedule(item, relations)));
}

async function handleCreateSchedule(event) {
  const actor = requireGroups(event, ['ADMIN', 'NHANSU', 'BACSI']);
  const rawBody = parseJsonBody(event);

  // Không tin maBS do trình duyệt gửi lên. Tài khoản BACSI luôn được gắn
  // lịch bằng doctorId đã resolve từ JWT và hồ sơ USER/DOCTOR trong DynamoDB.
  const normalizedBody = actor.groups.includes('BACSI')
    ? {
        ...rawBody,
        maBS: await resolveCurrentDoctorId(event),
        maNS: undefined,
        staffId: undefined,
      }
    : rawBody;

  if (actor.groups.includes('BACSI') && !normalizedBody.maBS) {
    throw new ApiError(
      403,
      'DOCTOR_PROFILE_REQUIRED',
      'Tài khoản chưa được liên kết với hồ sơ bác sĩ',
    );
  }

  const payload = domain.normalizeSchedulePayload(normalizedBody);

  if (actor.groups.includes('BACSI')) {
    await requireDoctorOwnership(event, payload.staffId);
  }
  const owner = payload.ownerType === 'DOCTOR'
    ? await repo.findDoctor(payload.staffId)
    : await repo.findStaff(payload.staffId);
  if (!owner || owner.status === 'INACTIVE') {
    throw new ApiError(404, 'STAFF_NOT_FOUND', 'Không tìm thấy nhân sự hoặc bác sĩ hoạt động');
  }
  await repo.assertExists(repo.findShift(payload.shiftId), 'SHIFT_NOT_FOUND', 'Không tìm thấy ca trực');

  const dates = payload.createForWeek
    ? Array.from({ length: 7 }, (_, index) => addDaysDateOnly(payload.workDate, index))
    : [payload.workDate];
  const timestamp = nowIso();
  const items = dates.map((workDate, index) => ({
    pk: `STAFF#${payload.staffId}`,
    sk: `SCHEDULE#${workDate}#${payload.shiftId}`,
    gsi1pk: `STAFF#${payload.staffId}`,
    gsi1sk: `SCHEDULE#${workDate}#${payload.shiftId}#${index}`,
    entityType: 'WORK_SCHEDULE',
    scheduleId: index === 0 ? payload.scheduleId : domain.createId('LLV'),
    staffId: payload.staffId,
    doctorId: payload.doctorId,
    ownerType: payload.ownerType,
    shiftId: payload.shiftId,
    workDate,
    assignedByStaffId: payload.assignedByStaffId,
    status: payload.status,
    dataSource: 'CORE_API',
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  await repo.transactWrite(
    items.map((item) => ({
      Put: {
        TableName: getTableName(),
        Item: item,
        ConditionExpression:
          'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      },
    })),
  );

  await queue.publishEvent(
    'WORK_SCHEDULE_CREATED',
    { scheduleIds: items.map((item) => item.scheduleId) },
    actor,
  );

  const relations = await scheduleRelations();
  const mapped = items.map((item) => domain.mapSchedule(item, relations));
  return success(payload.createForWeek ? mapped : mapped[0], 201);
}

async function handleUpdateSchedule(event) {
  const actor = requireGroups(event, ['ADMIN', 'NHANSU', 'BACSI']);
  const id = domain.normalizeCode(routeParameter(event, 'scheduleId'), 'maLichLV');
  const existing = await repo.assertExists(repo.findSchedule(id), 'SCHEDULE_NOT_FOUND', 'Không tìm thấy lịch làm việc');
  const payload = domain.normalizeSchedulePayload(parseJsonBody(event), id);

  if (actor.groups.includes('BACSI')) {
    const existingDoctorId = existing.doctorId || existing.staffId;
    await requireDoctorOwnership(event, existingDoctorId);
    if (payload.ownerType !== 'DOCTOR' || payload.staffId !== existingDoctorId) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'Bác sĩ không được chuyển lịch sang người khác',
      );
    }
  }
  const owner = payload.ownerType === 'DOCTOR'
    ? await repo.findDoctor(payload.staffId)
    : await repo.findStaff(payload.staffId);
  if (!owner) throw new ApiError(404, 'STAFF_NOT_FOUND', 'Không tìm thấy nhân sự hoặc bác sĩ');
  await repo.assertExists(repo.findShift(payload.shiftId), 'SHIFT_NOT_FOUND', 'Không tìm thấy ca trực');

  const updated = {
    ...existing,
    pk: `STAFF#${payload.staffId}`,
    sk: `SCHEDULE#${payload.workDate}#${payload.shiftId}`,
    gsi1pk: `STAFF#${payload.staffId}`,
    gsi1sk: `SCHEDULE#${payload.workDate}#${payload.shiftId}#${id}`,
    ...payload,
    createForWeek: undefined,
    updatedAt: nowIso(),
  };

  if (existing.pk === updated.pk && existing.sk === updated.sk) {
    await repo.putItem(updated);
  } else {
    await repo.transactWrite([
      {
        Delete: {
          TableName: getTableName(),
          Key: { pk: existing.pk, sk: existing.sk },
        },
      },
      {
        Put: {
          TableName: getTableName(),
          Item: updated,
          ConditionExpression:
            'attribute_not_exists(pk) AND attribute_not_exists(sk)',
        },
      },
    ]);
  }

  await queue.publishEvent('WORK_SCHEDULE_UPDATED', { scheduleId: id }, actor);
  const relations = await scheduleRelations();
  return success(domain.mapSchedule(updated, relations));
}

async function handleDeleteSchedule(event) {
  const actor = requireGroups(event, ['ADMIN', 'NHANSU', 'BACSI']);
  const id = domain.normalizeCode(routeParameter(event, 'scheduleId'), 'maLichLV');
  const existing = await repo.assertExists(repo.findSchedule(id), 'SCHEDULE_NOT_FOUND', 'Không tìm thấy lịch làm việc');

  if (actor.groups.includes('BACSI')) {
    await requireDoctorOwnership(event, existing.doctorId || existing.staffId);
  }

  await repo.deleteItem(existing.pk, existing.sk);
  await queue.publishEvent('WORK_SCHEDULE_DELETED', { scheduleId: id }, actor);
  return success({ maLichLV: id, message: 'Đã xóa lịch làm việc' });
}

async function handleSchedulePatientCount(event) {
  requireAuthenticated(event);
  const doctorId = domain.normalizeCode(queryParameter(event, 'maBS'), 'maBS');
  const shiftId = domain.normalizeCode(queryParameter(event, 'maCa'), 'maCa');
  const date = queryParameter(event, 'ngayLamViec');
  const shift = await repo.assertExists(repo.findShift(shiftId), 'SHIFT_NOT_FOUND', 'Không tìm thấy ca trực');
  const appointments = await repo.listAppointmentsByDoctor(doctorId);
  const count = appointments.filter(
    (item) =>
      item.appointmentDate === date &&
      item.status !== 'DA_HUY' &&
      domain.isTimeWithinShift(item.appointmentTime, shift),
  ).length;
  return success({ soLuong: count, toiDa: 10, conLai: Math.max(0, 10 - count) });
}

async function appointmentRelations() {
  const [doctors, patients] = await Promise.all([
    repo.listDoctors(),
    repo.listPatients(),
  ]);
  return {
    doctors: new Map(doctors.map((item) => [item.doctorId || item.staffId, item])),
    patients: new Map(patients.map((item) => [item.patientId, item])),
  };
}

async function findShiftForAppointment(time) {
  const shifts = await repo.listShifts();
  return shifts.find(
    (item) => item.status !== 'INACTIVE' && domain.isTimeWithinShift(time, item),
  ) || null;
}

async function isDoctorAvailable(doctorId, appointmentDate, appointmentTime) {
  const shift = await findShiftForAppointment(appointmentTime);
  if (!shift) return { available: false, reason: 'SHIFT_NOT_FOUND' };

  const schedules = await repo.listSchedulesByStaff(doctorId);
  const scheduled = schedules.some(
    (item) =>
      item.workDate === appointmentDate &&
      item.shiftId === shift.shiftId &&
      item.status !== 'INACTIVE',
  );
  if (!scheduled) return { available: false, reason: 'DOCTOR_NOT_SCHEDULED', shift };

  const appointments = await repo.listAppointmentsByDoctor(doctorId);
  const occupied = appointments.some(
    (item) =>
      item.appointmentDate === appointmentDate &&
      item.appointmentTime === appointmentTime &&
      item.status !== 'DA_HUY',
  );
  return { available: !occupied, reason: occupied ? 'SLOT_OCCUPIED' : null, shift };
}

async function autoAssignDoctor(payload) {
  const doctors = (await repo.listDoctors()).filter(
    (item) =>
      item.status !== 'INACTIVE' &&
      (!payload.departmentId || item.departmentId === payload.departmentId),
  );

  for (const doctor of doctors) {
    const doctorId = doctor.doctorId || doctor.staffId;
    const availability = await isDoctorAvailable(
      doctorId,
      payload.appointmentDate,
      payload.appointmentTime,
    );
    if (availability.available) return doctorId;
  }

  throw new ApiError(
    409,
    'NO_AVAILABLE_DOCTOR',
    'Không có bác sĩ phù hợp còn trống trong khung giờ đã chọn',
  );
}

function buildAppointmentItems(payload, timestamp) {
  const canonical = {
    pk: `APPOINTMENT#${payload.appointmentId}`,
    sk: 'META',
    gsi1pk: `DOCTOR#${payload.doctorId}`,
    gsi1sk: `APPOINTMENT#${payload.appointmentDateTime}#${payload.appointmentId}`,
    entityType: 'APPOINTMENT',
    ...payload,
    dataSource: 'CORE_API',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const patientRef = {
    ...canonical,
    pk: `PATIENT#${payload.patientId}`,
    sk: `APPOINTMENT#${payload.appointmentDateTime}#${payload.appointmentId}`,
    entityType: 'APPOINTMENT_REF',
  };
  const doctorRef = {
    ...canonical,
    pk: `STAFF#${payload.doctorId}`,
    sk: `APPOINTMENT#${payload.appointmentDateTime}#${payload.appointmentId}`,
    entityType: 'APPOINTMENT_REF',
  };
  const doctorLock = {
    pk: `DOCTOR_SLOT#${payload.doctorId}`,
    sk: payload.appointmentDateTime,
    entityType: 'APPOINTMENT_SLOT',
    appointmentId: payload.appointmentId,
    createdAt: timestamp,
  };
  const patientLock = {
    pk: `PATIENT_SLOT#${payload.patientId}`,
    sk: payload.appointmentDateTime,
    entityType: 'APPOINTMENT_SLOT',
    appointmentId: payload.appointmentId,
    createdAt: timestamp,
  };

  return { canonical, patientRef, doctorRef, doctorLock, patientLock };
}


function canonicalizeStoredAppointment(item) {
  if (!item) return item;
  const appointmentDate = item.appointmentDate || String(item.sk || '').split('#')[1]?.slice(0, 10);
  const appointmentTime = item.appointmentTime || String(item.sk || '').split('#')[1]?.slice(11, 16);
  const appointmentDateTime = item.appointmentDateTime || (
    appointmentDate && appointmentTime
      ? domain.createDateTime(appointmentDate, appointmentTime)
      : null
  );

  return {
    ...item,
    appointmentDate,
    appointmentTime,
    appointmentDateTime,
    status: domain.normalizeAppointmentStatus(item.status),
  };
}

async function handleListAppointments(event) {
  const current = requireGroups(event, ['ADMIN', 'NHANSU', 'BACSI']);
  const relations = await appointmentRelations();

  let items;
  if (
    current.groups.includes('BACSI') &&
    !current.groups.includes('ADMIN') &&
    !current.groups.includes('NHANSU')
  ) {
    const doctorId = await resolveCurrentDoctorId(event);
    if (!doctorId) {
      throw new ApiError(
        403,
        'DOCTOR_PROFILE_REQUIRED',
        'Tài khoản bác sĩ chưa được liên kết với hồ sơ bác sĩ',
      );
    }
    items = await repo.listAppointmentsByDoctor(doctorId);
  } else {
    items = await repo.listAppointments();
  }

  return success(
    items.map((item) =>
      domain.mapAppointment(canonicalizeStoredAppointment(item), relations),
    ),
  );
}

async function handlePatientAppointments(event) {
  const patientId = domain.normalizeCode(routeParameter(event, 'patientId'), 'maBN');
  requireAuthenticated(event);
  await requirePatientOwnership(event, patientId);
  const relations = await appointmentRelations();
  return success((await repo.listAppointmentsByPatient(patientId)).map((item) => domain.mapAppointment(canonicalizeStoredAppointment(item), relations)));
}

async function handleDoctorAppointments(event) {
  const doctorId = domain.normalizeCode(routeParameter(event, 'doctorId'), 'maBS');
  requireAuthenticated(event);
  await requireDoctorOwnership(event, doctorId);
  const relations = await appointmentRelations();
  return success((await repo.listAppointmentsByDoctor(doctorId)).map((item) => domain.mapAppointment(canonicalizeStoredAppointment(item), relations)));
}

async function handleGetAppointment(event) {
  requireAuthenticated(event);
  const id = domain.normalizeCode(routeParameter(event, 'appointmentId'), 'maLich');
  const item = canonicalizeStoredAppointment(
    await repo.assertExists(repo.findAppointment(id), 'APPOINTMENT_NOT_FOUND', 'Không tìm thấy lịch hẹn'),
  );
  await requirePatientOwnership(event, item.patientId);
  await requireDoctorOwnership(event, item.doctorId);
  const relations = await appointmentRelations();
  return success(domain.mapAppointment(item, relations));
}

async function handleCheckAppointment(event) {
  requireAuthenticated(event);
  const doctorId = domain.normalizeCode(queryParameter(event, 'maBS'), 'maBS');
  const date = queryParameter(event, 'ngay');
  const time = queryParameter(event, 'gio');
  const appointments = await repo.listAppointmentsByDoctor(doctorId);
  const trung = appointments.some(
    (item) =>
      item.appointmentDate === date &&
      item.appointmentTime === time &&
      item.status !== 'DA_HUY',
  );
  return json(200, { trung });
}

async function handleCreateAppointment(event) {
  const actor = requireAuthenticated(event);
  const body = parseJsonBody(event);

  // Bệnh nhân luôn đặt lịch bằng patientId đã liên kết với JWT. Không tin
  // maBN lưu ở localStorage vì dữ liệu cũ có thể là USER id hoặc Cognito sub.
  if (actor.groups.includes('BENHNHAN')) {
    const profile = await ensureApplicationProfile(event);
    if (!profile.appUser.patientId) {
      throw new ApiError(
        409,
        'PATIENT_PROFILE_REQUIRED',
        'Tài khoản chưa được liên kết với hồ sơ bệnh nhân',
      );
    }
    body.maBN = profile.appUser.patientId;
    body.patientId = profile.appUser.patientId;
  }

  let payload = domain.normalizeAppointmentPayload(body);
  await requirePatientOwnership(event, payload.patientId);
  await repo.assertExists(repo.findPatient(payload.patientId), 'PATIENT_NOT_FOUND', 'Không tìm thấy bệnh nhân');

  if (!payload.doctorId) {
    payload = { ...payload, doctorId: await autoAssignDoctor(payload) };
  }

  const doctor = await repo.assertExists(repo.findDoctor(payload.doctorId), 'DOCTOR_NOT_FOUND', 'Không tìm thấy bác sĩ');
  if (!payload.departmentId) payload = { ...payload, departmentId: doctor.departmentId };

  const availability = await isDoctorAvailable(
    payload.doctorId,
    payload.appointmentDate,
    payload.appointmentTime,
  );
  if (!availability.available) {
    const messages = {
      SHIFT_NOT_FOUND: 'Giờ khám không thuộc ca làm việc nào',
      DOCTOR_NOT_SCHEDULED: 'Bác sĩ không có lịch làm việc trong ca đã chọn',
      SLOT_OCCUPIED: 'Khung giờ này đã có lịch hẹn',
    };
    throw new ApiError(409, availability.reason, messages[availability.reason]);
  }

  const timestamp = nowIso();
  const items = buildAppointmentItems(payload, timestamp);
  await repo.transactWrite(
    Object.values(items).map((item) => ({
      Put: {
        TableName: getTableName(),
        Item: item,
        ConditionExpression:
          'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      },
    })),
  );

  await queue.publishEvent(
    'APPOINTMENT_CREATED',
    {
      appointmentId: payload.appointmentId,
      patientId: payload.patientId,
      doctorId: payload.doctorId,
      appointmentDateTime: payload.appointmentDateTime,
    },
    actor,
  );

  const relations = await appointmentRelations();
  return success(domain.mapAppointment(items.canonical, relations), 201);
}

async function handleUpdateAppointment(event) {
  const actor = requireGroups(event, ['ADMIN', 'NHANSU', 'BACSI']);
  const id = domain.normalizeCode(routeParameter(event, 'appointmentId'), 'maLich');
  const existing = canonicalizeStoredAppointment(
    await repo.assertExists(repo.findAppointment(id), 'APPOINTMENT_NOT_FOUND', 'Không tìm thấy lịch hẹn'),
  );
  await requireDoctorOwnership(event, existing.doctorId);
  const body = parseJsonBody(event);
  let payload = domain.normalizeAppointmentPayload(
    {
      ...existing,
      maBN: body.maBN || existing.patientId,
      maBS: body.maBS || existing.doctorId,
      maKhoa: body.maKhoa || existing.departmentId,
      ngayKham: body.ngayKham || existing.appointmentDate,
      gioKham: body.gioKham || existing.appointmentTime,
      phong: body.phong ?? existing.room,
      ghiChu: body.ghiChu ?? existing.note,
      trangThai: body.trangThai || existing.status,
      allowPast: true,
    },
    id,
  );

  const slotChanged =
    payload.patientId !== existing.patientId ||
    payload.doctorId !== existing.doctorId ||
    payload.appointmentDateTime !== existing.appointmentDateTime;

  if (slotChanged) {
    const availability = await isDoctorAvailable(
      payload.doctorId,
      payload.appointmentDate,
      payload.appointmentTime,
    );
    if (!availability.available) {
      throw new ApiError(409, availability.reason, 'Khung lịch mới không khả dụng');
    }
  }

  const timestamp = nowIso();
  const updatedItems = buildAppointmentItems(payload, existing.createdAt || timestamp);
  updatedItems.canonical.updatedAt = timestamp;
  updatedItems.patientRef.updatedAt = timestamp;
  updatedItems.doctorRef.updatedAt = timestamp;

  if (slotChanged) {
    const oldItems = buildAppointmentItems(existing, existing.createdAt || timestamp);
    await repo.transactWrite([
      ...[oldItems.patientRef, oldItems.doctorRef, oldItems.doctorLock, oldItems.patientLock].map((item) => ({
        Delete: { TableName: getTableName(), Key: { pk: item.pk, sk: item.sk } },
      })),
      ...[updatedItems.patientRef, updatedItems.doctorRef, updatedItems.doctorLock, updatedItems.patientLock].map((item) => ({
        Put: {
          TableName: getTableName(),
          Item: item,
          ConditionExpression:
            'attribute_not_exists(pk) AND attribute_not_exists(sk)',
        },
      })),
    ]);
  } else {
    await repo.putItem(updatedItems.patientRef);
    await repo.putItem(updatedItems.doctorRef);
  }
  await repo.putItem(updatedItems.canonical);

  await queue.publishEvent('APPOINTMENT_UPDATED', { appointmentId: id, status: payload.status }, actor);
  const relations = await appointmentRelations();
  return success(domain.mapAppointment(updatedItems.canonical, relations));
}

async function handleDeleteAppointment(event) {
  const actor = requireAuthenticated(event);
  const id = domain.normalizeCode(routeParameter(event, 'appointmentId'), 'maLich');
  const existing = canonicalizeStoredAppointment(
    await repo.assertExists(repo.findAppointment(id), 'APPOINTMENT_NOT_FOUND', 'Không tìm thấy lịch hẹn'),
  );
  await requirePatientOwnership(event, existing.patientId);
  if (!actor.groups.some((group) => ['ADMIN', 'NHANSU', 'BENHNHAN'].includes(group))) {
    throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền hủy lịch hẹn');
  }

  const items = buildAppointmentItems(existing, existing.createdAt || nowIso());
  const keySet = new Map();
  for (const item of Object.values(items)) {
    keySet.set(`${item.pk}|${item.sk}`, { pk: item.pk, sk: item.sk });
  }
  if (existing.pk && existing.sk) {
    keySet.set(`${existing.pk}|${existing.sk}`, { pk: existing.pk, sk: existing.sk });
  }

  await repo.transactWrite(
    [...keySet.values()].map((key) => ({
      Delete: { TableName: getTableName(), Key: key },
    })),
  );
  await queue.publishEvent('APPOINTMENT_CANCELLED', {
    appointmentId: id,
    patientId: existing.patientId,
    doctorId: existing.doctorId,
  }, actor);
  return success({ maLich: id, message: 'Đã hủy lịch hẹn' });
}

async function handleUpdateAppointmentStatus(event) {
  const id = domain.normalizeCode(routeParameter(event, 'appointmentId'), 'maLich');
  const body = parseJsonBody(event);
  return handleUpdateAppointment({
    ...event,
    body: JSON.stringify({ trangThai: body.trangThai || body.status }),
    pathParameters: { ...(event.pathParameters || {}), appointmentId: id },
  });
}

const handlers = Object.freeze({
  'GET /api/health': handleHealth,
  'GET /api/me': handleMe,
  'GET /api/auth/me': handleMe,
  'GET /api/admin/ping': handleAdminPing,

  'GET /api/tai-khoan': handleListAccounts,
  'POST /api/tai-khoan': handleCreateAccount,
  'GET /api/tai-khoan/{username}': handleGetAccount,
  'PUT /api/tai-khoan/{username}': handleUpdateAccount,
  'DELETE /api/tai-khoan/{username}': handleDisableAccount,
  'POST /api/tai-khoan/{username}/enable': handleEnableAccount,

  'GET /api/khoa': handleListDepartments,
  'POST /api/khoa': handleCreateDepartment,
  'GET /api/khoa/{departmentId}': handleGetDepartment,
  'PUT /api/khoa/{departmentId}': handleUpdateDepartment,
  'DELETE /api/khoa/{departmentId}': handleDeleteDepartment,

  'GET /api/phongkham': handleListRooms,
  'POST /api/phongkham': handleCreateRoom,
  'GET /api/phongkham/{roomId}': handleGetRoom,
  'PUT /api/phongkham/{roomId}': handleUpdateRoom,
  'DELETE /api/phongkham/{roomId}': handleDeleteRoom,

  'GET /api/phongkhamngoai': handleListExternalClinics,
  'POST /api/phongkhamngoai': handleCreateExternalClinic,
  'GET /api/phongkhamngoai/{clinicId}': handleGetExternalClinic,
  'PUT /api/phongkhamngoai/{clinicId}': handleUpdateExternalClinic,
  'DELETE /api/phongkhamngoai/{clinicId}': handleDeleteExternalClinic,

  'GET /api/bacsi': handleListDoctors,
  'POST /api/bacsi': handleCreateDoctor,
  'GET /api/bacsi/{doctorId}': handleGetDoctor,
  'PUT /api/bacsi/{doctorId}': handleUpdateDoctor,
  'DELETE /api/bacsi/{doctorId}': handleDeleteDoctor,
  'GET /api/bacsi/maTK/{maTK}': handleDoctorByAccount,
  'GET /api/bacsi/tk/{maTK}': handleDoctorByAccount,

  'GET /api/nhansu': handleListStaff,
  'POST /api/nhansu': handleCreateStaff,
  'GET /api/nhansu/{staffId}': handleGetStaff,
  'PUT /api/nhansu/{staffId}': handleUpdateStaff,
  'DELETE /api/nhansu/{staffId}': handleDeleteStaff,
  'GET /api/nhansu/maTK/{maTK}': handleStaffByAccount,

  'GET /api/catruc': handleListShifts,
  'POST /api/catruc': handleCreateShift,
  'GET /api/catruc/{shiftId}': handleGetShift,
  'PUT /api/catruc/{shiftId}': handleUpdateShift,
  'DELETE /api/catruc/{shiftId}': handleDeleteShift,

  'GET /api/lichlamviec': handleListSchedules,
  'POST /api/lichlamviec': handleCreateSchedule,
  'GET /api/lichlamviec/{scheduleId}': async (event) => {
    requireAuthenticated(event);
    const id = domain.normalizeCode(routeParameter(event, 'scheduleId'), 'maLichLV');
    const item = await repo.assertExists(repo.findSchedule(id), 'SCHEDULE_NOT_FOUND', 'Không tìm thấy lịch làm việc');
    return success(domain.mapSchedule(item, await scheduleRelations()));
  },
  'PUT /api/lichlamviec/{scheduleId}': handleUpdateSchedule,
  'DELETE /api/lichlamviec/{scheduleId}': handleDeleteSchedule,
  'GET /api/lichlamviec/bacsi/{doctorId}': handleSchedulesByDoctor,
  'GET /api/lichlamviec/nhansu/{staffId}': handleSchedulesByStaff,
  'GET /api/lichlamviec/soluong': handleSchedulePatientCount,

  'GET /api/lichkham': handleListAppointments,
  'POST /api/lichkham': handleCreateAppointment,
  'GET /api/lichkham/check': handleCheckAppointment,
  'GET /api/lichkham/{appointmentId}': handleGetAppointment,
  'PUT /api/lichkham/{appointmentId}': handleUpdateAppointment,
  'PATCH /api/lichkham/{appointmentId}/status': handleUpdateAppointmentStatus,
  'DELETE /api/lichkham/{appointmentId}': handleDeleteAppointment,
  'GET /api/lichkham/benhnhan/{patientId}': handlePatientAppointments,
  'GET /api/lichkham/bacsi/{doctorId}': handleDoctorAppointments,
});

module.exports = {
  handlers,
  handleAdminPing,
  handleHealth,
  handleMe,
  handleListAccounts,
  buildAppointmentItems,
  canonicalizeStoredAppointment,
  buildProfileItemsForAccount,
  ensureApplicationProfile,
  isDoctorAvailable,
  toFrontendAccount,
};
