'use strict';

const crypto = require('crypto');

const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require('@aws-sdk/client-secrets-manager');

const {
  DynamoDBClient,
} = require('@aws-sdk/client-dynamodb');

const {
  DynamoDBDocumentClient,
  PutCommand,
} = require('@aws-sdk/lib-dynamodb');

const secretsClient = new SecretsManagerClient({});
const documentClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({}),
  {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  },
);

const TABLE_NAME = process.env.TABLE_NAME;
const SECRET_ARN = process.env.INTEGRATION_SECRET_ARN;
const AUDIT_RETENTION_DAYS = Number(
  process.env.AI_AUDIT_RETENTION_DAYS || '90',
);

const DEFAULT_ALLOWED_GROUPS = [
  'ADMIN',
  'BACSI',
  'NHANSU',
  'BENHNHAN',
];

const ALLOWED_GROUPS = new Set(
  String(process.env.AI_ALLOWED_GROUPS || DEFAULT_ALLOWED_GROUPS.join(','))
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

const SYSTEM_PROMPT = [
  'Bạn là trợ lý thông tin của hệ thống Hospital_P2TB.',
  'Trả lời bằng tiếng Việt, rõ ràng và dễ hiểu.',
  'Không được khẳng định chẩn đoán bệnh.',
  'Không tự kê đơn thuốc hoặc thay đổi phác đồ điều trị.',
  'Không thay thế bác sĩ hoặc nhân viên y tế.',
  'Khi có dấu hiệu khẩn cấp, hướng dẫn người dùng liên hệ cơ sở y tế.',
  'Không yêu cầu người dùng cung cấp dữ liệu định danh cá nhân.',
  'Chỉ sử dụng ngữ cảnh đã được ẩn danh do hệ thống cung cấp.',
].join(' ');

let cachedConfiguration = null;
let cacheExpiresAt = 0;

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  if (!event.body) {
    return {};
  }

  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;

    return JSON.parse(raw);
  } catch {
    throw new Error('INVALID_JSON');
  }
}

function getClaims(event) {
  return event.requestContext?.authorizer?.jwt?.claims || {};
}

function parseGroups(claims) {
  const value = claims['cognito:groups'] || claims.groups || '';

  if (Array.isArray(value)) {
    return value;
  }

  return String(value)
    .replace(/[\[\]"]/g, '')
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function canUseAi(groups) {
  return groups.some((group) => ALLOWED_GROUPS.has(group));
}

function sha256(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || ''))
    .digest('hex');
}

function redactSensitiveData(value) {
  return String(value || '')
    .replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      '[EMAIL_DA_AN]',
    )
    .replace(
      /(?:\+?84|0)(?:\d[\s.-]?){8,10}\d/g,
      '[SO_DIEN_THOAI_DA_AN]',
    )
    .replace(/\b\d{9,12}\b/g, '[MA_DINH_DANH_DA_AN]')
    .replace(
      /\b(?:CCCD|CMND|BHYT)\s*[:=-]?\s*[A-Z0-9-]+\b/gi,
      '[MA_DINH_DANH_DA_AN]',
    )
    .trim();
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : fallback;
}

function parseExtraHeaders(value) {
  if (!value) {
    return {};
  }

  try {
    const headers = JSON.parse(value);

    if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
      throw new Error('AI_EXTRA_HEADERS_JSON must be an object');
    }

    return Object.fromEntries(
      Object.entries(headers).map(([key, headerValue]) => [
        String(key),
        String(headerValue),
      ]),
    );
  } catch (error) {
    throw new Error(`INVALID_AI_EXTRA_HEADERS_JSON: ${error.message}`);
  }
}

