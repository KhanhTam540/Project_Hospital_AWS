'use strict';

const {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
} = require('@aws-sdk/lib-dynamodb');
const {
  GetSecretValueCommand,
  SecretsManagerClient,
} = require('@aws-sdk/client-secrets-manager');
const {
  PublishCommand,
  SNSClient,
} = require('@aws-sdk/client-sns');

const { getCurrentUser, requireGroups } = require('../shared/auth');
const {
  ApiError,
  getRouteKey,
  handleError,
  json,
  parseJsonBody,
  requestId,
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
const {
  createSignedOtpToken,
  generateOtp,
  hashOtp,
  normalizeMoney,
  normalizePhone,
  normalizeProvider,
  signMomoCreate,
  signVnpay,
  sortedQueryString,
  verifyMomoCallback,
  verifySignedOtpToken,
  verifyVnpay,
  vnpDate,
} = require('./domain');

const secretClient = new SecretsManagerClient({});
const snsClient = new SNSClient({});
let cachedSecret;

const PAYMENT_SUCCESS_STATUSES = new Set([
  'PAID',
  'DA_THANH_TOAN',
  'SUCCESS',
]);

function requireEnvironment() {
  getTableName();
  if (!process.env.INTEGRATION_SECRET_ARN) {
    throw new Error('Missing INTEGRATION_SECRET_ARN environment variable');
  }
}

async function getSecret() {
  if (cachedSecret) return cachedSecret;
  const response = await secretClient.send(
    new GetSecretValueCommand({
      SecretId: process.env.INTEGRATION_SECRET_ARN,
    }),
  );
  const raw =
    response.SecretString ||
    Buffer.from(response.SecretBinary || '', 'base64').toString('utf8');
  cachedSecret = JSON.parse(raw || '{}');
  return cachedSecret;
}

function id(prefix) {
  return `${prefix}${Date.now().toString(36).toUpperCase()}${Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase()}`;
}

function normalizeStatus(value, fallback = 'PENDING') {
  const text = String(value || fallback).trim().toUpperCase();
  const aliases = {
    CHO_THANH_TOAN: 'PENDING',
    CHUA_THANH_TOAN: 'PENDING',
    DA_THANH_TOAN: 'PAID',
    THANH_CONG: 'PAID',
    THAT_BAI: 'FAILED',
    HUY: 'CANCELLED',
  };
  return aliases[text] || text;
}

function invoiceDirectKey(invoiceId) {
  return directKey('INVOICE', invoiceId);
}

function cartDirectKey(cartItemId) {
  return directKey('CART_ITEM', cartItemId);
}

function paymentDirectKey(paymentId) {
  return directKey('PAYMENT', paymentId);
}

function mapInvoice(item = {}) {
  return {
    ...item,
    maHD: item.invoiceId,
    maBN: item.patientId,
    maHSBA: item.medicalRecordId || null,
    appointmentId: item.appointmentId || null,
    maLich: item.appointmentId || null,
    tongTien: item.totalAmount,
    trangThai:
      item.status === 'PAID'
        ? 'DA_THANH_TOAN'
        : item.status === 'CANCELLED'
          ? 'DA_HUY'
          : 'CHUA_THANH_TOAN',
    ngayLap: item.createdAt,
    phuongThuc: item.paymentProvider || null,
  };
}

function mapCart(item = {}) {
  return {
    ...item,
    id: item.cartItemId,
    maCTGH: item.cartItemId,
    maBN: item.patientId,
    maDichVu: item.serviceId,
    tenDichVu: item.serviceName,
    loaiDichVu: item.serviceType,
    donGia: item.unitPrice,
    soLuong: item.quantity,
    thanhTien: item.lineTotal,
  };
}

function mapPayment(item = {}) {
  const status = String(item.status || '').toUpperCase();
  return {
    ...item,
    maTT: item.paymentId,
    maHD: item.invoiceId,
    soTien: item.amount,
    phuongThuc: item.provider,
    trangThai:
      status === 'SUCCESS'
        ? 'THANH_CONG'
        : status === 'FAILED'
          ? 'THAT_BAI'
          : item.status,
    ngayThanhToan: item.paidAt || item.createdAt,
  };
}

async function getInvoice(invoiceId) {
  const normalizedId = normalizeId(invoiceId, 'invoiceId');
  const response = await getDocumentClient().send(
    new GetCommand({
      TableName: getTableName(),
      Key: invoiceDirectKey(normalizedId),
    }),
  );
  if (!response.Item) {
    throw new ApiError(404, 'INVOICE_NOT_FOUND', 'Invoice not found');
  }
  return response.Item;
}

async function getPatient(patientId) {
  const normalizedId = normalizeId(patientId, 'patientId');
  const response = await getDocumentClient().send(
    new GetCommand({
      TableName: getTableName(),
      Key: { pk: `PATIENT#${normalizedId}`, sk: 'PROFILE' },
    }),
  );
  if (!response.Item) {
    throw new ApiError(404, 'PATIENT_NOT_FOUND', 'Patient not found');
  }
  return response.Item;
}

async function findMedicalRecord(recordId) {
  const normalizedId = normalizeId(recordId, 'medicalRecordId');
  const direct = await getDocumentClient().send(
    new GetCommand({
      TableName: getTableName(),
      Key: directKey('RECORD', normalizedId),
    }),
  );
  if (direct.Item) return direct.Item;

  const scan = await getDocumentClient().send(
    new ScanCommand({
      TableName: getTableName(),
      FilterExpression: 'entityType = :type AND recordId = :id',
      ExpressionAttributeValues: {
        ':type': 'MEDICAL_RECORD',
        ':id': normalizedId,
      },
      Limit: 1,
    }),
  );
  return scan.Items?.[0] || null;
}

async function assertPatientAccess(event, patientId) {
  const user = requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN']);
  if (!user.groups.includes('BENHNHAN')) return user;

  const patient = await getPatient(patientId);
  const candidates = [
    patient.accountUserId,
    patient.cognitoSub,
    patient.maTK,
    patient.userId,
  ]
    .filter(Boolean)
    .map(String);

  if (!candidates.includes(String(user.sub))) {
    throw new ApiError(
      403,
      'PATIENT_ACCESS_DENIED',
      'A patient can only access their own billing data',
    );
  }
  return user;
}

function invoiceProjection(item) {
  return {
    ...item,
    pk: `PATIENT#${item.patientId}`,
    sk: item.patientSk,
  };
}

function recordInvoiceProjection(item) {
  if (!item.medicalRecordId || !item.recordSk) return null;
  return {
    ...item,
    pk: `RECORD#${item.medicalRecordId}`,
    sk: item.recordSk,
  };
}

async function inferPatientMedicalRecordId(patientId) {
  const response = await getDocumentClient().send(
    new ScanCommand({
      TableName: getTableName(),
      FilterExpression:
        'patientId = :patientId AND (#type = :record OR #type = :medicalRecord)',
      ExpressionAttributeNames: { '#type': 'entityType' },
      ExpressionAttributeValues: {
        ':patientId': patientId,
        ':record': 'RECORD',
        ':medicalRecord': 'MEDICAL_RECORD',
      },
    }),
  );

  const records = response.Items || [];
  const cccdRecord = records.find((item) =>
    /^\d{12}$/.test(String(item.recordId || item.medicalRecordId || item.citizenId || '')),
  );
  const selected = cccdRecord || records[0];
  return selected?.recordId || selected?.medicalRecordId || selected?.citizenId || null;
}

async function appointmentPaymentWrites(appointmentId, invoice, paymentId, timestamp) {
  if (!appointmentId || normalizeStatus(invoice.status) !== 'PAID') return [];
  const response = await getDocumentClient().send(
    new ScanCommand({
      TableName: getTableName(),
      FilterExpression:
        'appointmentId = :appointmentId AND (#type = :appt OR #type = :ref OR #type = :slot)',
      ExpressionAttributeNames: { '#type': 'entityType' },
      ExpressionAttributeValues: {
        ':appointmentId': appointmentId,
        ':appt': 'APPOINTMENT',
        ':ref': 'APPOINTMENT_REF',
        ':slot': 'APPOINTMENT_SLOT',
      },
    }),
  );

  const seen = new Set();
  return (response.Items || [])
    .filter((item) => {
      const key = `${item.pk}|${item.sk}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item) => ({
      Put: {
        TableName: getTableName(),
        Item: {
          ...item,
          status: 'DA_THANH_TOAN',
          trangThai: 'DA_THANH_TOAN',
          invoiceId: invoice.invoiceId,
          maHD: invoice.invoiceId,
          paymentId,
          paidAt: timestamp,
          updatedAt: timestamp,
        },
      },
    }));
}

async function putInvoice(item, { conditionNew = false } = {}) {
  const transactItems = [
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
        Item: invoiceProjection(item),
      },
    },
  ];
  const recordProjection = recordInvoiceProjection(item);
  if (recordProjection) {
    transactItems.push({
      Put: {
        TableName: getTableName(),
        Item: recordProjection,
      },
    });
  }
  await getDocumentClient().send(
    new TransactWriteCommand({ TransactItems: transactItems }),
  );
}

async function createInvoiceFromBody(event, body, cartItems = []) {
  const user = requireGroups(event, ['ADMIN', 'NHANSU', 'BENHNHAN']);
  const patientId = normalizeId(body.patientId || body.maBN, 'patientId');
  await assertPatientAccess(event, patientId);

  let medicalRecordId = body.medicalRecordId || body.maHSBA
    ? normalizeId(body.medicalRecordId || body.maHSBA, 'medicalRecordId')
    : null;

  if (!medicalRecordId) {
    medicalRecordId = await inferPatientMedicalRecordId(patientId);
  }

  if (medicalRecordId) {
    const record = await findMedicalRecord(medicalRecordId);
    if (!record || record.patientId !== patientId) {
      throw new ApiError(
        400,
        'INVALID_MEDICAL_RECORD',
        'Medical record does not belong to the selected patient',
      );
    }
  }

  const sourceItems = Array.isArray(body.items) && body.items.length
    ? body.items
    : cartItems;
  const normalizedItems = sourceItems.map((source, index) => {
    const quantity = Math.max(1, Math.round(Number(source.quantity || source.soLuong || 1)));
    const unitPrice = normalizeMoney(source.unitPrice || source.donGia, `items[${index}].unitPrice`);
    return {
      itemId: normalizeId(source.itemId || source.maCTHD || id('ITEM'), 'itemId'),
      serviceId: String(source.serviceId || source.maDichVu || '').trim() || null,
      serviceName: String(source.serviceName || source.tenDichVu || source.name || 'Dịch vụ y tế').trim(),
      serviceType: String(source.serviceType || source.loaiDichVu || 'MEDICAL').trim().toUpperCase(),
      quantity,
      unitPrice,
      lineTotal: quantity * unitPrice,
    };
  });

  const requestedTotal = Number(body.totalAmount || body.tongTien || 0);
  const calculatedTotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const totalAmount = calculatedTotal > 0
    ? calculatedTotal
    : normalizeMoney(requestedTotal, 'totalAmount');

  const invoiceId = normalizeId(body.invoiceId || body.maHD || id('HD'), 'invoiceId');
  const timestamp = nowIso();
  const patientSk = `INVOICE#${timestamp}#${invoiceId}`;
  const recordSk = medicalRecordId
    ? `INVOICE#${timestamp}#${invoiceId}`
    : null;
  const item = {
    ...invoiceDirectKey(invoiceId),
    entityType: 'INVOICE',
    invoiceId,
    patientId,
    medicalRecordId,
    recordId: medicalRecordId,
    patientSk,
    recordSk,
    appointmentId: body.appointmentId || body.maLich || null,
    items: normalizedItems,
    totalAmount,
    currency: 'VND',
    status: 'PENDING',
    paymentProvider: null,
    description: String(body.description || body.noiDung || '').trim() || null,
    createdBy: user.sub,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };
  await putInvoice(item, { conditionNew: true });
  return item;
}

async function listInvoices(event) {
  requireGroups(event, ['ADMIN', 'NHANSU']);
  const response = await getDocumentClient().send(
    new ScanCommand({
      TableName: getTableName(),
      FilterExpression: 'entityType = :entityType AND sk = :metadata',
      ExpressionAttributeValues: {
        ':entityType': 'INVOICE',
        ':metadata': 'METADATA',
      },
    }),
  );
  const items = (response.Items || [])
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map(mapInvoice);
  return success(items);
}

async function createInvoice(event) {
  const item = await createInvoiceFromBody(event, parseJsonBody(event));
  return success(mapInvoice(item), 201);
}

async function readInvoice(event) {
  const item = await getInvoice(routeParameter(event, 'invoiceId'));
  await assertPatientAccess(event, item.patientId);
  return success(mapInvoice(item));
}

async function updateInvoice(event) {
  requireGroups(event, ['ADMIN', 'NHANSU']);
  const current = await getInvoice(routeParameter(event, 'invoiceId'));
  if (PAYMENT_SUCCESS_STATUSES.has(normalizeStatus(current.status))) {
    throw new ApiError(409, 'INVOICE_ALREADY_PAID', 'A paid invoice cannot be edited');
  }
  const body = parseJsonBody(event);
  const nextItems = Array.isArray(body.items) ? body.items : current.items;
  const normalizedItems = nextItems.map((source, index) => {
    const quantity = Math.max(1, Math.round(Number(source.quantity || source.soLuong || 1)));
    const unitPrice = normalizeMoney(source.unitPrice || source.donGia, `items[${index}].unitPrice`);
    return {
      ...source,
      itemId: normalizeId(source.itemId || source.maCTHD || id('ITEM'), 'itemId'),
      quantity,
      unitPrice,
      lineTotal: quantity * unitPrice,
    };
  });
  const next = {
    ...current,
    items: normalizedItems,
    totalAmount: normalizedItems.length
      ? normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0)
      : normalizeMoney(body.totalAmount || body.tongTien || current.totalAmount),
    description:
      body.description !== undefined || body.noiDung !== undefined
        ? String(body.description || body.noiDung || '').trim() || null
        : current.description,
    status: normalizeStatus(body.status || body.trangThai, current.status),
    updatedAt: nowIso(),
    version: Number(current.version || 1) + 1,
  };
  await putInvoice(next);
  return success(mapInvoice(next));
}

async function addInvoiceDetail(event) {
  requireGroups(event, ['ADMIN', 'NHANSU']);
  const body = parseJsonBody(event);
  const current = await getInvoice(body.invoiceId || body.maHD);
  const item = {
    itemId: normalizeId(body.itemId || body.maCTHD || id('ITEM'), 'itemId'),
    serviceId: String(body.serviceId || body.maDichVu || '').trim() || null,
    serviceName: String(body.serviceName || body.tenDichVu || 'Dịch vụ y tế').trim(),
    serviceType: String(body.serviceType || body.loaiDichVu || 'MEDICAL').trim().toUpperCase(),
    quantity: Math.max(1, Math.round(Number(body.quantity || body.soLuong || 1))),
    unitPrice: normalizeMoney(body.unitPrice || body.donGia, 'unitPrice'),
  };
  item.lineTotal = item.quantity * item.unitPrice;
  const next = {
    ...current,
    items: [...(current.items || []), item],
    totalAmount: Number(current.totalAmount || 0) + item.lineTotal,
    updatedAt: nowIso(),
    version: Number(current.version || 1) + 1,
  };
  await putInvoice(next);
  return success(mapInvoice(next), 201);
}

async function patientInvoices(event) {
  const patientId = normalizeId(routeParameter(event, 'patientId'), 'patientId');
  await assertPatientAccess(event, patientId);
  const response = await getDocumentClient().send(
    new QueryCommand({
      TableName: getTableName(),
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `PATIENT#${patientId}`,
        ':prefix': 'INVOICE#',
      },
      ScanIndexForward: false,
    }),
  );
  return success((response.Items || []).map(mapInvoice));
}

async function invoiceStatistics(event) {
  requireGroups(event, ['ADMIN']);
  const response = await getDocumentClient().send(
    new ScanCommand({
      TableName: getTableName(),
      FilterExpression: 'entityType = :entityType AND sk = :metadata',
      ExpressionAttributeValues: {
        ':entityType': 'INVOICE',
        ':metadata': 'METADATA',
      },
      ProjectionExpression: 'invoiceId, totalAmount, #status, createdAt',
      ExpressionAttributeNames: { '#status': 'status' },
    }),
  );
  const items = response.Items || [];
  return success({
    tongSo: items.length,
    tongTien: items.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
    daThanhToan: items.filter((item) => PAYMENT_SUCCESS_STATUSES.has(normalizeStatus(item.status))).length,
    chuaThanhToan: items.filter((item) => !PAYMENT_SUCCESS_STATUSES.has(normalizeStatus(item.status))).length,
  });
}

async function listCart(event) {
  const patientId = normalizeId(routeParameter(event, 'patientId'), 'patientId');
  await assertPatientAccess(event, patientId);
  const response = await getDocumentClient().send(
    new QueryCommand({
      TableName: getTableName(),
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `PATIENT#${patientId}`,
        ':prefix': 'CART#',
      },
      ScanIndexForward: true,
    }),
  );
  return success((response.Items || []).map(mapCart));
}

