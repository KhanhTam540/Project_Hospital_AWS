'use strict';

const {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
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
  buildLedgerBlock,
  canonicalize,
  createAuditEvent,
  encodeAnchorPayload,
  hashResource,
  isMedicalRecordEntity,
  ledgerPartitionKey,
  sha256,
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
  const item = {
    ...auditRecordKey(auditEvent),
    gsi1pk: `AUDIT_EVENT#${auditEvent.eventId}`,
    gsi1sk: 'METADATA',
    entityType: 'MEDICAL_AUDIT',
    ...auditEvent,
    ...attributes,
    updatedAt: nowIso(),
  };

  await getDocumentClient().send(
    new PutCommand({
      TableName: getTableName(),
      Item: item,
    }),
  );
  return item;
}

function secretValue(secret = {}, name, fallback = '') {
  const value = secret[name] ?? process.env[name] ?? fallback;
  return value === undefined || value === null ? '' : String(value).trim();
}

function appendBillingToken(rpcUrl, billingToken) {
  if (!billingToken) return rpcUrl;
  const parsed = new URL(rpcUrl);
  if (!parsed.searchParams.has('billingtoken')) {
    parsed.searchParams.set('billingtoken', billingToken);
  }
  return parsed.toString();
}

function buildExplorerTransactionUrl(baseUrl, txHash) {
  if (!baseUrl || !txHash) return null;
  return `${String(baseUrl).replace(/\/$/, '')}/tx/${txHash}`;
}

function normalizeBlockchainConfig(secret = {}) {
  const mode = secretValue(secret, 'BLOCKCHAIN_MODE', 'DYNAMODB_HASH_ONLY').toUpperCase();
  const billingToken = secretValue(secret, 'AMB_ETHEREUM_BILLING_TOKEN');
  const rpcUrl = appendBillingToken(
    secretValue(secret, 'AMB_ETHEREUM_RPC_URL'),
    billingToken,
  );
  const privateKey = secretValue(secret, 'AMB_ETHEREUM_PRIVATE_KEY');
  const chainId = Number(secretValue(secret, 'AMB_ETHEREUM_CHAIN_ID', '0'));
  const networkName = secretValue(secret, 'AMB_ETHEREUM_NETWORK_NAME', chainId === 1 ? 'Ethereum Mainnet' : 'Ethereum');
  const explorerBaseUrl = secretValue(secret, 'AMB_ETHEREUM_EXPLORER_BASE_URL', chainId === 1 ? 'https://etherscan.io' : '');
  const confirmations = Number(secretValue(secret, 'AMB_ETHEREUM_CONFIRMATIONS', '0'));
  return {
    mode,
    rpcUrl,
    privateKey,
    chainId,
    networkName,
    explorerBaseUrl,
    confirmations: Number.isFinite(confirmations) && confirmations > 0 ? confirmations : 0,
  };
}

