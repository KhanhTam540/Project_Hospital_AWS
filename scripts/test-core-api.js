'use strict';

const { randomUUID } = require('node:crypto');

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing ${name} environment variable`);
  return value;
}

function normalizeApiRoot(value) {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/, '');
}

function normalizeToken(value) {
  return String(value || '').trim().replace(/^Bearer\s+/i, '');
}

async function callApi(apiRoot, path, options = {}) {
  const token = normalizeToken(options.token);
  const response = await fetch(`${apiRoot}${path}`, {
    method: options.method || 'GET',
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { status: response.status, body };
}

function assertStatus(label, result, expected) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(result.status)) {
    throw new Error(
      `${label}: expected ${allowed.join('/')}, received ${result.status}\n` +
        JSON.stringify(result.body, null, 2),
    );
  }
  console.log(`✓ ${label}: HTTP ${result.status}`);
}

async function main() {
  const apiRoot = normalizeApiRoot(
    process.env.API_ENDPOINT || process.env.VITE_API_BASE_URL,
  );
  if (!apiRoot) {
    throw new Error('Set API_ENDPOINT to the CloudFormation ApiEndpoint output');
  }

  const adminToken = normalizeToken(process.env.ADMIN_TOKEN);
  const patientToken = normalizeToken(process.env.PATIENT_TOKEN);
  const mutationTest = process.env.CORE_API_MUTATION_TEST === 'true';

  const health = await callApi(apiRoot, '/api/health');
  assertStatus('Public health', health, 200);

  if (!adminToken) {
    console.log('ADMIN_TOKEN is not set; protected API tests were skipped');
    return;
  }

  assertStatus(
    'Admin /api/me',
    await callApi(apiRoot, '/api/me', { token: adminToken }),
    200,
  );
  assertStatus(
    'Admin ping',
    await callApi(apiRoot, '/api/admin/ping', { token: adminToken }),
    200,
  );

  for (const path of [
    '/api/tai-khoan',
    '/api/khoa',
    '/api/phongkham',
    '/api/phongkhamngoai',
    '/api/bacsi',
    '/api/nhansu',
    '/api/catruc',
    '/api/lichlamviec',
    '/api/lichkham',
  ]) {
    assertStatus(
      `GET ${path}`,
      await callApi(apiRoot, path, { token: adminToken }),
      200,
    );
  }

  if (patientToken) {
    assertStatus(
      'Patient is forbidden from admin ping',
      await callApi(apiRoot, '/api/admin/ping', { token: patientToken }),
      403,
    );
  }

  if (mutationTest) {
    const suffix = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const departmentId = `KHOA_TEST_${suffix}`;

    const created = await callApi(apiRoot, '/api/khoa', {
      method: 'POST',
      token: adminToken,
      body: {
        maKhoa: departmentId,
        tenKhoa: `Khoa kiểm thử ${suffix}`,
        moTa: 'Được tạo bởi scripts/test-core-api.js',
      },
    });
    assertStatus('Create temporary department', created, 201);

    assertStatus(
      'Update temporary department',
      await callApi(apiRoot, `/api/khoa/${departmentId}`, {
        method: 'PUT',
        token: adminToken,
        body: {
          tenKhoa: `Khoa kiểm thử đã cập nhật ${suffix}`,
          moTa: 'Integration test',
        },
      }),
      200,
    );

    assertStatus(
      'Delete temporary department',
      await callApi(apiRoot, `/api/khoa/${departmentId}`, {
        method: 'DELETE',
        token: adminToken,
      }),
      200,
    );
  }

  console.log('Core API smoke test completed successfully');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