async function addCartItem(event) {
  const body = parseJsonBody(event);
  const patientId = normalizeId(body.patientId || body.maBN, 'patientId');
  const user = await assertPatientAccess(event, patientId);
  const cartItemId = normalizeId(body.cartItemId || body.maCTGH || id('GH'), 'cartItemId');
  const quantity = Math.max(1, Math.round(Number(body.quantity || body.soLuong || 1)));
  const unitPrice = normalizeMoney(body.unitPrice || body.donGia, 'unitPrice');
  const timestamp = nowIso();
  const patientSk = `CART#${timestamp}#${cartItemId}`;
  const item = {
    ...cartDirectKey(cartItemId),
    entityType: 'CART_ITEM',
    cartItemId,
    patientId,
    patientSk,
    medicalRecordId: body.medicalRecordId || body.maHSBA
      ? normalizeId(body.medicalRecordId || body.maHSBA, 'medicalRecordId')
      : null,
    serviceId: String(body.serviceId || body.maDichVu || '').trim() || null,
    serviceName: String(body.serviceName || body.tenDichVu || body.name || 'Dịch vụ y tế').trim(),
    serviceType: String(body.serviceType || body.loaiDichVu || 'MEDICAL').trim().toUpperCase(),
    quantity,
    unitPrice,
    lineTotal: quantity * unitPrice,
    createdBy: user.sub,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await getDocumentClient().send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: getTableName(),
            Item: item,
            ConditionExpression: 'attribute_not_exists(pk)',
          },
        },
        {
          Put: {
            TableName: getTableName(),
            Item: { ...item, pk: `PATIENT#${patientId}`, sk: patientSk },
          },
        },
      ],
    }),
  );
  return success(mapCart(item), 201);
}

