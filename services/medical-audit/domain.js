'use strict';

const crypto = require('crypto');

const VOLATILE_FIELDS = new Set([
  'pk',
  'sk',
  'gsi1pk',
  'gsi1sk',
  'patientSk',
  'recordSk',
  'blockSk',
  'ledgerSk',
  'blockchainStatus',
  'blockchainMode',
  'blockchainMessage',
  'blockchainTransactionId',
  'blockchainBlockNumber',
  'blockchainAnchoredAt',
  'auditEventId',
  'auditUpdatedAt',
  'previousHash',
  'blockHash',
  'ledgerBlockId',
  'ledgerCommittedAt',
  'updatedAt',
]);

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.keys(value)
      .filter((key) => !VOLATILE_FIELDS.has(key))
      .sort()
      .reduce((result, key) => {
        const child = value[key];
        if (child !== undefined) {
          result[key] = sortValue(child);
        }
        return result;
      }, {});
  }

  return value;
}

function canonicalize(value) {
  return JSON.stringify(sortValue(value));
}

function sha256(value) {
  return crypto
    .createHash('sha256')
    .update(String(value), 'utf8')
    .digest('hex');
}

function hashResource(item) {
  return sha256(canonicalize(item));
}

function normalizeEntityType(value) {
  return String(value || '').trim().toUpperCase();
}

const ELIGIBLE_ENTITY_TYPES = new Set([
  'RECORD',
  'MEDICAL_RECORD',
  'EXAMINATION',
  'LAB_RESULT',
  'PRESCRIPTION',
  'MEDICAL_DOCUMENT',
  'INVOICE',
  'AI_MEDICAL_SUMMARY',
]);

function isMedicalRecordEntity(item = {}) {
  const entityType = normalizeEntityType(item.entityType);
  if (!ELIGIBLE_ENTITY_TYPES.has(entityType)) return false;

  const sk = String(item.sk || '');
  return (
    sk === 'METADATA' ||
    sk === 'META' ||
    (entityType === 'MEDICAL_RECORD' && sk.startsWith('MEDICAL_RECORD#')) ||
    (entityType === 'RECORD' && sk.startsWith('RECORD#'))
  );
}

function getMedicalRecordId(item = {}) {
  return (
    item.medicalRecordId ||
    item.recordId ||
    item.maHSBA ||
    item.recordCode ||
    item.citizenId ||
    null
  );
}

function getResourceId(item = {}) {
  return (
    item.recordId ||
    item.examinationId ||
    item.labResultId ||
    item.prescriptionId ||
    item.documentId ||
    item.invoiceId ||
    item.summaryId ||
    String(item.pk || '').split('#').slice(1).join('#') ||
    null
  );
}

function actionForChange(eventName, item = {}) {
  const entityType = normalizeEntityType(item.entityType);
  const status = String(item.status || item.trangThai || '')
    .trim()
    .toUpperCase();

  if (eventName === 'REMOVE') return `${entityType}_DELETED`;

  if (entityType === 'LAB_RESULT' && ['APPROVED', 'COMPLETED', 'HOAN_THANH'].includes(status)) {
    return 'LAB_RESULT_APPROVED';
  }

  if (entityType === 'EXAMINATION' && ['COMPLETED', 'DA_KHAM', 'HOAN_THANH'].includes(status)) {
    return 'EXAMINATION_COMPLETED';
  }

  if (entityType === 'PRESCRIPTION' && ['DISPENSED', 'COMPLETED', 'DA_KE_DON'].includes(status)) {
    return 'PRESCRIPTION_DISPENSED';
  }

  if (
    entityType === 'INVOICE' &&
    ['PAID', 'DA_THANH_TOAN', 'SUCCESS'].includes(status)
  ) {
    return 'INVOICE_PAID';
  }

  if (
    entityType === 'MEDICAL_DOCUMENT' &&
    ['AVAILABLE', 'UPLOADED', 'DA_TAI_LEN'].includes(status)
  ) {
    return 'MEDICAL_DOCUMENT_UPLOADED';
  }

  if (entityType === 'AI_MEDICAL_SUMMARY') {
    return 'AI_SUMMARY_APPROVED';
  }

  return `${entityType}_${eventName === 'INSERT' ? 'CREATED' : 'UPDATED'}`;
}