async function loadConfiguration() {
  if (cachedConfiguration && Date.now() < cacheExpiresAt) {
    return cachedConfiguration;
  }

  if (!SECRET_ARN) {
    throw new Error('INTEGRATION_SECRET_ARN_NOT_CONFIGURED');
  }

  const result = await secretsClient.send(
    new GetSecretValueCommand({
      SecretId: SECRET_ARN,
    }),
  );

  if (!result.SecretString) {
    throw new Error('INTEGRATION_SECRET_EMPTY');
  }

  const secret = JSON.parse(result.SecretString);

  const configuration = {
    provider: String(secret.AI_PROVIDER || 'openai-compatible').trim(),
    baseUrl: normalizeBaseUrl(secret.AI_BASE_URL),
    apiStyle: String(secret.AI_API_STYLE || 'chat-completions')
      .trim()
      .toLowerCase(),
    apiKey: String(secret.AI_API_KEY || '').trim(),
    model: String(secret.AI_MODEL || '').trim(),
    timeoutMs: parsePositiveInteger(secret.AI_TIMEOUT_MS, 20000),
    maxOutputTokens: parsePositiveInteger(
      secret.AI_MAX_OUTPUT_TOKENS,
      600,
    ),
    authHeader: String(secret.AI_AUTH_HEADER || 'Authorization').trim(),
    authScheme: String(secret.AI_AUTH_SCHEME || 'Bearer').trim(),
    extraHeaders: parseExtraHeaders(secret.AI_EXTRA_HEADERS_JSON),
  };

  const placeholders = new Set([
    '',
    'SET_IN_AWS_CONSOLE',
    'CHANGE_ME',
  ]);

  if (
    placeholders.has(configuration.baseUrl) ||
    placeholders.has(configuration.apiKey) ||
    placeholders.has(configuration.model)
  ) {
    throw new Error('EXTERNAL_AI_CONFIGURATION_INCOMPLETE');
  }

  if (!['responses', 'chat-completions'].includes(configuration.apiStyle)) {
    throw new Error('AI_API_STYLE_NOT_SUPPORTED');
  }

  cachedConfiguration = configuration;
  cacheExpiresAt = Date.now() + 5 * 60 * 1000;

  return configuration;
}

function extractResponsesText(payload) {
  if (typeof payload?.output_text === 'string') {
    return payload.output_text.trim();
  }

  const parts = [];

  for (const outputItem of payload?.output || []) {
    for (const contentItem of outputItem?.content || []) {
      if (typeof contentItem?.text === 'string') {
        parts.push(contentItem.text);
      }
    }
  }

  return parts.join('\n').trim();
}

function extractChatCompletionText(payload) {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item?.text || '')
      .join('')
      .trim();
  }

  return '';
}

async function callExternalAi(configuration, message, context) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    configuration.timeoutMs,
  );

  const input = context
    ? [
        'Ngữ cảnh đã được ẩn danh:',
        context,
        '',
        'Câu hỏi:',
        message,
      ].join('\n')
    : message;

  let endpoint;
  let body;

  if (configuration.apiStyle === 'responses') {
    endpoint = `${configuration.baseUrl}/responses`;
    body = {
      model: configuration.model,
      instructions: SYSTEM_PROMPT,
      input,
      max_output_tokens: configuration.maxOutputTokens,
    };
  } else {
    endpoint = `${configuration.baseUrl}/chat/completions`;
    body = {
      model: configuration.model,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: input,
        },
      ],
      max_tokens: configuration.maxOutputTokens,
    };
  }

  const authValue = configuration.authScheme
    ? `${configuration.authScheme} ${configuration.apiKey}`
    : configuration.apiKey;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [configuration.authHeader]: authValue,
        ...configuration.extraHeaders,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const rawText = await response.text();
    let payload = {};

    try {
      payload = rawText ? JSON.parse(rawText) : {};
    } catch {
      payload = { raw: rawText.slice(0, 500) };
    }

    if (!response.ok) {
      const error = new Error('EXTERNAL_AI_REQUEST_FAILED');
      error.providerStatusCode = response.status;
      error.providerRequestId = response.headers.get('x-request-id');
      throw error;
    }

    const answer = configuration.apiStyle === 'responses'
      ? extractResponsesText(payload)
      : extractChatCompletionText(payload);

    if (!answer) {
      throw new Error('EXTERNAL_AI_EMPTY_RESPONSE');
    }

    return {
      answer,
      providerRequestId:
        response.headers.get('x-request-id') || payload.id || null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function writeAuditRecord(record) {
  if (!TABLE_NAME) {
    return;
  }

  const createdAt = new Date();
  const expiresAt =
    Math.floor(createdAt.getTime() / 1000) +
    AUDIT_RETENTION_DAYS * 24 * 60 * 60;

  await documentClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `AI_AUDIT#${createdAt.toISOString().slice(0, 7)}`,
        sk: `${createdAt.toISOString()}#${record.requestId}`,
        entityType: 'AI_AUDIT',
        ...record,
        createdAt: createdAt.toISOString(),
        expiresAt,
      },
    }),
  );
}

