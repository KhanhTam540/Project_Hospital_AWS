'use strict';

const fs = require('fs');
const path = require('path');
const {
  projectRoot,
  readOutputs,
  requireOutput,
} = require('./medical-script-utils');

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=',
  'base64',
);

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
      ...(body ? { 'Content-Type': 'application/json' } : {}),
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

function expectStatus(result, expected, label) {
  if (result.response.status !== expected) {
    throw new Error(
      `${label}: expected HTTP ${expected}, received ${result.response.status}: ${JSON.stringify(result.payload)}`,
    );
  }
  console.log(`PASS ${label} -> HTTP ${expected}`);
}

async function waitForAudit(baseUrl, token, recordId) {
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const result = await request(
      baseUrl,
      'GET',
      `/api/medical-records/${recordId}/audit`,
      token,
    );
    if (
      result.response.status === 200 &&
      Array.isArray(result.payload?.data) &&
      result.payload.data.length > 0
    ) {
      console.log(`PASS Medical audit stream produced ${result.payload.data.length} event(s)`);
      return result.payload.data;
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error('Medical audit events were not created within 60 seconds');
}

async function main() {
  const outputs = await readOutputs();
  const baseUrl = requireOutput(outputs, 'ApiEndpoint').replace(/\/$/, '');
  const tokens = readTokens();
  const suffix = Date.now().toString(36).toUpperCase();

  const health = await request(baseUrl, 'GET', '/api/health');
  expectStatus(health, 200, 'Health check');

  const patientCreate = await request(
    baseUrl,
    'POST',
    '/api/patients',
    tokens.staff.accessToken,
    {
      fullName: `Dinh Bao API Test ${suffix}`,
      dateOfBirth: '1999-01-01',
      gender: 'NAM',
      phoneNumber: '0909999999',
      address: 'P2TB integration test',
      healthInsuranceNumber: `TEST-${suffix}`,
    },
  );
  expectStatus(patientCreate, 201, 'Create patient as NHANSU');
  const patientId = patientCreate.payload.data.patientId;

  const record = await request(
    baseUrl,
    'POST',
    `/api/patients/${patientId}/records`,
    tokens.doctor.accessToken,
    {
      symptoms: 'Đau họng nhẹ',
      diagnosis: 'Dữ liệu kiểm thử tích hợp',
      treatment: 'Theo dõi',
      note: 'Không phải dữ liệu bệnh nhân thật',
    },
  );
  expectStatus(record, 201, 'Create medical record as BACSI');
  const recordId = record.payload.data.recordId;

  const examination = await request(
    baseUrl,
    'POST',
    `/api/patients/${patientId}/examinations`,
    tokens.doctor.accessToken,
    {
      recordId,
      vitals: {
        temperature: 36.9,
        heartRate: 78,
        systolicBloodPressure: 115,
        diastolicBloodPressure: 75,
        oxygenSaturation: 99,
        weightKg: 60,
        heightCm: 168,
      },
      symptoms: 'Kiểm thử phiếu khám có liên kết hồ sơ',
      diagnosis: 'Chẩn đoán kiểm thử',
      treatment: 'Theo dõi',
    },
  );
  expectStatus(examination, 201, 'Create linked examination as BACSI');

  const prescription = await request(
    baseUrl,
    'POST',
    `/api/patients/${patientId}/prescriptions`,
    tokens.doctor.accessToken,
    {
      recordId,
      medicineItems: [
        {
          medicineId: 'TH-TEST-001',
          medicineName: 'Thuốc kiểm thử',
          quantity: 5,
          dosage: '1 viên',
          frequency: '1 lần/ngày',
          durationDays: 5,
          instructions: 'Dữ liệu kiểm thử',
        },
      ],
      generalInstructions: 'Không sử dụng trong thực tế',
    },
  );
  expectStatus(prescription, 201, 'Create linked prescription as BACSI');

  const labTypeId = `LXN${suffix}`.slice(0, 24);
  const labTestId = `XN${suffix}`.slice(0, 24);
  const labType = await request(
    baseUrl,
    'POST',
    '/api/loaixetnghiem',
    tokens.admin.accessToken,
    {
      maLoaiXN: labTypeId,
      tenLoai: `Loại xét nghiệm ${suffix}`,
      moTa: 'Dữ liệu kiểm thử',
    },
  );
  expectStatus(labType, 201, 'Create laboratory test type');

  const labTest = await request(
    baseUrl,
    'POST',
    '/api/xetnghiem',
    tokens.admin.accessToken,
    {
      maXN: labTestId,
      maLoaiXN: labTypeId,
      tenXN: `Xét nghiệm ${suffix}`,
      chiPhi: 150000,
      donVi: 'Lần',
    },
  );
  expectStatus(labTest, 201, 'Create laboratory test catalog item');

  const labRequest = await request(
    baseUrl,
    'POST',
    '/api/yeucauxetnghiem',
    tokens.doctor.accessToken,
    {
      maBN: patientId,
      maHSBA: recordId,
      maXN: labTestId,
      ghiChu: 'Yêu cầu xét nghiệm kiểm thử',
    },
  );
  expectStatus(labRequest, 201, 'Create laboratory request');
  const labRequestId = labRequest.payload.data.maYeuCau;

  const labResult = await request(
    baseUrl,
    'POST',
    '/api/phieuxetnghiem',
    tokens.staff.accessToken,
    {
      maYeuCau: labRequestId,
      ketQua: 'Âm tính - dữ liệu kiểm thử',
      ghiChu: 'Chờ bác sĩ duyệt',
      trangThai: 'DRAFT',
    },
  );
  expectStatus(labResult, 201, 'Create draft laboratory result as NHANSU');
  const labResultId = labResult.payload.data.maPhieuXN;

  const approvedResult = await request(
    baseUrl,
    'PUT',
    `/api/phieuxetnghiem/${labResultId}`,
    tokens.doctor.accessToken,
    {
      ketQua: 'Âm tính - đã được bác sĩ duyệt',
      trangThai: 'APPROVED',
    },
  );
  expectStatus(approvedResult, 200, 'Approve laboratory result as BACSI');

  const uploadRequest = await request(
    baseUrl,
    'POST',
    '/api/medical/upload-url',
    tokens.doctor.accessToken,
    {
      patientId,
      recordId,
      fileName: 'integration-test.png',
      contentType: 'image/png',
      fileSize: png.length,
    },
  );
  expectStatus(uploadRequest, 201, 'Create linked S3 presigned upload URL');
  const upload = uploadRequest.payload.data;

  const putResponse = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: upload.requiredHeaders,
    body: png,
  });
  if (!putResponse.ok) {
    throw new Error(`S3 upload failed with HTTP ${putResponse.status}`);
  }
  console.log(`PASS Upload PNG directly to S3 -> HTTP ${putResponse.status}`);

  const complete = await request(
    baseUrl,
    'POST',
    '/api/medical/complete-upload',
    tokens.doctor.accessToken,
    { documentId: upload.documentId },
  );
  expectStatus(complete, 200, 'Complete medical upload');

  const aiSummary = await request(
    baseUrl,
    'POST',
    `/api/medical-records/${recordId}/ai-summary`,
    tokens.doctor.accessToken,
    {
      summary:
        'Bản tóm tắt AI đã được bác sĩ kiểm tra và phê duyệt cho hồ sơ kiểm thử.',
      model: 'external-chat-ai',
      sourceRequestId: `AI-${suffix}`,
    },
  );
  expectStatus(aiSummary, 201, 'Approve AI summary for medical record');

  await waitForAudit(baseUrl, tokens.doctor.accessToken, recordId);

  const integrity = await request(
    baseUrl,
    'GET',
    `/api/medical-records/${recordId}/integrity`,
    tokens.doctor.accessToken,
  );
  expectStatus(integrity, 200, 'Verify medical-record integrity');
  if (!['VALID', 'INCOMPLETE'].includes(integrity.payload.data.status)) {
    throw new Error(
      `Unexpected integrity status: ${integrity.payload.data.status}`,
    );
  }

  const forbidden = await request(
    baseUrl,
    'POST',
    `/api/patients/${patientId}/records`,
    tokens.patient.accessToken,
    { diagnosis: 'Should be forbidden' },
  );
  expectStatus(forbidden, 403, 'Reject BENHNHAN creating record');

  console.log('\nDinh Bao Week 1-2 medical integration test completed successfully.');
  console.log(`Test patientId: ${patientId}`);
  console.log(`Test recordId: ${recordId}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