async function deleteCartItem(event) {
  const itemId = normalizeId(routeParameter(event, 'itemId'), 'itemId');
  const response = await getDocumentClient().send(
    new GetCommand({
      TableName: getTableName(),
      Key: cartDirectKey(itemId),
    }),
  );
  if (!response.Item) {
    throw new ApiError(404, 'CART_ITEM_NOT_FOUND', 'Cart item not found');
  }
  await assertPatientAccess(event, response.Item.patientId);
  await getDocumentClient().send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Delete: {
            TableName: getTableName(),
            Key: cartDirectKey(itemId),
          },
        },
        {
          Delete: {
            TableName: getTableName(),
            Key: {
              pk: `PATIENT#${response.Item.patientId}`,
              sk: response.Item.patientSk,
            },
          },
        },
      ],
    }),
  );
  return success({ cartItemId: itemId, deleted: true });
}

async function confirmCart(event) {
  const body = parseJsonBody(event);
  const patientId = normalizeId(body.patientId || body.maBN, 'patientId');
  await assertPatientAccess(event, patientId);
  const response = await getDocumentClient().send(
    new QueryCommand({
      TableName: getTableName(),
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `PATIENT#${patientId}`,
        ':prefix': 'CART#',
      },
    }),
  );
  const cartItems = response.Items || [];
  if (!cartItems.length) {
    throw new ApiError(400, 'CART_EMPTY', 'Cart is empty');
  }
  const invoice = await createInvoiceFromBody(
    event,
    { ...body, patientId },
    cartItems,
  );

  const deletes = [];
  for (const item of cartItems) {
    deletes.push(
      {
        Delete: {
          TableName: getTableName(),
          Key: cartDirectKey(item.cartItemId),
        },
      },
      {
        Delete: {
          TableName: getTableName(),
          Key: { pk: `PATIENT#${patientId}`, sk: item.sk },
        },
      },
    );
  }
  for (let index = 0; index < deletes.length; index += 100) {
    await getDocumentClient().send(
      new TransactWriteCommand({
        TransactItems: deletes.slice(index, index + 100),
      }),
    );
  }
  return success(mapInvoice(invoice), 201);
}

