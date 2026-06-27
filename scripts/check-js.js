const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const ignoredDirectories = new Set([
  '.git',
  'cdk.out',
  'dist',
  'node_modules',
]);

const files = [];

const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (
      ignoredDirectories.has(entry.name) ||
      entry.name.startsWith('_backup_dinhbao_week1_') ||
      entry.name.startsWith('_backup_audit_fix_')
    ) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
};

walk(projectRoot);

for (const file of files) {
  execFileSync(process.execPath, ['--check', file], {
    stdio: 'inherit',
  });
}

console.log(`JavaScript syntax check passed for ${files.length} files.`);