function createAuditEvent({ eventName, item, oldItem, occurredAt }) {
  const source = eventName === 'REMOVE' ? oldItem : item;
  const medicalRecordId = getMedicalRecordId(source);
  const resourceId = getResourceId(source);

  if (!medicalRecordId || !resourceId) return null;

  const payloadHash = hashResource(source);
  const entityType = normalizeEntityType(source.entityType);
  const timestamp = occurredAt || new Date().toISOString();
  const eventSeed = [
    eventName,
    source.pk,
    source.sk,
    source.version || source.updatedAt || timestamp,
    payloadHash,
  ].join('|');

  return {
    eventId: `AUD-${sha256(eventSeed).slice(0, 24).toUpperCase()}`,
    medicalRecordId: String(medicalRecordId),
    resourceType: entityType,
    resourceId: String(resourceId),
    action: actionForChange(eventName, source),
    resourceVersion: Number(source.version || 1),
    payloadHash,
    sourcePk: source.pk,
    sourceSk: source.sk,
    occurredAt: timestamp,
  };
}

function auditPartitionKey(recordId) {
  return `MEDICAL_RECORD_AUDIT#${String(recordId).trim().toUpperCase()}`;
}

function ledgerPartitionKey(recordId) {
  return `MEDICAL_LEDGER#${String(recordId).trim().toUpperCase()}`;
}

function blockSortKey(auditEvent) {
  return `BLOCK#${auditEvent.occurredAt}#${auditEvent.resourceType}#${auditEvent.resourceId}#${auditEvent.eventId}`;
}

function buildBlockHashPayload({ auditEvent, previousHash }) {
  return {
    eventId: auditEvent.eventId,
    medicalRecordId: auditEvent.medicalRecordId,
    resourceType: auditEvent.resourceType,
    resourceId: auditEvent.resourceId,
    action: auditEvent.action,
    resourceVersion: auditEvent.resourceVersion,
    payloadHash: auditEvent.payloadHash,
    previousHash,
    sourcePk: auditEvent.sourcePk,
    sourceSk: auditEvent.sourceSk,
    occurredAt: auditEvent.occurredAt,
  };
}

function buildLedgerBlock({ auditEvent, previousHash, blockNumber, createdAt }) {
  const safePreviousHash = previousHash || 'GENESIS';
  const hashPayload = buildBlockHashPayload({
    auditEvent,
    previousHash: safePreviousHash,
  });
  const blockHash = sha256(canonicalize(hashPayload));
  const sk = blockSortKey(auditEvent);

  return {
    pk: ledgerPartitionKey(auditEvent.medicalRecordId),
    sk,
    gsi1pk: `LEDGER_EVENT#${auditEvent.eventId}`,
    gsi1sk: 'METADATA',
    entityType: 'MEDICAL_LEDGER_BLOCK',
    ledgerBlockId: sk,
    blockNumber: Number(blockNumber || 1),
    medicalRecordId: auditEvent.medicalRecordId,
    recordId: auditEvent.medicalRecordId,
    resourceType: auditEvent.resourceType,
    documentType: auditEvent.resourceType,
    resourceId: auditEvent.resourceId,
    documentId: auditEvent.resourceId,
    action: auditEvent.action,
    payloadHash: auditEvent.payloadHash,
    previousHash: safePreviousHash,
    blockHash,
    eventId: auditEvent.eventId,
    sourcePk: auditEvent.sourcePk,
    sourceSk: auditEvent.sourceSk,
    resourceVersion: auditEvent.resourceVersion,
    occurredAt: auditEvent.occurredAt,
    createdAt: createdAt || new Date().toISOString(),
  };
}

function encodeAnchorPayload(event) {
  return {
    eventIdHash: `0x${sha256(event.eventId)}`,
    medicalRecordIdHash: `0x${sha256(event.medicalRecordId)}`,
    resourceIdHash: `0x${sha256(event.resourceId)}`,
    payloadHash: `0x${event.payloadHash}`,
    metadataHash: `0x${sha256(
      canonicalize({
        action: event.action,
        resourceType: event.resourceType,
        resourceVersion: event.resourceVersion,
        occurredAt: event.occurredAt,
      }),
    )}`,
  };
}

module.exports = {
  ELIGIBLE_ENTITY_TYPES,
  actionForChange,
  auditPartitionKey,
  blockSortKey,
  buildBlockHashPayload,
  buildLedgerBlock,
  canonicalize,
  createAuditEvent,
  encodeAnchorPayload,
  getMedicalRecordId,
  getResourceId,
  hashResource,
  isMedicalRecordEntity,
  ledgerPartitionKey,
  sha256,
  sortValue,
};