async function recordPayment({ invoice, provider, providerTransactionId, requestIdValue, status, raw, amount }) {
  const normalizedAmount = normalizeMoney(amount, 'amount');
  if (normalizedAmount !== Number(invoice.totalAmount)) {
    throw new ApiError(400, 'PAYMENT_AMOUNT_MISMATCH', 'Payment amount does not match invoice total');
  }

  const paymentId = normalizeId(
    `${provider}-${providerTransactionId || requestIdValue || invoice.invoiceId}`,
    'paymentId',
  );
  const timestamp = nowIso();
  const payment = {
    ...paymentDirectKey(paymentId),
    entityType: 'PAYMENT',
    paymentId,
    invoiceId: invoice.invoiceId,
    patientId: invoice.patientId,
    medicalRecordId: invoice.medicalRecordId || null,
    provider,
    providerTransactionId: providerTransactionId || null,
    requestId: requestIdValue || null,
    amount: normalizedAmount,
    currency: 'VND',
    status,
    rawSummary: raw || null,
    createdAt: timestamp,
    paidAt: status === 'SUCCESS' ? timestamp : null,
    expiresAt: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
  };

  const nextInvoice = {
    ...invoice,
    status: status === 'SUCCESS' ? 'PAID' : status === 'FAILED' ? 'FAILED' : invoice.status,
    trangThai: status === 'SUCCESS' ? 'DA_THANH_TOAN' : invoice.trangThai || undefined,
    paymentProvider: provider,
    paymentId,
    paidAt: status === 'SUCCESS' ? timestamp : invoice.paidAt || null,
    updatedAt: timestamp,
    version: Number(invoice.version || 1) + 1,
  };

  const transactItems = [
    {
      Put: {
        TableName: getTableName(),
        Item: payment,
        ConditionExpression: 'attribute_not_exists(pk)',
      },
    },
    {
      Put: {
        TableName: getTableName(),
        Item: {
          ...payment,
          pk: `INVOICE#${invoice.invoiceId}`,
          sk: `PAYMENT#${timestamp}#${paymentId}`,
        },
      },
    },
    { Put: { TableName: getTableName(), Item: nextInvoice } },
    { Put: { TableName: getTableName(), Item: invoiceProjection(nextInvoice) } },
  ];
  const recordProjection = recordInvoiceProjection(nextInvoice);
  if (recordProjection) {
    transactItems.push({ Put: { TableName: getTableName(), Item: recordProjection } });
  }

  const appointmentWrites = await appointmentPaymentWrites(
    nextInvoice.appointmentId,
    nextInvoice,
    paymentId,
    timestamp,
  );
  transactItems.push(...appointmentWrites);

  if (transactItems.length > 100) {
    throw new ApiError(500, 'PAYMENT_TRANSACTION_TOO_LARGE', 'Too many related appointment items to update in one payment transaction');
  }

  try {
    await getDocumentClient().send(
      new TransactWriteCommand({ TransactItems: transactItems }),
    );
  } catch (error) {
    if (error.name === 'TransactionCanceledException') {
      const existing = await getDocumentClient().send(
        new GetCommand({
          TableName: getTableName(),
          Key: paymentDirectKey(paymentId),
        }),
      );
      if (existing.Item) {
        return { payment: existing.Item, invoice: await getInvoice(invoice.invoiceId), duplicate: true };
      }
    }
    throw error;
  }
  return { payment, invoice: nextInvoice, duplicate: false };
}

