'use strict';

function normalizeApiRoot(value) {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/, '');
}

function normalizeToken(value) {
  return String(value || '').trim().replace(/^Bearer\s+/i, '');
}

async function request(apiRoot, path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${normalizeToken(token)}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload = text;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    // Keep plain text for diagnostics.
  }

  return { status: response.status, payload };
}

function assertStatus(label, result, expected = 200) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(result.status)) {
    throw new Error(
      `${label}: expected ${allowed.join('/')}, received ${result.status}\n` +
        JSON.stringify(result.payload, null, 2),
    );
  }
  console.log(`✓ ${label}: HTTP ${result.status}`);
}

async function main() {
  const apiRoot = normalizeApiRoot(
    process.env.API_ENDPOINT || process.env.VITE_API_BASE_URL,
  );
  if (!apiRoot) {
    throw new Error(
      'Set API_ENDPOINT, for example https://<api-id>.execute-api.ap-southeast-1.amazonaws.com',
    );
  }

  const adminToken = normalizeToken(process.env.ADMIN_TOKEN);
  const patientToken = normalizeToken(process.env.PATIENT_TOKEN);

  assertStatus('Health', await request(apiRoot, '/api/health'));

  for (const path of [
    '/api/public/khoa',
    '/api/public/bacsi',
    '/api/public/tintuc',
  ]) {
    assertStatus(`Public ${path}`, await request(apiRoot, path));
  }

  if (adminToken) {
    for (const path of [
      '/api/tai-khoan',
      '/api/bacsi',
      '/api/nhansu',
      '/api/loaixetnghiem',
      '/api/xetnghiem',
      '/api/phanhoi',
      '/api/phanhoi/stats',
      '/api/tintuc',
    ]) {
      assertStatus(
        `Admin ${path}`,
        await request(apiRoot, path, { token: adminToken }),
      );
    }
  } else {
    console.log('ADMIN_TOKEN is not set; protected Admin checks were skipped.');
  }

  if (patientToken) {
    assertStatus(
      'Patient cannot list all accounts',
      await request(apiRoot, '/api/tai-khoan', { token: patientToken }),
      403,
    );
  }

  console.log('Requested feature smoke test completed successfully.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
