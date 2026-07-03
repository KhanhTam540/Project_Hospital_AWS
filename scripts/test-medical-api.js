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

async function main() {
  const outputs = await readOutputs();
  const baseUrl = requireOutput(outputs, 'ApiEndpoint').replace(/\/$/, '');
  const tokens = readTokens();

  const health = await request(baseUrl, 'GET', '/api/health');
  expectStatus(health, 200, 'Health check');

  const patientCreate = await request(
    baseUrl,
    'POST',
    '/api/patients',
    tokens.staff.accessToken,
    {
      fullName: `API Test ${Date.now()}`,
      dateOfBirth: '1999-01-01',
      gender: 'NAM',
      phoneNumber: '0909999999',
      address: 'P2TB integration test',
      healthInsuranceNumber: `TEST-${Date.now()}`,
    },
  );
  expectStatus(patientCreate, 201, 'Create patient as NHANSU');
  const patientId = patientCreate.payload.data.patientId;

  const patientRead = await request(
    baseUrl,
    'GET',
    `/api/patients/${patientId}`,
    tokens.doctor.accessToken,
  );
  expectStatus(patientRead, 200, 'Read patient as BACSI');

  const examination = await request(
    baseUrl,
    'POST',
    `/api/patients/${patientId}/examinations`,
    tokens.staff.accessToken,
    {
      vitals: {
        temperature: 36.9,
        heartRate: 78,
        systolicBloodPressure: 115,
        diastolicBloodPressure: 75,
        oxygenSaturation: 99,
        weightKg: 60,
        heightCm: 168,
      },
      symptoms: 'Kiểm thử chỉ số sinh tồn',
    },
  );
  expectStatus(examination, 201, 'Create vitals as NHANSU');

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

  const forbidden = await request(
    baseUrl,
    'POST',
    `/api/patients/${patientId}/records`,
    tokens.patient.accessToken,
    { diagnosis: 'Should be forbidden' },
  );
  expectStatus(forbidden, 403, 'Reject BENHNHAN creating record');

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
  expectStatus(prescription, 201, 'Create prescription as BACSI');

  const uploadRequest = await request(
    baseUrl,
    'POST',
    '/api/medical/upload-url',
    tokens.doctor.accessToken,
    {
      patientId,
      fileName: 'integration-test.png',
      contentType: 'image/png',
      fileSize: png.length,
    },
  );
  expectStatus(uploadRequest, 201, 'Create S3 presigned upload URL');
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

  const download = await request(
    baseUrl,
    'GET',
    `/api/medical/download-url?documentId=${encodeURIComponent(upload.documentId)}`,
    tokens.doctor.accessToken,
  );
  expectStatus(download, 200, 'Create S3 presigned download URL');

  const downloaded = await fetch(download.payload.data.downloadUrl);
  if (!downloaded.ok) {
    throw new Error(`S3 download failed with HTTP ${downloaded.status}`);
  }
  const downloadedBytes = Buffer.from(await downloaded.arrayBuffer());
  if (!downloadedBytes.equals(png)) {
    throw new Error('Downloaded file does not match uploaded file');
  }
  console.log('PASS Downloaded medical file matches uploaded bytes');

  for (const route of ['records', 'examinations', 'prescriptions', 'documents']) {
    const list = await request(
      baseUrl,
      'GET',
      `/api/patients/${patientId}/${route}`,
      tokens.doctor.accessToken,
    );
    expectStatus(list, 200, `List patient ${route}`);
  }

  console.log('\nMedical Week 1 API integration test completed successfully.');
  console.log(`Test patientId: ${patientId}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