async function listInvoicePayments(event) {
  const invoice = await getInvoice(routeParameter(event, 'invoiceId'));
  await assertPatientAccess(event, invoice.patientId);
  const response = await getDocumentClient().send(
    new QueryCommand({
      TableName: getTableName(),
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `INVOICE#${invoice.invoiceId}`,
        ':prefix': 'PAYMENT#',
      },
      ScanIndexForward: false,
    }),
  );
  return success((response.Items || []).map(mapPayment));
}

async function manualPayment(event) {
  const user = requireGroups(event, ['ADMIN', 'NHANSU', 'BENHNHAN']);
  const body = parseJsonBody(event);
  const invoice = await getInvoice(body.invoiceId || body.maHD);
  await assertPatientAccess(event, invoice.patientId);

  if (PAYMENT_SUCCESS_STATUSES.has(normalizeStatus(invoice.status))) {
    throw new ApiError(409, 'INVOICE_ALREADY_PAID', 'Invoice is already paid');
  }

  const provider = normalizeProvider(
    body.provider || body.phuongThuc || 'BANK_TRANSFER',
  );

  if (!['CASH', 'BANK_TRANSFER'].includes(provider)) {
    throw new ApiError(
      400,
      'DEMO_PAYMENT_PROVIDER_REQUIRED',
      'Demo payment only supports CASH or BANK_TRANSFER. Use /api/payment/create-url for VNPAY or MOMO.',
    );
  }

  const result = await recordPayment({
    invoice,
    provider,
    providerTransactionId:
      body.transactionId ||
      body.maGiaoDich ||
      `${provider}-${Date.now().toString(36).toUpperCase()}`,
    requestIdValue: body.requestId || null,
    status: 'SUCCESS',
    amount: body.amount || body.soTien || invoice.totalAmount,
    raw: {
      demoPayment: true,
      confirmedBy: user.sub,
      confirmedGroup: user.groups?.[0] || null,
      note: body.note || body.ghiChu || null,
    },
  });

  return success({
    success: true,
    message: 'Thanh toán demo thành công',
    payment: mapPayment(result.payment),
    invoice: mapInvoice(result.invoice),
    duplicate: result.duplicate,
  }, 201);
}

