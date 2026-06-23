const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  CloudFrontClient,
  CreateInvalidationCommand,
} = require('@aws-sdk/client-cloudfront');
const {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} = require('@aws-sdk/client-s3');

const projectRoot = path.resolve(__dirname, '..');
const outputsFile = path.join(
  projectRoot,
  'docs',
  'aws-dev-outputs.json',
);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const listLocalFiles = (directory, base = directory) => {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...listLocalFiles(fullPath, base));
    } else if (entry.isFile()) {
      result.push({
        fullPath,
        key: path.relative(base, fullPath).split(path.sep).join('/'),
      });
    }
  }
  return result;
};

const main = async () => {
  if (!fs.existsSync(outputsFile)) {
    throw new Error('Run npm run outputs before npm run deploy:web');
  }

  const outputs = JSON.parse(fs.readFileSync(outputsFile, 'utf8'));
  const region = outputs.region || 'ap-southeast-1';
  const bucketName = outputs.FrontendBucketName;
  const distributionId = outputs.CloudFrontDistributionId;

  execFileSync('npm', ['--prefix', 'web', 'run', 'build'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  const distDirectory = path.join(projectRoot, 'web', 'dist');
  const files = listLocalFiles(distDirectory);
  const localKeys = new Set(files.map((file) => file.key));
  const s3 = new S3Client({ region });

  for (const file of files) {
    const extension = path.extname(file.key).toLowerCase();
    const isHtml = extension === '.html';
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: file.key,
        Body: fs.createReadStream(file.fullPath),
        ContentType: contentTypes[extension] || 'application/octet-stream',
        CacheControl: isHtml
          ? 'no-cache, no-store, must-revalidate'
          : 'public, max-age=31536000, immutable',
      }),
    );
    console.log(`Uploaded ${file.key}`);
  }

  let continuationToken;
  const remoteKeys = [];
  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
      }),
    );
    remoteKeys.push(...(response.Contents || []).map((object) => object.Key));
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  const staleKeys = remoteKeys.filter((key) => key && !localKeys.has(key));
  if (staleKeys.length) {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: staleKeys.map((key) => ({ Key: key })),
          Quiet: true,
        },
      }),
    );
    console.log(`Deleted ${staleKeys.length} stale files`);
  }

  const cloudFront = new CloudFrontClient({ region: 'us-east-1' });
  await cloudFront.send(
    new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: `hospital-${Date.now()}`,
        Paths: {
          Quantity: 1,
          Items: ['/*'],
        },
      },
    }),
  );

  console.log(`Web deployed: ${outputs.CloudFrontUrl}`);
};

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
