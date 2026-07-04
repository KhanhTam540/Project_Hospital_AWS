'use strict';

const {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const {
  GetSecretValueCommand,
  SecretsManagerClient,
} = require('@aws-sdk/client-secrets-manager');

const { requireGroups } = require('../shared/auth');
const {
  ApiError,
  getRouteKey,
  handleError,
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
  auditPartitionKey,
  createAuditEvent,
  encodeAnchorPayload,
  hashResource,
  isMedicalRecordEntity,
} = require('./domain');

const secretsClient = new SecretsManagerClient({});
let cachedSecret;

function requireEnvironment() {
  getTableName();
  if (!process.env.INTEGRATION_SECRET_ARN) {
    throw new Error('Missing INTEGRATION_SECRET_ARN environment variable');
  }
}

async function getIntegrationSecret() {
  if (cachedSecret) return cachedSecret;
  const response = await secretsClient.send(
    new GetSecretValueCommand({
      SecretId: process.env.INTEGRATION_SECRET_ARN,
    }),
  );
  const text =
    response.SecretString ||
    Buffer.from(response.SecretBinary || '', 'base64').toString('utf8');
  cachedSecret = JSON.parse(text || '{}');
  return cachedSecret;
}

function streamImage(image) {
  return image ? unmarshall(image) : undefined;
}

function auditRecordKey(auditEvent) {
  return {
    pk: auditPartitionKey(auditEvent.medicalRecordId),
    sk: `${auditEvent.occurredAt}#${auditEvent.eventId}`,
  };
}

async function getSavedAuditRecord(auditEvent) {
  const response = await getDocumentClient().send(
    new GetCommand({
      TableName: getTableName(),
      Key: auditRecordKey(auditEvent),
      ConsistentRead: true,
    }),
  );
  return response.Item || null;
}

async function saveAuditRecord(auditEvent, attributes = {}) {
  const tableName = getTableName();
  const client = getDocumentClient();
  const item = {
    ...auditRecordKey(auditEvent),
    gsi1pk: `AUDIT_EVENT#${auditEvent.eventId}`,
    gsi1sk: 'METADATA',
    entityType: 'MEDICAL_AUDIT',
    ...auditEvent,
    ...attributes,
    updatedAt: nowIso(),
  };

  await client.send(
    new PutCommand({
      TableName: tableName,
      Item: item,
    }),
  );
  return item;
}

async function anchorToBlockchain(auditEvent, secret) {
  const mode = String(
    secret.BLOCKCHAIN_MODE || process.env.BLOCKCHAIN_MODE || 'DYNAMODB_HASH_ONLY',
  )
    .trim()
    .toUpperCase();

  if (mode !== 'AMB_ETHEREUM') {
    return {
      blockchainMode: mode,
      blockchainStatus: 'HASH_ONLY',
      blockchainMessage:
        'Hash is stored in DynamoDB. Set BLOCKCHAIN_MODE=AMB_ETHEREUM to submit a real transaction.',
    };
  }

  const rpcUrl = String(secret.AMB_ETHEREUM_RPC_URL || '').trim();
  const privateKey = String(secret.AMB_ETHEREUM_PRIVATE_KEY || '').trim();
  const chainId = Number(secret.AMB_ETHEREUM_CHAIN_ID || 0);

  if (!rpcUrl || !privateKey || !chainId) {
    throw new Error(
      'AMB Ethereum configuration is incomplete: AMB_ETHEREUM_RPC_URL, AMB_ETHEREUM_PRIVATE_KEY and AMB_ETHEREUM_CHAIN_ID are required',
    );
  }

  const { AbiCoder, JsonRpcProvider, Wallet } = require('ethers');
  const provider = new JsonRpcProvider(rpcUrl, chainId, {
    staticNetwork: true,
  });
  const wallet = new Wallet(privateKey, provider);
  const anchor = encodeAnchorPayload(auditEvent);
  const data = AbiCoder.defaultAbiCoder().encode(
    ['bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32', 'uint64'],
    [
      anchor.eventIdHash,
      anchor.medicalRecordIdHash,
      anchor.resourceIdHash,
      anchor.payloadHash,
      anchor.metadataHash,
      BigInt(auditEvent.resourceVersion || 1),
    ],
  );

  const transaction = await wallet.sendTransaction({
    to: wallet.address,
    value: 0,
    data,
  });
  const receipt = await transaction.wait(1);

  return {
    blockchainMode: 'AMB_ETHEREUM',
    blockchainStatus: receipt?.status === 1 ? 'CONFIRMED' : 'FAILED',
    blockchainTransactionId: transaction.hash,
    blockchainBlockNumber: receipt?.blockNumber || null,
    blockchainAnchoredAt: nowIso(),
  };
}

async function processStreamRecord(record) {
  const eventName = record.eventName;
  const newItem = streamImage(record.dynamodb?.NewImage);
  const oldItem = streamImage(record.dynamodb?.OldImage);
  const source = eventName === 'REMOVE' ? oldItem : newItem;

  if (!source || !isMedicalRecordEntity(source)) {
    return { skipped: true };
  }

  const auditEvent = createAuditEvent({
    eventName,
    item: newItem,
    oldItem,
    occurredAt:
      record.dynamodb?.ApproximateCreationDateTime
        ? new Date(
            Number(record.dynamodb.ApproximateCreationDateTime) * 1000,
          ).toISOString()
        : nowIso(),
  });

  // Some old entities may not be linked to a medical record yet.
  if (!auditEvent) {
    return { skipped: true, reason: 'MEDICAL_RECORD_ID_MISSING' };
  }

  const saved = await getSavedAuditRecord(auditEvent);
  if (saved?.blockchainStatus === 'CONFIRMED') {
    return {
      skipped: true,
      reason: 'ALREADY_CONFIRMED',
      eventId: auditEvent.eventId,
      blockchainTransactionId: saved.blockchainTransactionId || null,
    };
  }

  await saveAuditRecord(auditEvent, {
    blockchainStatus: 'PENDING',
    retryCount: Number(saved?.retryCount || 0),
  });

  try {
    const secret = await getIntegrationSecret();
    const blockchain = await anchorToBlockchain(auditEvent, secret);
    await saveAuditRecord(auditEvent, blockchain);
    return {
      skipped: false,
      eventId: auditEvent.eventId,
      ...blockchain,
    };
  } catch (error) {
    await saveAuditRecord(auditEvent, {
      blockchainStatus: 'FAILED',
      blockchainError: String(error.message || error).slice(0, 500),
      retryCount: Number(saved?.retryCount || 0) + 1,
    });
    throw error;
  }
}

async function handleStream(event) {
  const failures = [];
  for (const record of event.Records || []) {
    try {
      await processStreamRecord(record);
    } catch (error) {
      console.error('Medical audit stream record failed', {
        eventID: record.eventID,
        message: error.message,
      });
      failures.push({ itemIdentifier: record.eventID });
    }
  }
  return { batchItemFailures: failures };
}

async function listAuditEvents(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const recordId = normalizeId(routeParameter(event, 'recordId'), 'recordId');
  const response = await getDocumentClient().send(
    new QueryCommand({
      TableName: getTableName(),
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': auditPartitionKey(recordId),
      },
      ScanIndexForward: false,
      Limit: 200,
    }),
  );
  return success(response.Items || []);
}