async function createPaymentUrl(event) {
  const body = parseJsonBody(event);
  const invoice = await getInvoice(body.invoiceId || body.maHD);
  await assertPatientAccess(event, invoice.patientId);
  if (PAYMENT_SUCCESS_STATUSES.has(normalizeStatus(invoice.status))) {
    throw new ApiError(409, 'INVOICE_ALREADY_PAID', 'Invoice is already paid');
  }
  const provider = normalizeProvider(body.provider || body.phuongThuc);
  if (!['VNPAY', 'MOMO'].includes(provider)) {
    throw new ApiError(400, 'ONLINE_PROVIDER_REQUIRED', 'Provider must be VNPAY or MOMO');
  }

  const secret = await getSecret();
  if (String(process.env.REQUIRE_PAYMENT_OTP || 'false').toLowerCase() === 'true') {
    const user = getCurrentUser(event);
    const purpose = `PAYMENT_${invoice.invoiceId}`;
    if (!verifySignedOtpToken({
      token: body.otpToken,
      secret: secret.INTERNAL_SIGNING_KEY,
      subject: user.sub,
      purpose,
    })) {
      throw new ApiError(403, 'PAYMENT_OTP_REQUIRED', 'A valid payment OTP token is required');
    }
  }

  const paymentRequestId = normalizeId(body.requestId || id('REQ'), 'requestId');
  const requestItem = {
    ...directKey('PAYMENT_REQUEST', paymentRequestId),
    entityType: 'PAYMENT_REQUEST',
    requestId: paymentRequestId,
    invoiceId: invoice.invoiceId,
    patientId: invoice.patientId,
    provider,
    amount: invoice.totalAmount,
    status: 'CREATED',
    createdAt: nowIso(),
    expiresAt: Math.floor(Date.now() / 1000) + 30 * 60,
  };
  try {
    await getDocumentClient().send(
      new PutCommand({
        TableName: getTableName(),
        Item: requestItem,
        ConditionExpression: 'attribute_not_exists(pk)',
      }),
    );
  } catch (error) {
    if (error.name !== 'ConditionalCheckFailedException') throw error;
  }

  let paymentUrl;
  if (provider === 'VNPAY') {
    const required = ['VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET', 'VNPAY_PAYMENT_URL', 'VNPAY_RETURN_URL'];
    for (const field of required) {
      if (!secret[field] || secret[field] === 'SET_IN_AWS_CONSOLE') {
        throw new ApiError(500, 'VNPAY_NOT_CONFIGURED', `${field} is not configured in Secrets Manager`);
      }
    }
    const createDate = vnpDate();
    const params = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: secret.VNPAY_TMN_CODE,
      vnp_Amount: Number(invoice.totalAmount) * 100,
      vnp_CurrCode: 'VND',
      vnp_TxnRef: paymentRequestId,
      vnp_OrderInfo: `Thanh toan hoa don ${invoice.invoiceId}`,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: secret.VNPAY_RETURN_URL,
      vnp_IpAddr: event.requestContext?.http?.sourceIp || '127.0.0.1',
      vnp_CreateDate: createDate,
    };
    const signature = signVnpay(params, secret.VNPAY_HASH_SECRET);
    paymentUrl = `${String(secret.VNPAY_PAYMENT_URL).replace(/\?$/, '')}?${sortedQueryString({ ...params, vnp_SecureHash: signature })}`;
  } else {
    const required = [
      'MOMO_PARTNER_CODE',
      'MOMO_ACCESS_KEY',
      'MOMO_SECRET_KEY',
      'MOMO_ENDPOINT',
      'MOMO_REDIRECT_URL',
      'MOMO_IPN_URL',
    ];
    for (const field of required) {
      if (!secret[field] || secret[field] === 'SET_IN_AWS_CONSOLE') {
        throw new ApiError(500, 'MOMO_NOT_CONFIGURED', `${field} is not configured in Secrets Manager`);
      }
    }
    const payload = {
      partnerCode: secret.MOMO_PARTNER_CODE,
      partnerName: 'Hospital P2TB',
      storeId: 'HospitalP2TB',
      requestId: paymentRequestId,
      amount: String(invoice.totalAmount),
      orderId: paymentRequestId,
      orderInfo: `Thanh toan hoa don ${invoice.invoiceId}`,
      redirectUrl: secret.MOMO_REDIRECT_URL,
      ipnUrl: secret.MOMO_IPN_URL,
      lang: 'vi',
      requestType: 'captureWallet',
      autoCapture: true,
      extraData: Buffer.from(
        JSON.stringify({ invoiceId: invoice.invoiceId }),
        'utf8',
      ).toString('base64'),
    };
    payload.signature = signMomoCreate(
      payload,
      secret.MOMO_ACCESS_KEY,
      secret.MOMO_SECRET_KEY,
    );
    const response = await fetch(secret.MOMO_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok || !result.payUrl) {
      throw new ApiError(502, 'MOMO_CREATE_FAILED', result.message || 'MoMo did not return a payment URL');
    }
    paymentUrl = result.payUrl;
  }

  return json(200, {
    success: true,
    paymentUrl,
    provider,
    invoiceId: invoice.invoiceId,
    requestId: paymentRequestId,
  });
}

async function getPaymentRequest(requestIdValue) {
  const response = await getDocumentClient().send(
    new GetCommand({
      TableName: getTableName(),
      Key: directKey('PAYMENT_REQUEST', normalizeId(requestIdValue, 'requestId')),
    }),
  );
  if (!response.Item) {
    throw new ApiError(404, 'PAYMENT_REQUEST_NOT_FOUND', 'Payment request not found');
  }
  return response.Item;
}

