'use strict';

const fs = require('fs');
const path = require('path');

const DATASET_DIRECTORY = path.join(__dirname, '..', 'dataset');
const SAMPLE_SOURCE = 'P2TB_SAMPLE';

function loadDatasetFiles() {
  const fileNames = fs
    .readdirSync(DATASET_DIRECTORY)
    .filter((name) => name.endsWith('.json'))
    .sort();

  const items = [];
  for (const fileName of fileNames) {
    const fullPath = path.join(DATASET_DIRECTORY, fileName);
    const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    if (!Array.isArray(content)) throw new Error(`${fileName} must contain a JSON array`);

    for (const item of content) {
      items.push({ ...item, __sourceFile: fileName });
    }
  }

  return { fileNames, items };
}

function itemKey(item) {
  return `${item.pk}|${item.sk}`;
}

function validateDataset(items) {
  const errors = [];
  const seenKeys = new Set();

  for (const [index, item] of items.entries()) {
    const location = item.__sourceFile ? `${item.__sourceFile}[${index}]` : `item[${index}]`;

    for (const requiredField of ['pk', 'sk', 'entityType', 'dataSource']) {
      if (!item[requiredField]) errors.push(`${location}: missing ${requiredField}`);
    }

    if (item.dataSource && item.dataSource !== SAMPLE_SOURCE) {
      errors.push(`${location}: dataSource must be ${SAMPLE_SOURCE}`);
    }

    if (item.pk && item.sk) {
      const key = itemKey(item);
      if (seenKeys.has(key)) errors.push(`${location}: duplicate key ${key}`);
      seenKeys.add(key);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Dataset validation failed:\n- ${errors.join('\n- ')}`);
  }
}

function withoutInternalFields(item) {
  const clean = { ...item };
  delete clean.__sourceFile;
  return clean;
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

module.exports = {
  DATASET_DIRECTORY,
  SAMPLE_SOURCE,
  loadDatasetFiles,
  itemKey,
  validateDataset,
  withoutInternalFields,
  chunk,
  sleep,
};