async function verifyIntegrity(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU']);
  const recordId = normalizeId(routeParameter(event, 'recordId'), 'recordId');
  const response = await getDocumentClient().send(
    new QueryCommand({
      TableName: getTableName(),
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': auditPartitionKey(recordId),
      },
      ScanIndexForward: false,
      Limit: 500,
    }),
  );

  const latestByResource = new Map();
  for (const item of response.Items || []) {
    const key = `${item.sourcePk}|${item.sourceSk}`;
    if (!latestByResource.has(key)) latestByResource.set(key, item);
  }

  const components = [];
  for (const audit of latestByResource.values()) {
    const current = await getDocumentClient().send(
      new GetCommand({
        TableName: getTableName(),
        Key: { pk: audit.sourcePk, sk: audit.sourceSk },
      }),
    );

    if (!current.Item) {
      components.push({
        eventId: audit.eventId,
        resourceType: audit.resourceType,
        resourceId: audit.resourceId,
        status: audit.action.endsWith('_DELETED') ? 'DELETED_VALID' : 'MISSING',
        storedHash: audit.payloadHash,
      });
      continue;
    }

    const calculatedHash = hashResource(current.Item);
    components.push({
      eventId: audit.eventId,
      resourceType: audit.resourceType,
      resourceId: audit.resourceId,
      status: calculatedHash === audit.payloadHash ? 'VALID' : 'TAMPERED',
      storedHash: audit.payloadHash,
      calculatedHash,
      blockchainStatus: audit.blockchainStatus,
      blockchainTransactionId: audit.blockchainTransactionId || null,
    });
  }

  const status = components.some((item) => item.status === 'TAMPERED')
    ? 'TAMPERED'
    : components.some((item) => item.status === 'MISSING')
      ? 'INCOMPLETE'
      : components.length
        ? 'VALID'
        : 'NO_AUDIT_DATA';

  return success({ medicalRecordId: recordId, status, components });
}