async function processVnpay(event, { redirect }) {
  const params = event.queryStringParameters || {};
  const secret = await getSecret();
  if (!verifyVnpay(params, secret.VNPAY_HASH_SECRET)) {
    if (redirect) return paymentRedirect(secret, 'fail', null, 'Chữ ký VNPay không hợp lệ');
    return json(200, { RspCode: '97', Message: 'Invalid signature' });
  }

  const request = await getPaymentRequest(params.vnp_TxnRef);
  const invoice = await getInvoice(request.invoiceId);
  const amount = Math.round(Number(params.vnp_Amount || 0) / 100);
  if (amount !== Number(invoice.totalAmount)) {
    if (redirect) return paymentRedirect(secret, 'fail', invoice.invoiceId, 'Số tiền không khớp');
    return json(200, { RspCode: '04', Message: 'Invalid amount' });
  }

  const successful = params.vnp_ResponseCode === '00' && params.vnp_TransactionStatus === '00';
  const result = await recordPayment({
    invoice,
    provider: 'VNPAY',
    providerTransactionId: params.vnp_TransactionNo || params.vnp_BankTranNo || params.vnp_TxnRef,
    requestIdValue: params.vnp_TxnRef,
    status: successful ? 'SUCCESS' : 'FAILED',
    amount,
    raw: {
      responseCode: params.vnp_ResponseCode,
      transactionStatus: params.vnp_TransactionStatus,
      bankCode: params.vnp_BankCode || null,
    },
  });

  if (redirect) {
    return paymentRedirect(
      secret,
      successful ? 'success' : 'fail',
      invoice.invoiceId,
      successful ? 'Thanh toán VNPay thành công' : 'Thanh toán VNPay thất bại',
    );
  }
  return json(200, {
    RspCode: '00',
    Message: result.duplicate ? 'Order already confirmed' : 'Confirm Success',
  });
}

function paymentRedirect(secret, status, invoiceId, message) {
  const base = String(secret.PAYMENT_RESULT_URL || secret.VNPAY_FRONTEND_RESULT_URL || '').trim();
  if (!base) {
    return json(200, { success: status === 'success', status, maHD: invoiceId, message });
  }
  const url = new URL(base);
  url.searchParams.set('status', status);
  if (invoiceId) url.searchParams.set('maHD', invoiceId);
  if (message) url.searchParams.set('message', message);
  return {
    statusCode: 302,
    headers: {
      location: url.toString(),
      'cache-control': 'no-store',
    },
    body: '',
  };
}

async function vnpayReturn(event) {
  return processVnpay(event, { redirect: true });
}

async function vnpayIpn(event) {
  return processVnpay(event, { redirect: false });
}

async function processMomo(event, { redirect }) {
  const body = event.body
    ? parseJsonBody(event)
    : (event.queryStringParameters || {});
  const secret = await getSecret();
  if (!verifyMomoCallback(body, secret.MOMO_ACCESS_KEY, secret.MOMO_SECRET_KEY)) {
    if (redirect) return paymentRedirect(secret, 'fail', null, 'Chữ ký MoMo không hợp lệ');
    return json(400, { resultCode: 97, message: 'Invalid signature' });
  }
  const request = await getPaymentRequest(body.requestId || body.orderId);
  const invoice = await getInvoice(request.invoiceId);
  const successful = Number(body.resultCode) === 0;
  const result = await recordPayment({
    invoice,
    provider: 'MOMO',
    providerTransactionId: body.transId || body.orderId,
    requestIdValue: body.requestId || body.orderId,
    status: successful ? 'SUCCESS' : 'FAILED',
    amount: body.amount,
    raw: {
      resultCode: Number(body.resultCode),
      message: body.message || null,
      payType: body.payType || null,
    },
  });
  if (redirect) {
    return paymentRedirect(
      secret,
      successful ? 'success' : 'fail',
      invoice.invoiceId,
      successful ? 'Thanh toán MoMo thành công' : 'Thanh toán MoMo thất bại',
    );
  }
  return json(204, {
    resultCode: 0,
    message: result.duplicate ? 'Already processed' : 'Success',
  });
}

async function momoCallback(event) {
  return processMomo(event, { redirect: true });
}

async function momoIpn(event) {
  return processMomo(event, { redirect: false });
}

function otpKey(subject, purpose) {
  return {
    pk: `OTP#${normalizeId(subject, 'subject')}#${normalizeId(purpose, 'purpose')}`,
    sk: 'ACTIVE',
  };
}