async function anchorToBlockchain(auditEvent, secret) {
  const config = normalizeBlockchainConfig(secret);

  if (config.mode !== 'AMB_ETHEREUM') {
    return {
      blockchainMode: config.mode,
      blockchainProvider: 'DynamoDB hash-chain',
      blockchainStatus: 'HASH_ONLY',
      blockchainHumanStatus: 'Đã ghi chuỗi hash nội bộ trong DynamoDB',
      blockchainMessage:
        'Hash-chain block is stored in DynamoDB. Set BLOCKCHAIN_MODE=AMB_ETHEREUM to submit an AMB Ethereum transaction.',
    };
  }

  if (!config.rpcUrl || !config.privateKey || !config.chainId) {
    throw new Error(
      'AMB Ethereum configuration is incomplete: AMB_ETHEREUM_RPC_URL, AMB_ETHEREUM_PRIVATE_KEY and AMB_ETHEREUM_CHAIN_ID are required',
    );
  }

  const { AbiCoder, JsonRpcProvider, Wallet } = require('ethers');
  const provider = new JsonRpcProvider(config.rpcUrl, config.chainId, {
    staticNetwork: true,
  });
  const wallet = new Wallet(config.privateKey, provider);
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
  const receipt = config.confirmations > 0
    ? await transaction.wait(config.confirmations)
    : null;
  const confirmed = receipt?.status === 1;
  const status = receipt
    ? confirmed
      ? 'CONFIRMED'
      : 'FAILED'
    : 'SUBMITTED';
  const transactionUrl = buildExplorerTransactionUrl(
    config.explorerBaseUrl,
    transaction.hash,
  );

  return {
    blockchainMode: 'AMB_ETHEREUM',
    blockchainProvider: 'Amazon Managed Blockchain Access Ethereum',
    blockchainNetwork: config.networkName,
    blockchainChainId: config.chainId,
    blockchainStatus: status,
    blockchainHumanStatus:
      status === 'CONFIRMED'
        ? 'Đã ghi nhận trên Ethereum qua AMB'
        : status === 'SUBMITTED'
          ? 'Đã gửi giao dịch lên Ethereum qua AMB, đang chờ xác nhận'
          : 'Giao dịch AMB Ethereum thất bại',
    blockchainTransactionId: transaction.hash,
    blockchainTransactionUrl: transactionUrl,
    blockchainBlockNumber: receipt?.blockNumber || null,
    blockchainAnchoredAt: nowIso(),
    blockchainFromAddress: wallet.address,
    blockchainToAddress: wallet.address,
    blockchainConfirmationsRequested: config.confirmations,
  };
}


async function getLastLedgerBlock(recordId) {
  const response = await getDocumentClient().send(
    new QueryCommand({
      TableName: getTableName(),
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': ledgerPartitionKey(recordId),
        ':prefix': 'BLOCK#',
      },
      ScanIndexForward: false,
      Limit: 1,
    }),
  );
  return response.Items?.[0] || null;
}

async function getLedgerBlockByEvent(eventId) {
  const response = await getDocumentClient().send(
    new ScanCommand({
      TableName: getTableName(),
      FilterExpression: 'entityType = :type AND eventId = :eventId',
      ExpressionAttributeValues: {
        ':type': 'MEDICAL_LEDGER_BLOCK',
        ':eventId': eventId,
      },
      Limit: 1,
    }),
  );
  return response.Items?.[0] || null;
}

async function saveLedgerBlock(auditEvent) {
  const existing = await getLedgerBlockByEvent(auditEvent.eventId);
  if (existing) return existing;

  const latest = await getLastLedgerBlock(auditEvent.medicalRecordId);
  const block = buildLedgerBlock({
    auditEvent,
    previousHash: latest?.blockHash || 'GENESIS',
    blockNumber: Number(latest?.blockNumber || 0) + 1,
    createdAt: nowIso(),
  });

  try {
    await getDocumentClient().send(
      new PutCommand({
        TableName: getTableName(),
        Item: block,
        ConditionExpression: 'attribute_not_exists(pk)',
      }),
    );
    return block;
  } catch (error) {
    if (error?.name !== 'ConditionalCheckFailedException') throw error;
    const concurrent = await getLedgerBlockByEvent(auditEvent.eventId);
    if (concurrent) return concurrent;
    throw error;
  }
}

