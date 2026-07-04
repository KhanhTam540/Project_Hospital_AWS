'use strict';

const fs = require('fs');
const path = require('path');
const {
  projectRoot,
  readOutputs,
  requireOutput,
} = require('./medical-script-utils');

function readTokens() {
  const file = path.join(projectRoot, '.medical-test-tokens.json');
  if (!fs.existsSync(file)) {
    throw new Error('Run npm run tokens:medical first');
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function request(baseUrl, method, pathName, token, body) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { response, payload };
}

function expect(result, statuses, label) {
  const accepted = Array.isArray(statuses) ? statuses : [statuses];
  if (!accepted.includes(result.response.status)) {
    throw new Error(
      `${label}: expected ${accepted.join('/')}, got ${result.response.status}: ${JSON.stringify(result.payload)}`,
    );
  }
  console.log(`PASS ${label} -> HTTP ${result.response.status}`);
}

async function main() {
  const outputs = await readOutputs();
  const baseUrl = requireOutput(outputs, 'ApiEndpoint').replace(/\/$/, '');
  const tokens = readTokens();
  const suffix = Date.now().toString(36).toUpperCase();

  const patient = await request(
    baseUrl,
    'POST',
    '/api/patients',
    tokens.staff.accessToken,
    {
      fullName: `Payment Test ${suffix}`,
      dateOfBirth: '2000-01-01',
      gender: 'NAM',
      phoneNumber: '0908888888',
      address: 'P2TB payment integration test',
    },
  );
  expect(patient, 201, 'Create payment test patient');
  const patientId = patient.payload.data.patientId;

  const record = await request(
    baseUrl,
    'POST',
    `/api/patients/${patientId}/records`,
    tokens.doctor.accessToken,
    {
      diagnosis: 'Payment integration test',
      treatment: 'Test only',
    },
  );
  expect(record, 201, 'Create payment test medical record');
  const recordId = record.payload.data.recordId;

  const cartItem = await request(
    baseUrl,
    'POST',
    '/api/hoadon/giohang',
    tokens.staff.accessToken,
    {
      maBN: patientId,
      maHSBA: recordId,
      maDichVu: 'DV-KHAM',
      tenDichVu: 'Khám bệnh kiểm thử',
      loaiDichVu: 'EXAMINATION',
      donGia: 250000,
      soLuong: 1,
    },
  );
  expect(cartItem, 201, 'Add service to cart');

  const cart = await request(
    baseUrl,
    'GET',
    `/api/hoadon/giohang/${patientId}`,
    tokens.staff.accessToken,
  );
  expect(cart, 200, 'List patient cart');

  const invoiceResult = await request(
    baseUrl,
    'POST',
    '/api/hoadon/giohang/confirm',
    tokens.staff.accessToken,
    {
      maBN: patientId,
      maHSBA: recordId,
      noiDung: 'Hóa đơn kiểm thử tích hợp',
    },
  );
  expect(invoiceResult, 201, 'Confirm cart and create invoice');
  const invoiceId = invoiceResult.payload.data.maHD;

  const transactionId = `CASH-${suffix}`;
  const paymentBody = {
    maHD: invoiceId,
    phuongThuc: 'CASH',
    soTien: 250000,
    transactionId,
  };
  const payment = await request(
    baseUrl,
    'POST',
    '/api/hoadon/thanhtoan',
    tokens.staff.accessToken,
    paymentBody,
  );
  expect(payment, 201, 'Confirm cash payment');

  const duplicate = await request(
    baseUrl,
    'POST',
    '/api/hoadon/thanhtoan',
    tokens.staff.accessToken,
    paymentBody,
  );
  expect(duplicate, 201, 'Reject duplicate effect through idempotent result');
  if (duplicate.payload?.data?.duplicate !== true) {
    throw new Error('Second payment callback was not marked as duplicate');
  }

  const paymentList = await request(
    baseUrl,
    'GET',
    `/api/hoadon/thanhtoan/${invoiceId}`,
    tokens.staff.accessToken,
  );
  expect(paymentList, 200, 'List invoice payments');

  const invoice = await request(
    baseUrl,
    'GET',
    `/api/hoadon/${invoiceId}`,
    tokens.staff.accessToken,
  );
  expect(invoice, 200, 'Read paid invoice');
  if (invoice.payload.data.trangThai !== 'DA_THANH_TOAN') {
    throw new Error('Invoice was not marked as paid');
  }

  if (process.env.TEST_PHONE_NUMBER) {
    const otp = await request(
      baseUrl,
      'POST',
      '/api/otp/send',
      tokens.staff.accessToken,
      {
        phoneNumber: process.env.TEST_PHONE_NUMBER,
        purpose: `PAYMENT_${invoiceId}`,
      },
    );
    expect(otp, 200, 'Send SNS OTP');
    console.log('Enter the received OTP manually through /api/otp/verify.');
  } else {
    console.log('SKIP SNS OTP live send: set TEST_PHONE_NUMBER=+84... to enable it.');
  }

  if (process.env.TEST_VNPAY === 'true') {
    const onlineInvoice = await request(
      baseUrl,
      'POST',
      '/api/hoadon',
      tokens.staff.accessToken,
      {
        maBN: patientId,
        maHSBA: recordId,
        items: [
          {
            maDichVu: 'DV-XN',
            tenDichVu: 'Xét nghiệm kiểm thử VNPay',
            loaiDichVu: 'LAB',
            donGia: 100000,
            soLuong: 1,
          },
        ],
      },
    );
    expect(onlineInvoice, 201, 'Create VNPay test invoice');
    const onlineUrl = await request(
      baseUrl,
      'POST',
      '/api/payment/create-url',
      tokens.staff.accessToken,
      {
        maHD: onlineInvoice.payload.data.maHD,
        phuongThuc: 'VNPAY',
      },
    );
    expect(onlineUrl, 200, 'Create VNPay sandbox URL');
    console.log(`VNPay sandbox URL: ${onlineUrl.payload.paymentUrl}`);
  } else {
    console.log('SKIP VNPAY live sandbox URL: set TEST_VNPAY=true after configuring Secrets Manager.');
  }

  console.log('\nDinh Bao Week 3 payment integration test completed successfully.');
  console.log(`Test invoiceId: ${invoiceId}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
