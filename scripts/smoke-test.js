const fs = require('fs');
const path = require('path');

const outputsFile = path.resolve(
  __dirname,
  '..',
  'docs',
  'aws-dev-outputs.json',
);

const check = async (url) => {
  const response = await fetch(url);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${body}`);
  }
  console.log(`${url} -> ${response.status} ${body}`);
};

const main = async () => {
  if (!fs.existsSync(outputsFile)) {
    throw new Error('Run npm run outputs before npm run smoke');
  }

  const outputs = JSON.parse(fs.readFileSync(outputsFile, 'utf8'));
  await check(`${outputs.ApiEndpoint}/api/health`);
  await check(`${outputs.CloudFrontUrl}/api/health`);
};

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
