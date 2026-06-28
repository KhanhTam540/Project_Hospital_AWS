'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const roots = [
  path.join(projectRoot, 'bin'),
  path.join(projectRoot, 'lib'),
  path.join(projectRoot, 'services'),
];

const excludedDirectories = new Set([
  'node_modules',
  'cdk.out',
  '.git',
]);

const patterns = [
  /bedrock/i,
  /BEDROCK_MODEL_ID/,
  /InvokeModel/,
  /InvokeModelWithResponseStream/,
];

const findings = [];

function visit(target) {
  if (!fs.existsSync(target)) {
    return;
  }

  const stat = fs.statSync(target);

  if (stat.isDirectory()) {
    if (excludedDirectories.has(path.basename(target))) {
      return;
    }

    for (const child of fs.readdirSync(target)) {
      visit(path.join(target, child));
    }

    return;
  }

  if (!target.endsWith('.js') && !target.endsWith('.json')) {
    return;
  }

  const lines = fs.readFileSync(target, 'utf8').split(/\r?\n/);

  lines.forEach((line, index) => {
    if (patterns.some((pattern) => pattern.test(line))) {
      findings.push({
        file: path.relative(projectRoot, target),
        line: index + 1,
        content: line.trim(),
      });
    }
  });
}

roots.forEach(visit);

if (findings.length > 0) {
  console.error('Vẫn còn cấu hình Amazon Bedrock trong mã chạy:');

  for (const finding of findings) {
    console.error(
      `- ${finding.file}:${finding.line} ${finding.content}`,
    );
  }

  process.exitCode = 1;
} else {
  console.log('OK: Không còn cấu hình Amazon Bedrock trong bin/lib/services.');
}