async function findMedicalRecord(recordId) {
  const normalizedId = normalizeId(recordId, 'recordId');
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

async function approveAiSummary(event) {
  const user = requireGroups(event, ['BACSI']);
  const recordId = normalizeId(routeParameter(event, 'recordId'), 'recordId');
  const body = parseJsonBody(event);
  const summary = String(body.summary || body.noiDung || '').trim();
  if (summary.length < 10 || summary.length > 12000) {
    throw new ApiError(
      400,
      'INVALID_AI_SUMMARY',
      'Approved AI summary must contain 10 to 12000 characters',
    );
  }

  const record = await findMedicalRecord(recordId);
  if (!record) {
    throw new ApiError(404, 'MEDICAL_RECORD_NOT_FOUND', 'Medical record not found');
  }

  const summaryId = normalizeId(
    body.summaryId || `AIS${Date.now().toString(36).toUpperCase()}`,
    'summaryId',
  );
  const timestamp = nowIso();
  const item = {
    ...directKey('AI_MEDICAL_SUMMARY', summaryId),
    entityType: 'AI_MEDICAL_SUMMARY',
    summaryId,
    medicalRecordId: recordId,
    patientId: record.patientId,
    summary,
    sourceRequestId: body.sourceRequestId || body.aiRequestId || null,
    model: body.model || null,
    status: 'APPROVED',
    approvedBy: user.sub,
    approvedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };
  await getDocumentClient().send(
    new PutCommand({
      TableName: getTableName(),
      Item: item,
      ConditionExpression: 'attribute_not_exists(pk)',
    }),
  );
  return success(item, 201);
}

const routeHandlers = Object.freeze({
  'GET /api/medical-records/{recordId}/audit': listAuditEvents,
  'GET /api/medical-records/{recordId}/integrity': verifyIntegrity,
  'POST /api/medical-records/{recordId}/verify': verifyIntegrity,
  'POST /api/medical-records/{recordId}/ai-summary': approveAiSummary,
});

async function handler(event) {
  if (Array.isArray(event?.Records) && event.Records[0]?.eventSource === 'aws:dynamodb') {
    requireEnvironment();
    return handleStream(event);
  }

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
  anchorToBlockchain,
  approveAiSummary,
  auditRecordKey,
  getSavedAuditRecord,
  handler,
  handleStream,
  listAuditEvents,
  processStreamRecord,
  routeHandlers,
  verifyIntegrity,
};