async function updateLedgerBlockAnchor(block, blockchain = {}) {
  if (!block?.pk || !block?.sk) return block;

  const names = {
    '#mode': 'blockchainMode',
    '#provider': 'blockchainProvider',
    '#network': 'blockchainNetwork',
    '#chainId': 'blockchainChainId',
    '#status': 'blockchainStatus',
    '#humanStatus': 'blockchainHumanStatus',
    '#message': 'blockchainMessage',
    '#txId': 'blockchainTransactionId',
    '#txUrl': 'blockchainTransactionUrl',
    '#blockNumber': 'blockchainBlockNumber',
    '#anchoredAt': 'blockchainAnchoredAt',
    '#from': 'blockchainFromAddress',
    '#to': 'blockchainToAddress',
    '#confirmations': 'blockchainConfirmationsRequested',
  };
  const values = {
    ':mode': blockchain.blockchainMode || 'DYNAMODB_HASH_ONLY',
    ':provider': blockchain.blockchainProvider || null,
    ':network': blockchain.blockchainNetwork || null,
    ':chainId': blockchain.blockchainChainId || null,
    ':status': blockchain.blockchainStatus || 'HASH_ONLY',
    ':humanStatus': blockchain.blockchainHumanStatus || null,
    ':message': blockchain.blockchainMessage || null,
    ':txId': blockchain.blockchainTransactionId || null,
    ':txUrl': blockchain.blockchainTransactionUrl || null,
    ':blockNumber': blockchain.blockchainBlockNumber || null,
    ':anchoredAt': blockchain.blockchainAnchoredAt || null,
    ':from': blockchain.blockchainFromAddress || null,
    ':to': blockchain.blockchainToAddress || null,
    ':confirmations': blockchain.blockchainConfirmationsRequested ?? null,
  };

  await getDocumentClient().send(
    new UpdateCommand({
      TableName: getTableName(),
      Key: { pk: block.pk, sk: block.sk },
      UpdateExpression: [
        'SET #mode = :mode',
        '#provider = :provider',
        '#network = :network',
        '#chainId = :chainId',
        '#status = :status',
        '#humanStatus = :humanStatus',
        '#message = :message',
        '#txId = :txId',
        '#txUrl = :txUrl',
        '#blockNumber = :blockNumber',
        '#anchoredAt = :anchoredAt',
        '#from = :from',
        '#to = :to',
        '#confirmations = :confirmations',
      ].join(', '),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );

  return { ...block, ...blockchain };
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

  if (!auditEvent) {
    return { skipped: true, reason: 'MEDICAL_RECORD_ID_MISSING' };
  }

  const saved = await getSavedAuditRecord(auditEvent);
  if (saved?.ledgerBlockHash && saved?.blockchainStatus) {
    return {
      skipped: true,
      reason: 'ALREADY_LEDGERED',
      eventId: auditEvent.eventId,
      blockHash: saved.ledgerBlockHash,
    };
  }

  await saveAuditRecord(auditEvent, {
    blockchainStatus: 'PENDING',
    retryCount: Number(saved?.retryCount || 0),
  });

  try {
    const block = await saveLedgerBlock(auditEvent);
    const secret = await getIntegrationSecret();
    const blockchain = await anchorToBlockchain(auditEvent, secret);
    const anchoredBlock = await updateLedgerBlockAnchor(block, blockchain);
    await saveAuditRecord(auditEvent, {
      ...blockchain,
      ledgerBlockId: block.ledgerBlockId,
      ledgerBlockNumber: block.blockNumber,
      ledgerBlockHash: anchoredBlock.blockHash,
      previousHash: block.previousHash,
      auditUpdatedAt: nowIso(),
    });

    console.info('Medical ledger block stored', {
      eventId: auditEvent.eventId,
      medicalRecordId: auditEvent.medicalRecordId,
      resourceType: auditEvent.resourceType,
      resourceId: auditEvent.resourceId,
      blockHash: block.blockHash,
      previousHash: block.previousHash,
      blockchainStatus: blockchain.blockchainStatus,
    });

    return {
      skipped: false,
      eventId: auditEvent.eventId,
      blockHash: block.blockHash,
      previousHash: block.previousHash,
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
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN']);
  const recordId = normalizeId(routeParameter(event, 'recordId'), 'recordId');
  const [auditResponse, ledgerResponse] = await Promise.all([
    getDocumentClient().send(
      new QueryCommand({
        TableName: getTableName(),
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': auditPartitionKey(recordId),
        },
        ScanIndexForward: false,
        Limit: 200,
      }),
    ),
    getDocumentClient().send(
      new QueryCommand({
        TableName: getTableName(),
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: {
          ':pk': ledgerPartitionKey(recordId),
          ':prefix': 'BLOCK#',
        },
        ScanIndexForward: false,
        Limit: 200,
      }),
    ),
  ]);

  return success({
    medicalRecordId: recordId,
    auditEvents: auditResponse.Items || [],
    blocks: ledgerResponse.Items || [],
  });
}

async function verifyIntegrity(event) {
  requireGroups(event, ['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN']);
  const recordId = normalizeId(routeParameter(event, 'recordId'), 'recordId');
  const ledgerResponse = await getDocumentClient().send(
    new QueryCommand({
      TableName: getTableName(),
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': ledgerPartitionKey(recordId),
        ':prefix': 'BLOCK#',
      },
      ScanIndexForward: true,
      Limit: 500,
    }),
  );

  const auditResponse = await getDocumentClient().send(
    new QueryCommand({
      TableName: getTableName(),
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': auditPartitionKey(recordId),
      },
      ScanIndexForward: true,
      Limit: 500,
    }),
  );
  const auditsByEvent = new Map(
    (auditResponse.Items || []).map((audit) => [audit.eventId, audit]),
  );
  const blocks = (ledgerResponse.Items || []).map((block) => ({
    ...(auditsByEvent.get(block.eventId) || {}),
    ...block,
  }));
  const components = [];
  let valid = true;
  let brokenAt = null;
  let previousHash = 'GENESIS';

  for (const block of blocks) {
    const chainOk = block.previousHash === previousHash;
    const expectedBlockHash = sha256(
      canonicalize({
        eventId: block.eventId,
        medicalRecordId: block.medicalRecordId,
        resourceType: block.resourceType,
        resourceId: block.resourceId,
        action: block.action,
        resourceVersion: block.resourceVersion,
        payloadHash: block.payloadHash,
        previousHash: block.previousHash,
        sourcePk: block.sourcePk,
        sourceSk: block.sourceSk,
        occurredAt: block.occurredAt,
      }),
    );
    const blockHashOk = expectedBlockHash === block.blockHash;

    let resourceStatus = 'NOT_CHECKED';
    let calculatedHash = null;
    if (!String(block.action || '').endsWith('_DELETED')) {
      const current = await getDocumentClient().send(
        new GetCommand({
          TableName: getTableName(),
          Key: { pk: block.sourcePk, sk: block.sourceSk },
        }),
      );
      if (!current.Item) {
        resourceStatus = 'MISSING';
      } else {
        calculatedHash = hashResource(current.Item);
        resourceStatus = calculatedHash === block.payloadHash ? 'VALID' : 'TAMPERED';
      }
    } else {
      resourceStatus = 'DELETED_VALID';
    }

    const componentValid = chainOk && blockHashOk && !['MISSING', 'TAMPERED'].includes(resourceStatus);
    if (!componentValid && !brokenAt) {
      brokenAt = block.sk;
    }
    valid = valid && componentValid;
    components.push({
      blockId: block.sk,
      blockNumber: block.blockNumber,
      eventId: block.eventId,
      resourceType: block.resourceType,
      resourceId: block.resourceId,
      action: block.action,
      payloadHash: block.payloadHash,
      calculatedHash,
      previousHash: block.previousHash,
      blockHash: block.blockHash,
      expectedBlockHash,
      chainOk,
      blockHashOk,
      resourceStatus,
      status: componentValid ? 'VALID' : resourceStatus === 'TAMPERED' ? 'TAMPERED' : 'INVALID',
    });
    previousHash = block.blockHash;
  }

  const status = blocks.length === 0
    ? 'NO_LEDGER_DATA'
    : valid
      ? 'VALID'
      : components.some((item) => item.resourceStatus === 'TAMPERED')
        ? 'TAMPERED'
        : 'INVALID';

  const ambBlocks = blocks.filter((block) => block.blockchainMode === 'AMB_ETHEREUM');
  const ambConfirmed = ambBlocks.filter((block) => block.blockchainStatus === 'CONFIRMED');
  const ambSubmitted = ambBlocks.filter((block) => block.blockchainStatus === 'SUBMITTED');
  const ambFailed = ambBlocks.filter((block) => block.blockchainStatus === 'FAILED');
  const hashOnly = blocks.filter((block) => block.blockchainStatus === 'HASH_ONLY' || !block.blockchainStatus);
  const latestAmbBlock = [...blocks]
    .reverse()
    .find((block) => block.blockchainTransactionId);

  const summary = {
    level: status === 'VALID' ? 'success' : status === 'NO_LEDGER_DATA' ? 'empty' : 'danger',
    headline:
      status === 'VALID'
        ? ambBlocks.length > 0
          ? 'Hồ sơ hợp lệ và đã có bằng chứng blockchain AMB'
          : 'Hồ sơ hợp lệ trong chuỗi hash nội bộ'
        : status === 'NO_LEDGER_DATA'
          ? 'Chưa có dữ liệu blockchain cho hồ sơ này'
          : 'Cần kiểm tra lại: phát hiện dấu hiệu sai lệch',
    explain:
      status === 'VALID'
        ? 'Các dấu vết của hồ sơ khớp với chuỗi hash. Nếu dữ liệu bị sửa trực tiếp trong cơ sở dữ liệu, kết quả kiểm tra sẽ chuyển sang lỗi.'
        : status === 'NO_LEDGER_DATA'
          ? 'Hồ sơ chưa có block. Hãy tạo phiếu khám/đơn thuốc/xét nghiệm mới hoặc chạy backfill ledger.'
          : 'Một block không khớp với dữ liệu hiện tại hoặc không nối đúng block trước đó.',
    recommendedAction:
      status === 'VALID'
        ? 'Không cần xử lý thêm.'
        : status === 'NO_LEDGER_DATA'
          ? 'Chạy backfill hoặc tạo dữ liệu y tế mới để sinh block.'
          : 'Kiểm tra block lỗi, đối chiếu dữ liệu và chạy lại rebuild ledger nếu đây là dữ liệu demo.',
    localLedgerValid: valid,
    ambEnabled: ambBlocks.length > 0,
    ambConfirmedCount: ambConfirmed.length,
    ambSubmittedCount: ambSubmitted.length,
    ambFailedCount: ambFailed.length,
    hashOnlyCount: hashOnly.length,
    latestAmbTransactionId: latestAmbBlock?.blockchainTransactionId || null,
    latestAmbTransactionUrl: latestAmbBlock?.blockchainTransactionUrl || null,
    latestAmbStatus: latestAmbBlock?.blockchainStatus || null,
    latestAmbNetwork: latestAmbBlock?.blockchainNetwork || null,
  };

  return success({
    valid,
    medicalRecordId: recordId,
    recordId,
    status,
    blockCount: blocks.length,
    latestBlockHash: blocks.at(-1)?.blockHash || null,
    brokenAt,
    summary,
    amb: {
      enabled: summary.ambEnabled,
      confirmed: summary.ambConfirmedCount,
      submitted: summary.ambSubmittedCount,
      failed: summary.ambFailedCount,
      hashOnly: summary.hashOnlyCount,
      latestTransactionId: summary.latestAmbTransactionId,
      latestTransactionUrl: summary.latestAmbTransactionUrl,
      latestStatus: summary.latestAmbStatus,
      latestNetwork: summary.latestAmbNetwork,
    },
    blocks,
    components,
  });
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
  'GET /api/medical-records/{recordId}/ledger': listAuditEvents,
  'GET /api/medical-records/{recordId}/integrity': verifyIntegrity,
  'GET /api/medical-records/{recordId}/ledger/verify': verifyIntegrity,
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
  appendBillingToken,
  normalizeBlockchainConfig,
  approveAiSummary,
  auditRecordKey,
  getSavedAuditRecord,
  handler,
  handleStream,
  listAuditEvents,
  processStreamRecord,
  updateLedgerBlockAnchor,
  routeHandlers,
  saveLedgerBlock,
  verifyIntegrity,
};