exports.handler = async (event) => {
  const startedAt = Date.now();
  const requestId =
    event.requestContext?.requestId || crypto.randomUUID();
  const claims = getClaims(event);
  const groups = parseGroups(claims);
  const userId = claims.sub || claims.username || 'unknown';

  let configuration;
  let promptHash = null;

  try {
    if (!canUseAi(groups)) {
      return json(403, {
        message: 'Bạn không có quyền sử dụng trợ lý AI.',
        requestId,
      });
    }

    const body = parseBody(event);
    const message = redactSensitiveData(
      body.message || body.prompt || body.question,
    );
    const context = redactSensitiveData(body.context || '');

    if (!message) {
      return json(400, {
        message: 'Nội dung câu hỏi không được để trống.',
        requestId,
      });
    }

    if (message.length > 4000 || context.length > 6000) {
      return json(400, {
        message: 'Nội dung gửi đến trợ lý AI vượt quá giới hạn.',
        requestId,
      });
    }

    promptHash = sha256(`${context}\n${message}`);
    configuration = await loadConfiguration();

    const aiResult = await callExternalAi(
      configuration,
      message,
      context,
    );

    const latencyMs = Date.now() - startedAt;

    await writeAuditRecord({
      requestId,
      userHash: sha256(userId),
      groups,
      provider: configuration.provider,
      model: configuration.model,
      promptHash,
      resultStatus: 'SUCCESS',
      latencyMs,
      providerRequestId: aiResult.providerRequestId,
    });

    console.log(
      JSON.stringify({
        level: 'INFO',
        event: 'EXTERNAL_AI_REQUEST_COMPLETE',
        requestId,
        provider: configuration.provider,
        model: configuration.model,
        latencyMs,
      }),
    );

    return json(200, {
      requestId,
      answer: aiResult.answer,
      provider: configuration.provider,
      model: configuration.model,
      disclaimer:
        'Nội dung do AI tạo chỉ mang tính tham khảo, không thay thế chẩn đoán hoặc chỉ định của bác sĩ.',
    });
  } catch (error) {
    const latencyMs = Date.now() - startedAt;

    console.error(
      JSON.stringify({
        level: 'ERROR',
        event: 'EXTERNAL_AI_REQUEST_FAILED',
        requestId,
        errorName: error.name,
        errorMessage: error.message,
        providerStatusCode: error.providerStatusCode,
        latencyMs,
      }),
    );

    try {
      await writeAuditRecord({
        requestId,
        userHash: sha256(userId),
        groups,
        provider: configuration?.provider || 'unknown',
        model: configuration?.model || 'unknown',
        promptHash,
        resultStatus: 'FAILED',
        latencyMs,
        providerRequestId: error.providerRequestId || null,
      });
    } catch (auditError) {
      console.error(
        JSON.stringify({
          level: 'ERROR',
          event: 'AI_AUDIT_WRITE_FAILED',
          requestId,
          errorMessage: auditError.message,
        }),
      );
    }

    if (error.message === 'INVALID_JSON') {
      return json(400, {
        message: 'JSON không hợp lệ.',
        requestId,
      });
    }

    if (error.name === 'AbortError') {
      return json(504, {
        message: 'Dịch vụ AI phản hồi quá thời gian cho phép.',
        requestId,
      });
    }

    if (error.providerStatusCode === 429) {
      return json(429, {
        message: 'Dịch vụ AI đang giới hạn số lượt sử dụng. Vui lòng thử lại sau.',
        requestId,
      });
    }

    return json(502, {
      message: 'Không thể kết nối dịch vụ AI bên ngoài.',
      requestId,
    });
  }
};
