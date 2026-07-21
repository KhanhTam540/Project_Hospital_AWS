'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const [target, command, ...args] = process.argv.slice(2);

if (!['edge', 'app', 'all'].includes(target || '')) {
  console.error(
    'Usage: node scripts/cdk-target.js <edge|app|all> ' +
      '<synth|diff|deploy> [stack] [options]',
  );
  process.exit(2);
}

if (!command) {
  console.error('Missing CDK command: synth, diff or deploy.');
  process.exit(2);
}

const projectRoot = path.resolve(__dirname, '..');
const candidates = [
  path.join(projectRoot, 'node_modules', 'aws-cdk', 'bin', 'cdk'),
  path.join(projectRoot, 'node_modules', 'aws-cdk', 'bin', 'cdk.js'),
];
const cdkCliPath = candidates.find((candidate) =>
  fs.existsSync(candidate),
);

if (!cdkCliPath) {
  console.error('Local AWS CDK CLI was not found. Run npm install first.');
  process.exit(1);
}

console.log(`[cdk-target] target=${target}`);
console.log(`[cdk-target] command=${command}`);
console.log(`[cdk-target] stack/options=${args.join(' ')}`);
console.log(`[cdk-target] CLI=${cdkCliPath}`);

const result = spawnSync(
  process.execPath,
  [cdkCliPath, command, ...args],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      DEPLOY_TARGET: target,
    },
    stdio: 'inherit',
    windowsHide: false,
  },
);

if (result.error) {
  console.error(result.error.stack || result.error.message || result.error);
  process.exit(1);
}

if (result.signal) {
  console.error(`AWS CDK was terminated by signal: ${result.signal}`);
  process.exit(1);
}

process.exit(typeof result.status === 'number' ? result.status : 1);