async function sendOtp(event) {
  const user = requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN']);
  const body = parseJsonBody(event);
  const phoneNumber = normalizePhone(body.phoneNumber || body.soDienThoai);
  const purpose = normalizeId(body.purpose || 'GENERAL', 'purpose');
  const key = otpKey(user.sub, purpose);
  const existing = await getDocumentClient().send(
    new GetCommand({ TableName: getTableName(), Key: key }),
  );
  const now = Date.now();
  if (existing.Item && Number(existing.Item.resendAfter || 0) > now) {
    throw new ApiError(
      429,
      'OTP_RATE_LIMITED',
      `Please wait ${Math.ceil((existing.Item.resendAfter - now) / 1000)} seconds before requesting another OTP`,
    );
  }

  const secret = await getSecret();
  const otp = generateOtp();
  const expiresAtMs = now + 5 * 60 * 1000;
  const item = {
    ...key,
    entityType: 'OTP_CHALLENGE',
    subject: user.sub,
    purpose,
    phoneNumber,
    otpHash: hashOtp({
      secret: secret.INTERNAL_SIGNING_KEY,
      subject: user.sub,
      purpose,
      otp,
    }),
    attempts: 0,
    maxAttempts: 5,
    resendAfter: now + 60 * 1000,
    expiresAtMs,
    expiresAt: Math.floor(expiresAtMs / 1000),
    createdAt: nowIso(),
  };
  await getDocumentClient().send(
    new PutCommand({ TableName: getTableName(), Item: item }),
  );
  await snsClient.send(
    new PublishCommand({
      PhoneNumber: phoneNumber,
      Message: `Ma OTP Hospital P2TB cua ban la ${otp}. Ma co hieu luc trong 5 phut. Khong chia se ma nay.`,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional',
        },
      },
    }),
  );
  return success({
    purpose,
    expiresInSeconds: 300,
    resendAfterSeconds: 60,
  });
}

async function verifyOtp(event) {
  const user = requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN']);
  const body = parseJsonBody(event);
  const purpose = normalizeId(body.purpose || 'GENERAL', 'purpose');
  const otp = String(body.otp || body.maOtp || '').trim();
  if (!/^\d{6}$/.test(otp)) {
    throw new ApiError(400, 'INVALID_OTP_FORMAT', 'OTP must contain exactly 6 digits');
  }
  const key = otpKey(user.sub, purpose);
  const response = await getDocumentClient().send(
    new GetCommand({ TableName: getTableName(), Key: key }),
  );
  const challenge = response.Item;
  if (!challenge || Number(challenge.expiresAtMs || 0) <= Date.now()) {
    throw new ApiError(400, 'OTP_EXPIRED', 'OTP has expired or does not exist');
  }
  if (Number(challenge.attempts || 0) >= Number(challenge.maxAttempts || 5)) {
    throw new ApiError(429, 'OTP_ATTEMPTS_EXCEEDED', 'Maximum OTP attempts exceeded');
  }

  const secret = await getSecret();
  const receivedHash = hashOtp({
    secret: secret.INTERNAL_SIGNING_KEY,
    subject: user.sub,
    purpose,
    otp,
  });
  if (receivedHash !== challenge.otpHash) {
    await getDocumentClient().send(
      new PutCommand({
        TableName: getTableName(),
        Item: {
          ...challenge,
          attempts: Number(challenge.attempts || 0) + 1,
          updatedAt: nowIso(),
        },
      }),
    );
    throw new ApiError(400, 'OTP_INVALID', 'OTP is incorrect');
  }

  await getDocumentClient().send(
    new DeleteCommand({ TableName: getTableName(), Key: key }),
  );
  const tokenExpiresAt = Date.now() + 10 * 60 * 1000;
  const otpToken = createSignedOtpToken({
    secret: secret.INTERNAL_SIGNING_KEY,
    subject: user.sub,
    purpose,
    expiresAt: tokenExpiresAt,
  });
  return success({
    verified: true,
    purpose,
    otpToken,
    expiresAt: new Date(tokenExpiresAt).toISOString(),
  });
}

const routeHandlers = Object.freeze({
  'GET /api/hoadon': listInvoices,
  'POST /api/hoadon': createInvoice,
  'GET /api/hoadon/{invoiceId}': readInvoice,
  'PUT /api/hoadon/{invoiceId}': updateInvoice,
  'POST /api/hoadon/chitiet': addInvoiceDetail,
  'GET /api/hoadon/giohang/{patientId}': listCart,
  'POST /api/hoadon/giohang': addCartItem,
  'POST /api/hoadon/giohang/confirm': confirmCart,
  'DELETE /api/hoadon/giohang/item/{itemId}': deleteCartItem,
  'GET /api/hoadon/myhoadon/{patientId}': patientInvoices,
  'GET /api/hoadon/thanhtoan/{invoiceId}': listInvoicePayments,
  'POST /api/hoadon/thanhtoan': manualPayment,
  'GET /api/hoadon/thongke': invoiceStatistics,
  'POST /api/payment/create-url': createPaymentUrl,
  'POST /api/payment/demo/confirm': manualPayment,
  'GET /api/payment/vnpay-return': vnpayReturn,
  'GET /api/payment/vnpay-ipn': vnpayIpn,
  'GET /api/payment/momo-callback': momoCallback,
  'POST /api/payment/momo-callback': momoCallback,
  'POST /api/payment/momo-ipn': momoIpn,
  'POST /api/otp/send': sendOtp,
  'POST /api/otp/resend': sendOtp,
  'POST /api/otp/verify': verifyOtp,
});

async function handler(event) {
  const routeKey = getRouteKey(event);
  const context = { requestId: requestId(event), routeKey };
  try {
    requireEnvironment();
    const routeHandler = routeHandlers[routeKey];
    if (!routeHandler) {
      throw new ApiError(404, 'ROUTE_NOT_FOUND', `Route ${routeKey} not found`);
    }
    return await routeHandler(event);
  } catch (error) {
    return handleError(error, context);
  }
}

module.exports = {
  addCartItem,
  confirmCart,
  createInvoice,
  createPaymentUrl,
  handler,
  manualPayment,
  processMomo,
  processVnpay,
  recordPayment,
  routeHandlers,
  sendOtp,
  verifyOtp,
};
